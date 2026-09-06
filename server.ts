import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Top-level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Lazy GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AI requests will fail until configured in AI Studio secrets.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiClient;
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

// Helper for resilient generation with fallback ladder
async function generateContentWithFallback(promptOrContents: any, systemInstruction?: string) {
  const ai = getGenAI();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: promptOrContents,
        config: systemInstruction
          ? {
              systemInstruction,
              temperature: 0.7,
              maxOutputTokens: 1500,
            }
          : {
              temperature: 0.7,
              maxOutputTokens: 1500,
            },
      });

      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`Attempt with model ${model} failed:`, err?.message || err);
      lastError = err;
      // Recoverable error status checks: continue to next ladder step
      const status = err?.status || err?.statusCode || 500;
      if ([503, 429, 404, 500, 400].includes(status) || err?.message?.includes("not found")) {
        continue;
      }
    }
  }

  throw lastError || new Error("Failed to generate content across all fallback models.");
}

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Reflect / Conversational Journal Companion Endpoint
app.post("/api/gemini/reflect", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { messages = [], mode = "reflect", mood, tags = [], userPrompt } = body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in environment variables or AI Studio Secrets.",
      });
    }

    // Build system instruction based on mode
    let modeInstruction = "";
    switch (mode) {
      case "summarize":
        modeInstruction = `You are an insightful personal journaling analyst. Your goal is to provide a structured executive summary of the user's reflection, highlight emotional themes, identify subconscious patterns, and extract 2-3 concrete, empowering action steps or takeaways.`;
        break;
      case "brainstorm":
        modeInstruction = `You are a creative, supportive brainstorming partner. Help the user reframe their challenges, explore innovative solutions, create mind-maps of possibilities, and offer fresh, constructive perspectives.`;
        break;
      case "coaching":
        modeInstruction = `You are a compassionate Socratic mindfulness and life coach. Ask deep, thoughtful questions that encourage self-awareness, provide grounding perspective, and foster emotional resilience.`;
        break;
      case "reflect":
      default:
        modeInstruction = `You are ReflectAI, an empathetic, mindful, and highly attentive AI journal companion. Provide deep, warm, and thoughtful reflections on what the user shared. Acknowledge their feelings with empathy, point out strengths, and ask 1 gentle reflective question to help them go deeper.`;
        break;
    }

    const contextHeader = `[Context: Current Mood = ${mood || "Reflective"}, Tags = ${tags.length ? tags.join(", ") : "General"}]`;

    // Construct conversation history for Gemini
    const contents: any[] = [];

    // Add prior message turns if available
    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        if (msg && msg.content) {
          contents.push({
            role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
            parts: [{ text: String(msg.content) }],
          });
        }
      }
    }

    // Add current user prompt if not already in messages
    if (userPrompt && (!messages.length || messages[messages.length - 1]?.content !== userPrompt)) {
      contents.push({
        role: "user",
        parts: [{ text: `${contextHeader}\n\n${userPrompt}` }],
      });
    } else if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: `${contextHeader}\n\nPlease provide a mindful reflection on my journal.` }],
      });
    }

    const systemPrompt = `${modeInstruction}
Keep responses warm, well-formatted using clear Markdown with headings, bullet points, and gentle tone. Avoid robotic clichés. Treat all user thoughts as strictly private personal reflections.`;

    const result = await generateContentWithFallback(contents, systemPrompt);

    res.json({
      reply: result.text,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/reflect:", error);
    res.status(500).json({
      error: error?.message || "Failed to process reflection with Gemini AI.",
    });
  }
});

// Smart Analysis Endpoint (Auto-generate Title, Summary, Mood Score, Action Items)
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { journalText = "", currentMood = "" } = body;

    if (!journalText.trim()) {
      return res.status(400).json({ error: "journalText is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const prompt = `Analyze the following private journal entry:
"""
${journalText}
"""
The user tagged their mood as: "${currentMood}".

Respond strictly in JSON format matching this schema:
{
  "suggestedTitle": "A concise, poetic or meaningful 3-6 word title for this entry",
  "detectedMood": "one of: radiant | joyful | calm | reflective | anxious | down | frustrated",
  "moodScore": 1 to 5 (integer, 5 = happiest/most vibrant, 1 = lowest/most distressed),
  "summary": "A 2-3 sentence executive summary of the entry's core theme and feelings",
  "keyEmotions": ["emotion 1", "emotion 2", "emotion 3"],
  "suggestedTags": ["tag1", "tag2"],
  "actionTakeaways": ["Empowering takeaway 1", "Empowering takeaway 2"]
}`;

    const systemInstruction = "You are a precise JSON-only journal analysis engine. Output valid raw JSON only, with no markdown code fences or backticks.";

    const result = await generateContentWithFallback(prompt, systemInstruction);
    let parsedData = {};
    try {
      // Clean possible markdown fences
      let cleanJson = result.text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsedData = JSON.parse(cleanJson);
    } catch {
      parsedData = {
        suggestedTitle: "Reflective Moment",
        detectedMood: currentMood || "reflective",
        moodScore: 3,
        summary: "A heartfelt personal reflection captured in your journal.",
        keyEmotions: ["Reflective", "Mindful"],
        suggestedTags: ["Personal", "Growth"],
        actionTakeaways: ["Continue checking in with yourself regularly."],
      };
    }

    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/gemini/analyze:", error);
    res.status(500).json({
      error: error?.message || "Failed to analyze journal entry.",
    });
  }
});

// Smart Contextual Auto-Correction, Spelling, Grammar & Voice Polish Endpoint
app.post("/api/gemini/refine-text", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { text = "", mode = "auto_correct", mood = "" } = body;

    const trimmedText = String(text).trim();
    if (!trimmedText) {
      return res.json({
        refinedText: "",
        corrections: [],
        originalText: "",
        summary: "No text provided.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in environment variables or AI Studio Secrets.",
      });
    }

    let instructionDetails = "";
    if (mode === "punctuate_speech") {
      instructionDetails = `The input is a raw speech-to-text voice dictation transcript that may lack proper punctuation, sentence capitalization, and paragraph breaks. Punctuate it naturally, capitalize sentence beginnings and proper nouns, fix obvious speech recognition phonetic errors or misheard homophones, while keeping the author's exact conversational phrasing and heartfelt words.`;
    } else if (mode === "polish_flow") {
      instructionDetails = `Gently polish the text for clarity, grammatical fluidity, and cadence without altering the author's authentic tone, emotional vulnerability, or personal vocabulary. Keep it natural and personal.`;
    } else {
      // default: auto_correct & fix_grammar_spelling
      instructionDetails = `Perform contextual spell checking, grammar correction, typo fixes, and punctuation repair. Fix misspelled words (e.g. 'grmamer' -> 'grammar', 'speach' -> 'speech', 'accoreding' -> 'according'), fix run-on punctuation, and correct verb tenses based on context, but preserve the author's authentic emotional voice and original meaning completely.`;
    }

    const prompt = `You are a mindful journaling writing assistant and contextual speech-to-text editor.
${instructionDetails}

User's Journal Text:
"""
${trimmedText}
"""
${mood ? `Context Mood: ${mood}` : ""}

Respond strictly in JSON format matching this schema:
{
  "refinedText": "The complete polished, spell-checked and grammatically correct journal text",
  "corrections": [
    {
      "original": "misspelled word or grammatical segment",
      "corrected": "corrected word or segment",
      "explanation": "Brief 3-6 word reason (e.g. 'Corrected typo', 'Added period', 'Contextual homophone fix')"
    }
  ],
  "changeSummary": "A concise 1-sentence note of what was improved"
}`;

    const systemInstruction =
      "You are a precise JSON-only text refinement engine. Output valid raw JSON only, with no markdown code fences or conversational text.";

    const result = await generateContentWithFallback(prompt, systemInstruction);
    let parsedData: any = {};

    try {
      let cleanJson = result.text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsedData = JSON.parse(cleanJson);
    } catch {
      parsedData = {
        refinedText: trimmedText,
        corrections: [],
        changeSummary: "Text processed without changes.",
      };
    }

    res.json({
      refinedText: parsedData.refinedText || trimmedText,
      corrections: Array.isArray(parsedData.corrections) ? parsedData.corrections : [],
      changeSummary: parsedData.changeSummary || "Text polished successfully.",
      originalText: trimmedText,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/refine-text:", error);
    res.status(500).json({
      error: error?.message || "Failed to refine journal text.",
    });
  }
});

// AI Design Assistant: Analyze journal sentiment and suggest visual scrapbook design & palette
app.post("/api/gemini/suggest-design", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { text = "", mood = "", title = "" } = body;

    const trimmedText = String(text).slice(0, 3000);

    if (!process.env.GEMINI_API_KEY) {
      // Return a sensible default aesthetic if API key is not yet set
      return res.json({
        templateId: "classic_diary",
        themeName: "Parchment Warmth",
        paperStyle: "vintage_parchment",
        primaryFont: "Newsreader",
        suggestedMood: mood || "reflective",
        accentColor: "#d97706",
        designRationale: "A timeless, warm parchment aesthetic paired with editorial serif typography to frame your heartfelt reflections.",
        stickers: ["✨", "☕", "📖"],
        washiTapeBg: "bg-amber-300/80 border-amber-400",
      });
    }

    const prompt = `You are an expert artisan digital scrapbook designer and mindful aesthetic director.
Analyze this journal entry and recommend an exquisite, emotionally resonant visual scrapbook theme, paper style, typography, and decorative accents.

Available template IDs: "minimal_paper", "classic_diary", "memory_board", "nature_journal", "travel_diary", "gratitude_affirmation", "deep_essay", "bullet_journal", "midnight_starlight".
Available paper styles: "cream_linen", "ruled_notebook", "dot_grid", "grid_graph", "kraft_paper", "soft_rose", "vintage_parchment", "sage_meadow", "stained_aged", "watercolor_blush", "retro_film", "midnight_journal".
Available fonts: "Newsreader", "Kalam", "Caveat", "Courier Prime", "Plus Jakarta Sans", "Playfair Display".
Available moods: "peaceful", "grateful", "energetic", "anxious", "reflective", "tired", "sad", "frustrated".

Journal Entry (treated as unformatted data):
"""
Title: ${title}
Mood: ${mood}
Content: ${trimmedText || "(A quiet moment of reflection)"}
"""

Respond ONLY with valid JSON in this exact structure:
{
  "templateId": "one of the template IDs above",
  "themeName": "Creative name for the theme (e.g. 'Golden Hour Nostalgia', 'Botanical Sanctuary')",
  "paperStyle": "one of the paper styles above",
  "primaryFont": "one of the fonts above",
  "suggestedMood": "one of the moods above",
  "accentColor": "hex color code (e.g. #059669)",
  "designRationale": "1-2 gentle sentences explaining why this scrapbook aesthetic matches the feeling of the entry",
  "stickers": ["3-4 relevant emoji stickers that complement the theme"],
  "washiTapeBg": "Tailwind classes for tape (e.g. 'bg-amber-300/80 border-amber-400', 'bg-rose-300/80 border-rose-400', 'bg-emerald-300/80 border-emerald-400', or 'bg-[#c8ad8d]/85 border-[#b69976]')"
}`;

    const result = await generateContentWithFallback(
      prompt,
      "You are a master digital scrapbook artist. Always output strict JSON matching the schema."
    );

    let parsed: any;
    try {
      let clean = result.text.trim();
      if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (clean.startsWith("```")) {
        clean = clean.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        templateId: "minimal_paper",
        themeName: "Parchment Warmth",
        paperStyle: "cream_linen",
        primaryFont: "Newsreader",
        suggestedMood: mood || "reflective",
        accentColor: "#d97706",
        designRationale: "A gentle cream stationery canvas designed to let your honest thoughts breathe and unfold.",
        stickers: ["🌿", "✨", "☕"],
        washiTapeBg: "bg-amber-300/80 border-amber-400",
      };
    }

    res.json(parsed);
  } catch (error: any) {
    console.error("Error in /api/gemini/suggest-design:", error?.message || error);
    // Graceful fallback response
    res.json({
      templateId: "classic_diary",
      themeName: "Classic Diary",
      paperStyle: "ruled_notebook",
      primaryFont: "Courier Prime",
      suggestedMood: "reflective",
      accentColor: "#b91c1c",
      designRationale: "A nostalgic lined diary layout for focused everyday journaling.",
      stickers: ["📓", "☕", "⭐"],
      washiTapeBg: "bg-amber-300/80 border-amber-400",
    });
  }
});

// Helper to format ICS timestamp (e.g. 20260915T140000Z or 20260915)
function formatIcsDateTime(dateStr: string, timeStr?: string): string {
  const cleanDate = dateStr.replace(/-/g, "");
  if (timeStr && timeStr.includes(":")) {
    const [h, m] = timeStr.split(":");
    return `${cleanDate}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
  }
  return cleanDate;
}

// Helper to format Google Calendar URL
function makeGoogleCalendarUrl(title: string, dateStr: string, timeStr?: string, desc?: string): string {
  const cleanDate = dateStr.replace(/-/g, "");
  let datesParam = "";
  if (timeStr && timeStr.includes(":")) {
    const [h, m] = timeStr.split(":");
    const startIso = `${cleanDate}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
    // default 1 hour event
    const endH = (parseInt(h, 10) + 1).toString().padStart(2, "0");
    const endIso = `${cleanDate}T${endH}${m.padStart(2, "0")}00`;
    datesParam = `${startIso}/${endIso}`;
  } else {
    // All-day event
    datesParam = `${cleanDate}/${cleanDate}`;
  }

  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const params = new URLSearchParams({
    text: title,
    dates: datesParam,
    details: desc || "Added from ReflectAI Secure Journal",
  });
  return `${base}&${params.toString()}`;
}

// Generate RFC 5545 iCalendar (.ics) string
function generateIcsContent(items: any[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  let lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReflectAI//Journal Calendar Assistant//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const item of items) {
    const uid = `reflectai-${item.id || Date.now()}-${Math.random().toString(36).substr(2, 6)}@reflectai.app`;
    const dtStart = formatIcsDateTime(item.date, item.time);
    const hasTime = Boolean(item.time && item.time.includes(":"));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    if (hasTime) {
      lines.push(`DTSTART:${dtStart}`);
      // 1-hour end
      const [h, m] = (item.time || "12:00").split(":");
      const endH = (parseInt(h, 10) + 1).toString().padStart(2, "0");
      const cleanDate = item.date.replace(/-/g, "");
      lines.push(`DTEND:${cleanDate}T${endH}${m.padStart(2, "0")}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    }
    lines.push(`SUMMARY:${item.title.replace(/[,;\n]/g, " ")}`);
    lines.push(`DESCRIPTION:${(item.description || "Identified in your ReflectAI Journal").replace(/\n/g, "\\n")}`);
    
    // Optional reminder alarm
    if (item.reminderMinutesBefore && item.reminderMinutesBefore > 0) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:Reminder: ${item.title.replace(/[,;\n]/g, " ")}`);
      lines.push(`TRIGGER:-PT${item.reminderMinutesBefore}M`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// 1. Individual Journal Entry Analysis Endpoint
app.post("/api/gemini/analyze-entry", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { 
      journalText = "", 
      entryDate = new Date().toISOString().slice(0, 10), 
      referenceDate = "2026-09-04",
      options = { allowCalendarSuggestions: true, allowEmotionalAnalysis: true } 
    } = body;

    const trimmedText = String(journalText).trim();
    if (!trimmedText) {
      return res.status(400).json({ error: "journalText is required." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const prompt = `You are an expert AI Journaling Analyst & Calendar Assistant.
Your goal is to carefully analyze this single private journal entry to extract meaningful insights, commitments, tasks, and potential calendar items.

CURRENT REFERENCE DATE: "${referenceDate}" (Today)
ENTRY DATE: "${entryDate}"

JOURNAL ENTRY CONTENT:
"""
${trimmedText}
"""

CRITICAL INSTRUCTIONS:
1. Do NOT interpret every sentence as a task or reminder.
2. Only identify actionable items when the journal provides reasonable evidence that the user intends to remember or act on them.
3. Classify detected items into:
   - "event": Something that happens at a particular time or date (meetings, exams, birthdays, anniversaries, appointments, travel plans, celebrations).
   - "task": Something the user needs to do or complete (deliverables, assignments, preparations, chores, personal goals).
   - "reminder": A suggested advance reminder for an event or task (e.g., prepare slides 2 days before, send birthday card).
4. Relative Date Understanding:
   - Calculate exact "YYYY-MM-DD" dates based on the Reference Date "${referenceDate}" and Entry Date "${entryDate}".
   - "tomorrow" -> calculate next calendar day.
   - "next Monday", "this Friday", "in two weeks" -> calculate the exact date.
   - If a date reference is ambiguous (e.g. "meeting on Monday" without specifying which one), mark "isAmbiguousDate": true, set "date" to null or best estimate, and provide a polite "clarificationPrompt" (e.g. "You mentioned a meeting on Monday. Which Monday did you mean?").
5. Only suggest reminders when helpful, with reasonable lead times (e.g., 30 mins, 1 day, 2 days before).

Respond STRICTLY in valid JSON matching this schema:
{
  "detectedEvents": [
    {
      "title": "Short descriptive event title",
      "type": "event",
      "category": "event | appointment | meeting | exam | birthday | anniversary | travel | deadline",
      "date": "YYYY-MM-DD",
      "time": "HH:mm or null",
      "relativeDateText": "quoted relative date phrasing or null",
      "isAmbiguousDate": false,
      "clarificationPrompt": null,
      "suggestedReminder": "e.g. Prepare presentation slides before September 13",
      "reminderMinutesBefore": 1440,
      "confidenceReason": "Quote or brief reasoning"
    }
  ],
  "detectedTasks": [
    {
      "title": "Short actionable task title",
      "type": "task",
      "category": "task | goal | follow_up | deadline",
      "date": "YYYY-MM-DD or null",
      "time": null,
      "relativeDateText": "quoted relative date phrasing or null",
      "isAmbiguousDate": false,
      "suggestedReminder": "e.g. Finish database module before Tuesday",
      "reminderMinutesBefore": 60,
      "confidenceReason": "Quote or brief reasoning"
    }
  ],
  "detectedDates": [
    {
      "label": "Brief label",
      "date": "YYYY-MM-DD",
      "context": "Context or relevance from entry"
    }
  ],
  "suggestedReminders": [
    {
      "reminder": "Suggested reminder action",
      "targetDate": "YYYY-MM-DD or null",
      "targetItemTitle": "Associated event or task"
    }
  ],
  "insightsSummary": "A concise 2-sentence summary of commitments and reflections found in this entry."
}`;

    const systemInstruction = "You are a precise JSON-only journal analysis engine. Output valid raw JSON only, with no markdown fences, backticks, or conversational text.";

    const result = await generateContentWithFallback(prompt, systemInstruction);
    let parsed: any = {};
    try {
      let cleanJson = result.text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn("Failed to parse JSON from analyze-entry:", parseErr, result.text);
      parsed = {
        detectedEvents: [],
        detectedTasks: [],
        detectedDates: [],
        suggestedReminders: [],
        insightsSummary: "No explicit commitments or dates detected in this reflection.",
      };
    }

    // Attach unique IDs to items
    const events = (Array.isArray(parsed.detectedEvents) ? parsed.detectedEvents : []).map((e: any, idx: number) => ({
      ...e,
      id: `ev_${Date.now()}_${idx}`,
      selected: true,
      status: "suggested",
    }));

    const tasks = (Array.isArray(parsed.detectedTasks) ? parsed.detectedTasks : []).map((t: any, idx: number) => ({
      ...t,
      id: `tk_${Date.now()}_${idx}`,
      selected: true,
      status: "suggested",
    }));

    res.json({
      detectedEvents: events,
      detectedTasks: tasks,
      detectedDates: Array.isArray(parsed.detectedDates) ? parsed.detectedDates : [],
      suggestedReminders: Array.isArray(parsed.suggestedReminders) ? parsed.suggestedReminders : [],
      insightsSummary: parsed.insightsSummary || "Analysis completed.",
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/analyze-entry:", error);
    res.status(500).json({
      error: error?.message || "Failed to analyze journal entry.",
    });
  }
});

// 2. Weekly & Monthly Journal Analysis Endpoint
app.post("/api/gemini/analyze-period", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const {
      periodType = "week", // "week" | "month"
      periodLabel = "",
      referenceDate = "2026-09-04",
      entries = [],
      previousPeriodEntries = [],
      options = { allowEmotionalAnalysis: true, allowCalendarSuggestions: true },
    } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: "At least one journal entry is required for period analysis." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    // Prepare serialized entry texts
    const entrySummaries = entries.map((e, idx) => {
      return `[Entry ${idx + 1} | Date: ${e.date || "Unknown"} | Title: "${e.title || "Untitled"}" | Mood: ${e.mood || "Reflective"}]
${e.text || (e.messages || []).map((m: any) => m.content).join("\n")}
`;
    }).join("\n---\n\n");

    const prevSummaries = previousPeriodEntries.length > 0
      ? previousPeriodEntries.map((e, idx) => {
          return `[Previous Period Entry ${idx + 1} | Date: ${e.date} | Title: "${e.title}"]
${e.text || (e.messages || []).map((m: any) => m.content).join("\n")}`;
        }).join("\n---\n\n")
      : "";

    const hasPreviousData = previousPeriodEntries.length > 0;

    let specificInstructions = "";
    if (periodType === "week") {
      specificInstructions = `WEEKLY ANALYSIS GOALS:
1. Weekly Reflection: Major events, important experiences, accomplishments, challenges, unfinished tasks, upcoming commitments, goals mentioned, and significant changes from previous entries.
2. Patterns: Identify recurring patterns across the week (e.g. "You mentioned feeling productive on days when you started work earlier"). Do NOT make medical or psychological diagnoses. Phrase observations as patterns or possibilities.
3. Mood/Emotion Overview: ${options.allowEmotionalAnalysis ? "Provide a lightweight, respectful overview of mood flow across the week." : "User has disabled emotional analysis; set moodOverview to null."}
4. Accomplishments: Clear bullet points of completed milestones.
5. Unfinished Items: Tasks still in progress.
6. Upcoming Events: Commitments or dates mentioned that occur in the future (relative to ${referenceDate}).
7. Comparison with Previous Week: ${hasPreviousData ? "Compare meaningful changes with previous week's entries (never invent numbers)." : "State clearly that previous week data is limited; do NOT fabricate comparison statistics."}
8. One-Paragraph Summary: A short, warm personal reflection ("Your Week in One Paragraph").`;
    } else {
      specificInstructions = `MONTHLY ANALYSIS GOALS:
1. Month in Review: Major events, accomplishments, challenges, important decisions, memorable moments, goals achieved, and goals still in progress.
2. Personal Patterns: Look for recurring themes across the month (career, productivity, habits, social). Phrase respectfully as observations.
3. Progress Tracking: Compare goals mentioned earlier in the month with later entries (e.g., Goal -> Progress stage: Started -> In Progress -> Completed/Pending).
4. Important Dates: Extract upcoming deadlines, appointments, events, birthdays, travel, exams, meetings.
5. Reflection Questions: Generate 2-3 thoughtful reflection questions based on the month's themes that the user could answer as a new journal entry.
6. Comparison with Previous Month: ${hasPreviousData ? "Compare with previous month (never invent statistics)." : "State that prior month data is limited; do NOT fabricate statistics."}
7. One-Paragraph Summary: A thoughtful personal summary ("Your Month in One Paragraph").`;
    }

    const prompt = `You are ReflectAI's deep periodic analysis engine.
Analyze the following user journal entries for ${periodLabel} (Current Reference Date: ${referenceDate}).

${specificInstructions}

CURRENT PERIOD JOURNAL ENTRIES (${entries.length} entries):
${entrySummaries}

${hasPreviousData ? `PREVIOUS PERIOD JOURNAL ENTRIES (${previousPeriodEntries.length} entries for comparison):\n${prevSummaries}` : "NO PREVIOUS PERIOD ENTRIES PROVIDED."}

Respond STRICTLY in valid JSON matching this schema:
{
  "reflection": {
    "majorEvents": ["event 1", "event 2"],
    "importantExperiences": ["experience 1"],
    "accomplishments": ["accomplishment 1"],
    "challenges": ["challenge 1"],
    "unfinishedTasks": ["task 1"],
    "upcomingCommitments": ["commitment 1"],
    "goalsMentioned": ["goal 1"],
    "significantChanges": ["change 1"]
  },
  "patterns": [
    {
      "title": "Short title (e.g. Morning Productivity)",
      "observation": "Empathetic observation phrased as a possibility",
      "category": "productivity | habit | wellbeing | work"
    }
  ],
  "moodOverview": ${options.allowEmotionalAnalysis ? '"Warm lightweight mood flow summary"' : 'null'},
  "accomplishments": ["Bullet 1", "Bullet 2"],
  "unfinishedItems": ["Unfinished 1", "Unfinished 2"],
  "upcomingEvents": [
    {
      "title": "Title of future event or task",
      "date": "YYYY-MM-DD",
      "time": "HH:mm or null",
      "type": "event | task | reminder",
      "category": "meeting | exam | birthday | travel | deadline | task",
      "description": "Details or notes",
      "reminderMinutesBefore": 1440
    }
  ],
  "progressTracking": [
    {
      "goal": "Goal description",
      "progressStage": "Started -> API completed -> Testing remaining",
      "details": "Evidence from entries"
    }
  ],
  "reflectionQuestions": [
    {
      "question": "Thoughtful reflection question?",
      "contextPrompt": "Brief background or journal prompt starter"
    }
  ],
  "comparison": {
    "hasComparisonData": ${hasPreviousData},
    "summaryPoints": [
      ${hasPreviousData ? '"Comparison point 1", "Comparison point 2"' : '"Insufficient historical data for a statistical comparison."'}
    ]
  },
  "oneParagraphSummary": "A reflective, thoughtful 4-5 sentence summary of the period."
}`;

    const systemInstruction = "You are a precise JSON-only journal analysis engine. Output valid raw JSON only, without markdown code fences or outside commentary.";

    const result = await generateContentWithFallback(prompt, systemInstruction);
    let parsed: any = {};
    try {
      let cleanJson = result.text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      console.warn("Failed to parse period analysis JSON:", err, result.text);
      parsed = {
        reflection: {
          majorEvents: [],
          importantExperiences: [],
          accomplishments: [],
          challenges: [],
          unfinishedTasks: [],
          upcomingCommitments: [],
          goalsMentioned: [],
          significantChanges: [],
        },
        patterns: [],
        moodOverview: options.allowEmotionalAnalysis ? "Reflections captured across your entries." : null,
        accomplishments: [],
        unfinishedItems: [],
        upcomingEvents: [],
        progressTracking: [],
        reflectionQuestions: [],
        comparison: { hasComparisonData: false, summaryPoints: ["Insufficient comparative entries."] },
        oneParagraphSummary: "A meaningful period of personal journaling and quiet reflection.",
      };
    }

    // Attach unique IDs to upcoming events
    const upcomingEvents = (Array.isArray(parsed.upcomingEvents) ? parsed.upcomingEvents : []).map((e: any, idx: number) => ({
      ...e,
      id: `period_ev_${Date.now()}_${idx}`,
      selected: true,
      status: "suggested",
    }));

    res.json({
      periodType,
      periodLabel,
      entryCount: entries.length,
      reflection: parsed.reflection || {},
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      moodOverview: parsed.moodOverview || null,
      accomplishments: Array.isArray(parsed.accomplishments) ? parsed.accomplishments : [],
      unfinishedItems: Array.isArray(parsed.unfinishedItems) ? parsed.unfinishedItems : [],
      upcomingEvents,
      progressTracking: Array.isArray(parsed.progressTracking) ? parsed.progressTracking : [],
      reflectionQuestions: Array.isArray(parsed.reflectionQuestions) ? parsed.reflectionQuestions : [],
      comparison: parsed.comparison || { hasComparisonData: false, summaryPoints: [] },
      oneParagraphSummary: parsed.oneParagraphSummary || "Analysis completed.",
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/analyze-period:", error);
    res.status(500).json({
      error: error?.message || "Failed to analyze period entries.",
    });
  }
});

// 3. Calendar Integration Endpoint (Authorized & Confirmed Items Only)
app.post("/api/calendar/add-events", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { userId, items = [], userConfirmed } = body;

    // Strict user authorization check
    if (userConfirmed !== true) {
      return res.status(403).json({
        error: "Forbidden: User authorization is strictly required before calendar items can be created or synchronized.",
      });
    }

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one calendar item must be provided." });
    }

    // Sanitize and validate every item
    const confirmedItems = items.map((item: any) => {
      const id = item.id || `cal_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
      const title = String(item.title || "Journal Reminder").trim();
      const type = ["event", "task", "reminder"].includes(item.type) ? item.type : "event";
      const date = item.date || new Date().toISOString().slice(0, 10);
      const time = item.time || null;
      const desc = item.description || (item.suggestedReminder ? `Reminder: ${item.suggestedReminder}` : "Added from ReflectAI Journal");
      const reminderMinutes = typeof item.reminderMinutesBefore === "number" ? item.reminderMinutesBefore : 60;
      const googleUrl = makeGoogleCalendarUrl(title, date, time, desc);

      return {
        id,
        userId,
        title,
        type,
        date,
        time,
        description: desc,
        reminderMinutesBefore: reminderMinutes,
        sourceReflectionId: item.sourceReflectionId || null,
        googleCalendarUrl: googleUrl,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      };
    });

    // Generate iCalendar RFC 5545 format
    const icsContent = generateIcsContent(confirmedItems);

    res.json({
      success: true,
      message: `Successfully authorized and prepared ${confirmedItems.length} calendar item(s).`,
      count: confirmedItems.length,
      items: confirmedItems,
      icsContent,
      firstGoogleCalendarUrl: confirmedItems[0]?.googleCalendarUrl || null,
    });
  } catch (error: any) {
    console.error("Error in /api/calendar/add-events:", error);
    res.status(500).json({
      error: error?.message || "Failed to process calendar addition.",
    });
  }
});

// -------------------------------------------------------------------
// Smart Completion & Reminder Assistant: Extract Action Items Endpoint
// -------------------------------------------------------------------
app.post("/api/gemini/extract-action-items", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const {
      journalText = "",
      entryDate = new Date().toISOString().slice(0, 10),
      referenceDate = new Date().toISOString().slice(0, 10),
      existingTitles = [],
    } = body;

    const trimmedText = String(journalText).trim();
    if (!trimmedText) {
      return res.json({
        detectedItems: [],
        rationale: "No journal text provided for analysis.",
      });
    }

    const existingTitlesLower = (Array.isArray(existingTitles) ? existingTitles : []).map(
      (t: string) => String(t).toLowerCase().trim()
    );

    // Heuristic Fallback Extractor (runs if API key is not present or if LLM encounters an unexpected issue)
    const runHeuristicExtractor = () => {
      const items: any[] = [];
      const sentences = trimmedText.split(/(?<=[.!?\n])\s+/);

      // Refined pattern indicators for unfinished commitments
      const taskIndicators = [
        /(?:need to|have to|must|should|ought to|plan to|aim to|intend to|promised to)\s+([^,.;!?]+)/i,
        /(?:still need to|still have to|yet to)\s+([^,.;!?]+)/i,
        /(?:submit|submission of|turn in|apply for|send over)\s+([^,.;!?]+)/i,
        /(?:prepare|finish|complete|finalize|schedule|call|email|review|draft)\s+([^,.;!?]+)/i,
        /(?:meeting with|appointment with|doctor appointment|dentist appointment|sync with)\s+([^,.;!?]+)/i,
      ];

      sentences.forEach((sentence, idx) => {
        const lower = sentence.toLowerCase();

        // Past event exclusion (e.g., "went to", "finished yesterday", "visited")
        const isPastTense = /\b(?:yesterday|last week|last month|ago|already finished|already completed|went to|visited|attended)\b/i.test(
          sentence
        );
        if (isPastTense && !/\b(?:still need|have to|must|will|tomorrow|next week)\b/i.test(sentence)) {
          return;
        }

        // Relative date indicators
        let detectedDate: string | null = null;
        let relativeText: string | null = null;
        let isAmbiguous = false;
        let clarification: string | null = null;
        let detectedTime: string | null = null;

        // Time match (e.g. 10 AM, 2:30 PM, 14:00)
        const timeMatch = sentence.match(/\b([0-1]?[0-9]|2[0-3]):?([0-5][0-9])?\s*(am|pm)?\b/i);
        if (timeMatch && (timeMatch[3] || timeMatch[0].includes(":"))) {
          let hours = parseInt(timeMatch[1], 10);
          const mins = timeMatch[2] ? timeMatch[2] : "00";
          const meridiem = timeMatch[3]?.toLowerCase();
          if (meridiem === "pm" && hours < 12) hours += 12;
          if (meridiem === "am" && hours === 12) hours = 0;
          detectedTime = `${hours.toString().padStart(2, "0")}:${mins}`;
        }

        // Relative date matching against referenceDate
        const refD = new Date(referenceDate);
        if (/\btomorrow\b/i.test(sentence)) {
          relativeText = "tomorrow";
          const nextDay = new Date(refD);
          nextDay.setDate(refD.getDate() + 1);
          detectedDate = nextDay.toISOString().slice(0, 10);
        } else if (/\bmonday\b/i.test(sentence)) {
          relativeText = "Monday";
          const dayOffset = (1 + 7 - refD.getDay()) % 7 || 7;
          const target = new Date(refD);
          target.setDate(refD.getDate() + dayOffset);
          detectedDate = target.toISOString().slice(0, 10);
        } else if (/\bfriday\b/i.test(sentence)) {
          relativeText = "Friday";
          const dayOffset = (5 + 7 - refD.getDay()) % 7 || 7;
          const target = new Date(refD);
          target.setDate(refD.getDate() + dayOffset);
          detectedDate = target.toISOString().slice(0, 10);
        } else if (/\bthis week\b/i.test(sentence)) {
          relativeText = "this week";
          isAmbiguous = true;
          clarification = "When this week would you like to finish this?";
        }

        for (const pattern of taskIndicators) {
          const match = sentence.match(pattern);
          if (match && match[1]) {
            let actionPhrase = match[0].trim();
            // Capitalize first letter
            actionPhrase = actionPhrase.charAt(0).toUpperCase() + actionPhrase.slice(1);
            if (actionPhrase.length > 70) {
              actionPhrase = actionPhrase.slice(0, 70) + "...";
            }

            // Check if title is duplicate
            const isDup = existingTitlesLower.some((t: string) =>
              t.includes(actionPhrase.toLowerCase()) || actionPhrase.toLowerCase().includes(t)
            );

            // Determine suggested type
            let suggestedType: "reminder" | "calendar" | "objective" = "reminder";
            if (detectedTime || /\b(meeting|appointment|sync|exam)\b/i.test(sentence)) {
              suggestedType = "calendar";
            } else if (/\b(project|goal|finish report|presentation|assignment|thesis)\b/i.test(sentence)) {
              suggestedType = "objective";
            }

            items.push({
              id: `action_${Date.now()}_${idx}`,
              title: actionPhrase,
              category: suggestedType === "calendar" ? "meeting" : suggestedType === "objective" ? "goal" : "task",
              date: detectedDate,
              time: detectedTime,
              relativeDateText: relativeText,
              isAmbiguousDate: isAmbiguous,
              clarificationPrompt: clarification,
              suggestedType,
              suggestedReminder: detectedDate ? `Reminder: ${actionPhrase} on ${detectedDate}` : undefined,
              confidenceReason: `Found action commitment in sentence: "${sentence.slice(0, 60)}..."`,
              priority: /\b(urgently|asap|crucial|priority)\b/i.test(sentence) ? "high" : "medium",
              isDuplicate: isDup,
            });
            break;
          }
        }
      });

      return items;
    };

    if (!process.env.GEMINI_API_KEY) {
      const heuristicResults = runHeuristicExtractor();
      return res.json({
        detectedItems: heuristicResults,
        rationale: heuristicResults.length
          ? `Detected ${heuristicResults.length} actionable item(s) from your reflection thoughts.`
          : "No unfinished commitments found in this entry.",
      });
    }

    const prompt = `You are a high-precision, empathetic Smart Completion & Reminder Assistant for personal journaling.
Analyze this single completed journal entry to detect actionable items, unfinished tasks, commitments, upcoming deadlines, appointments, and personal objectives.

CURRENT REFERENCE DATE: "${referenceDate}"
ENTRY DATE: "${entryDate}"
EXISTING TASK/OBJECTIVE TITLES TO AVOID DUPLICATES:
${JSON.stringify(existingTitles)}

USER'S JOURNAL ENTRY:
"""
${trimmedText}
"""

CRITICAL INSTRUCTIONS:
1. DETECT UNFINISHED ITEMS:
   - Tasks that still need to be completed
   - Things the user said they need to do later
   - Commitments or promises made to self or others
   - Upcoming deadlines
   - Meetings, syncs, or appointments
   - Events mentioned in the entry
   - Follow-ups that should happen
   - Personal goals or objectives
   - Submissions, applications, assignments, projects, or documents to submit
   - Any clearly unfinished activity

2. STRICTLY AVOID FALSE POSITIVES:
   - DO NOT mark past accomplishments as unfinished tasks. (e.g. "I went to the library yesterday" -> DO NOT extract; "I need to return the library book next Friday" -> EXTRACT).
   - DO NOT convert general philosophical musings or emotional expressions into tasks.

3. INTELLIGENT REMINDER & CATEGORIZATION:
   - "suggestedType":
     * "calendar": If it has a specific time or is an event, meeting, appointment, doctor visit, or scheduled session.
     * "reminder": If it is a deadline, submission, phone call, or task tied to a specific day.
     * "objective": If it represents a broader project, multiday assignment, or personal milestone (e.g., "prepare presentation for Monday", "finish final report").
   - Calculate exact "YYYY-MM-DD" based on Reference Date "${referenceDate}".
     * "tomorrow" -> calculate next calendar day
     * "Monday" / "next Monday" -> calculate exact date
     * "Friday at 10 AM" -> calculate exact date and time "10:00"
   - AMBIGUOUS DATES:
     * If an item has an uncertain deadline (e.g., "need to finish presentation" without stating when), set "isAmbiguousDate": true, "date": null, and provide a gentle conversational "clarificationPrompt" such as "When would you like to complete this?"
     * Do NOT ask questions if the date/time is already clearly stated.

4. DUPLICATE CHECK:
   - If a detected task is essentially identical to one of the existing titles provided, mark "isDuplicate": true.

Respond strictly in valid JSON matching this schema:
{
  "detectedItems": [
    {
      "title": "Short, clear task title (e.g. 'Submit project report', 'Prepare presentation')",
      "category": "task | deadline | commitment | meeting | appointment | event | goal | submission | follow_up",
      "date": "YYYY-MM-DD or null",
      "time": "HH:mm or null",
      "relativeDateText": "e.g. 'tomorrow', 'Monday', or null",
      "isAmbiguousDate": false,
      "clarificationPrompt": "Contextual question if ambiguous, or null",
      "suggestedType": "reminder | calendar | objective",
      "suggestedReminder": "e.g. 'Reminder: Submit project report — Tomorrow'",
      "confidenceReason": "Short quote or phrase from journal demonstrating user's intention",
      "priority": "low | medium | high",
      "isDuplicate": false
    }
  ],
  "rationale": "A warm, concise 1-sentence note summarizing the assistant's observations."
}`;

    const systemInstruction =
      "You are a precise JSON-only journal action item extractor. Output valid raw JSON only, without markdown code fences or conversational text.";

    const result = await generateContentWithFallback(prompt, systemInstruction);
    let parsed: any = {};
    try {
      let cleanJson = result.text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "").trim();
      }
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = {
        detectedItems: runHeuristicExtractor(),
        rationale: "Extracted actionable items using contextual journal parsing.",
      };
    }

    const detected = Array.isArray(parsed.detectedItems) ? parsed.detectedItems : [];
    // Ensure every item has a unique id
    const finalItems = detected.map((item: any, idx: number) => ({
      id: item.id || `action_${Date.now()}_${idx}`,
      title: item.title || "Action Item",
      category: item.category || "task",
      date: item.date || null,
      time: item.time || null,
      relativeDateText: item.relativeDateText || null,
      isAmbiguousDate: Boolean(item.isAmbiguousDate),
      clarificationPrompt: item.clarificationPrompt || null,
      suggestedType: item.suggestedType || "reminder",
      suggestedReminder: item.suggestedReminder || null,
      confidenceReason: item.confidenceReason || null,
      priority: item.priority || "medium",
      isDuplicate: Boolean(item.isDuplicate),
    }));

    res.json({
      detectedItems: finalItems,
      rationale: parsed.rationale || (finalItems.length ? "Identified actionable items to help you follow through." : "No unfinished commitments detected."),
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/extract-action-items:", error);
    res.status(500).json({
      error: error?.message || "Failed to extract action items from reflection.",
    });
  }
});

// ----------------------------------------------------------------------
// 1. AI SCRAPBOOK GENERATION ENDPOINT
// ----------------------------------------------------------------------
app.post("/api/gemini/generate-scrapbook", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { reflection, preferredTemplate } = body;

    if (!reflection || !reflection.id) {
      return res.status(400).json({ error: "reflection object is required" });
    }

    const messagesText = Array.isArray(reflection.messages)
      ? reflection.messages.map((m: any) => `${m.role}: ${m.content}`).join("\n")
      : "";
    const fullText = [reflection.title || "", reflection.summary || "", messagesText].join("\n\n");

    const prompt = `You are a creative scrapbook curator and memory designer. Analyze this journal entry:

Date: ${reflection.date || "Unknown"}
Title: ${reflection.title || "Reflection"}
Mood: ${reflection.mood || "reflective"}
Content:
"""
${fullText.slice(0, 4000)}
"""

Extract structured memory details and suggest visual scrapbook design elements.
Return STRICT JSON matching this schema:
{
  "mainEvent": "Brief phrase describing primary event or theme",
  "location": "City, place, or venue mentioned if any, or null",
  "peopleMentioned": ["Names of people mentioned"],
  "importantMoments": ["1-3 key memorable moments"],
  "mood": "dominant emotional tone",
  "keyQuotes": ["1-2 impactful quotes or sentences from the entry"],
  "activities": ["Activities or actions taken"],
  "highlights": ["1-3 highlights"],
  "whatILearned": "Key lesson or insight learned, or null",
  "progressPercent": 100, // estimated 0-100 progress if project/goal related
  "favoriteMoment": "Single standout favorite moment sentence",
  "recommendedTemplate": "travel" | "achievement" | "personal" | "celebration" | "classic" | "photo_story" | "idea_board" | "project_diary",
  "designRationale": "1-2 sentences on why this aesthetic fits the memory",
  "stickers": ["3-5 recommended emoji stickers e.g. ✈️, ⭐, 🌿, ☕, 🏆"],
  "accentColor": "#hexColor"
}`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const result = await generateContentWithFallback(
      contents,
      "You are an expert visual memory designer. Respond ONLY with a valid JSON object. No Markdown formatting around the JSON."
    );

    let parsed: any = {};
    try {
      const cleaned = result.text.replace(/```json\s*|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("Failed to parse scrapbook AI output as JSON, using heuristics:", parseErr);
    }

    const templateId = preferredTemplate || parsed.recommendedTemplate || "classic";
    const metadata = {
      mainEvent: parsed.mainEvent || reflection.title || "Cherished Journal Memory",
      date: reflection.date || new Date().toISOString().split("T")[0],
      location: parsed.location || undefined,
      peopleMentioned: parsed.peopleMentioned || [],
      importantMoments: parsed.importantMoments || [],
      mood: parsed.mood || reflection.mood || "reflective",
      keyQuotes: parsed.keyQuotes || [reflection.title || "A day to remember."],
      activities: parsed.activities || [],
      highlights: parsed.highlights || [],
      whatILearned: parsed.whatILearned || undefined,
      progressPercent: parsed.progressPercent || 100,
      favoriteMoment: parsed.favoriteMoment || parsed.keyQuotes?.[0] || "A quiet meaningful moment.",
    };

    // Build visual elements based on the template
    const elements: any[] = [];
    let z = 1;

    // Header title
    elements.push({
      id: "elem_title",
      type: "text",
      x: 48,
      y: 48,
      width: 680,
      height: 56,
      rotation: 0,
      zIndex: z++,
      content: reflection.title || metadata.mainEvent,
      style: {
        fontFamily: "Playfair Display",
        fontSize: 32,
        fontWeight: "bold",
        color: "#1c1917",
      },
    });

    // Date & Location badge
    if (metadata.location) {
      elements.push({
        id: "elem_loc_badge",
        type: "badge",
        x: 48,
        y: 112,
        width: 220,
        height: 38,
        rotation: -1,
        zIndex: z++,
        content: `📍 ${metadata.location}`,
        stampVariant: "badge",
        stampColor: "#059669",
        style: {
          fontFamily: "Plus Jakarta Sans",
          fontSize: 13,
          fontWeight: "bold",
          color: "#065f46",
          backgroundColor: "#ecfdf5",
          borderColor: "#a7f3d0",
          borderWidth: 1,
          borderRadius: 20,
        },
      });
    }

    elements.push({
      id: "elem_date_stamp",
      type: "text",
      x: metadata.location ? 280 : 48,
      y: 114,
      width: 180,
      height: 34,
      rotation: 0,
      zIndex: z++,
      content: `📅 ${metadata.date}`,
      style: {
        fontFamily: "Courier Prime",
        fontSize: 13,
        color: "#78716c",
      },
    });

    // Default primary photo placeholder
    const samplePhotos = [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    ];

    elements.push({
      id: "elem_hero_photo",
      type: "image",
      x: 48,
      y: 165,
      width: 340,
      height: 280,
      rotation: -2,
      zIndex: z++,
      imageUrl: samplePhotos[templateId === "achievement" ? 2 : templateId === "travel" ? 1 : 0],
      caption: metadata.location ? `Memories in ${metadata.location}` : "Cherished snapshot",
      photoStyle: "polaroid",
    });

    // Washi tape on hero photo
    elements.push({
      id: "elem_tape_1",
      type: "tape",
      x: 160,
      y: 155,
      width: 120,
      height: 26,
      rotation: 2,
      zIndex: z++,
      tapeColor: "rgba(254, 243, 199, 0.85)",
    });

    // Story narrative card
    const storySnippet = fullText.slice(0, 380) || "A tranquil chapter in my personal journey.";
    elements.push({
      id: "elem_story_card",
      type: "quote_card",
      x: 415,
      y: 165,
      width: 350,
      height: 190,
      rotation: 1,
      zIndex: z++,
      content: storySnippet,
      cardVariant: "pinned",
      style: {
        fontFamily: "Newsreader",
        fontSize: 15,
        color: "#292524",
        backgroundColor: "#fffbeb",
        borderColor: "#fde68a",
        borderWidth: 1,
        borderRadius: 12,
      },
    });

    // Highlight or quote callout
    if (metadata.keyQuotes && metadata.keyQuotes[0]) {
      elements.push({
        id: "elem_quote_highlight",
        type: "quote_card",
        x: 415,
        y: 375,
        width: 350,
        height: 95,
        rotation: -1,
        zIndex: z++,
        content: `"${metadata.keyQuotes[0]}"`,
        cardVariant: "highlight",
        style: {
          fontFamily: "Newsreader",
          fontStyle: "italic",
          fontSize: 15,
          color: "#78350f",
          backgroundColor: "#fef3c7",
          borderColor: "#fde68a",
          borderWidth: 1,
          borderRadius: 10,
        },
      });
    }

    // Recommended stickers
    const stickersList = Array.isArray(parsed.stickers) && parsed.stickers.length > 0 ? parsed.stickers : ["✨", "🌿", "⭐"];
    stickersList.slice(0, 3).forEach((stk: string, idx: number) => {
      elements.push({
        id: `elem_stk_${idx}`,
        type: "sticker",
        x: 370 + idx * 130,
        y: 490,
        width: 44,
        height: 44,
        rotation: (idx % 2 === 0 ? 1 : -1) * (6 + idx * 3),
        zIndex: z++,
        content: stk,
      });
    });

    const aiSuggestions = [
      {
        id: "sug_1",
        type: "add_moment",
        label: "Feature Top Moment",
        description: "Emphasize your favorite moment with an illuminated polaroid border.",
        applied: false,
      },
      {
        id: "sug_2",
        type: "collage",
        label: "Mosaic Photo Grid",
        description: "Arrange 3 companion photos in a nostalgic vintage layout.",
        applied: false,
      },
      {
        id: "sug_3",
        type: "connect_graph",
        label: "Connect to Life Graph",
        description: `Link with related entities like ${metadata.peopleMentioned?.[0] || metadata.location || "Projects"}.`,
        applied: false,
      },
    ];

    const scrapbook = {
      id: `scrapbook_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: reflection.userId,
      sourceReflectionId: reflection.id,
      sourceReflectionTitle: reflection.title,
      title: reflection.title || metadata.mainEvent,
      date: metadata.date,
      template: templateId,
      memoryType: templateId === "travel" ? "travel" : templateId === "achievement" ? "achievement" : templateId === "celebration" ? "celebration" : templateId === "personal" ? "personal" : "general",
      paperStyle: templateId === "travel" ? "kraft_paper" : templateId === "personal" ? "watercolor_blush" : "cream_linen",
      elements,
      metadata,
      lifeGraphNodeIds: [],
      aiSuggestions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.json({ scrapbook, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.error("Error in /api/gemini/generate-scrapbook:", error);
    res.status(500).json({ error: error?.message || "Failed to generate AI scrapbook." });
  }
});

// ----------------------------------------------------------------------
// 2. LIFE GRAPH EXTRACTION ENDPOINT
// ----------------------------------------------------------------------
app.post("/api/gemini/extract-life-graph", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { reflections = [], existingEntityNames = [] } = body;

    if (!Array.isArray(reflections) || reflections.length === 0) {
      return res.status(400).json({ error: "reflections array is required" });
    }

    const prompt = `You are a knowledge graph architect specializing in personal memory systems.
Analyze these journal entries:
${JSON.stringify(reflections.slice(0, 15), null, 2)}

Identify all significant interconnected life entities:
- Projects (creative or technical endeavors)
- People (friends, family, mentors, collaborators)
- Places (cities, travel locations, workspaces)
- Goals / Objectives (aspirations, milestones)
- Topics / Hobbies (themes, writing, sports)
- Events / Achievements

Known existing entities: ${JSON.stringify(existingEntityNames)}

Return STRICT JSON matching this schema:
{
  "entities": [
    {
      "name": "Unique Name",
      "type": "project" | "person" | "place" | "goal" | "objective" | "event" | "topic" | "hobby" | "idea" | "achievement",
      "description": "Concise summary of their role or essence in the user's life",
      "firstMentionedDate": "YYYY-MM-DD",
      "lastMentionedDate": "YYYY-MM-DD",
      "reflectionIds": ["matching reflection IDs"],
      "evolutionTimeline": [
        {
          "date": "YYYY-MM-DD",
          "monthLabel": "e.g. Mar 2026",
          "stage": "e.g. Conception | First Prototype | Collaborative Launch",
          "note": "What happened at this stage",
          "reflectionId": "matching ID"
        }
      ]
    }
  ],
  "relationships": [
    {
      "sourceEntityName": "Entity A",
      "targetEntityName": "Entity B",
      "label": "e.g. collaborates on | visited in | sub-goal of | inspired by",
      "strength": 1 to 5,
      "reflectionIds": ["reflection IDs supporting connection"]
    }
  ]
}`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const result = await generateContentWithFallback(
      contents,
      "Respond ONLY with a valid JSON object matching the requested schema. No Markdown wrappers."
    );

    let parsed: any = { entities: [], relationships: [] };
    try {
      const cleaned = result.text.replace(/```json\s*|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("Failed to parse life graph JSON from AI:", parseErr);
    }

    // Map entity names to IDs for relationships
    const entities = (parsed.entities || []).map((e: any, idx: number) => ({
      id: `node_${Date.now()}_${idx}`,
      userId: reflections[0]?.userId || "user",
      name: e.name,
      type: e.type || "topic",
      description: e.description || "",
      firstMentionedDate: e.firstMentionedDate || reflections[0]?.date || new Date().toISOString().split("T")[0],
      lastMentionedDate: e.lastMentionedDate || reflections[0]?.date || new Date().toISOString().split("T")[0],
      reflectionIds: e.reflectionIds || [],
      evolutionTimeline: e.evolutionTimeline || [],
      stats: { entryCount: (e.reflectionIds || []).length || 1 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const nameToId = new Map<string, string>();
    entities.forEach((ent: any) => nameToId.set(ent.name.toLowerCase().trim(), ent.id));

    const relationships = (parsed.relationships || [])
      .map((rel: any, idx: number) => {
        const sourceId = nameToId.get(rel.sourceEntityName?.toLowerCase().trim());
        const targetId = nameToId.get(rel.targetEntityName?.toLowerCase().trim());
        if (!sourceId || !targetId || sourceId === targetId) return null;
        return {
          id: `rel_${Date.now()}_${idx}`,
          userId: reflections[0]?.userId || "user",
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          label: rel.label || "connected with",
          type: "inferred",
          strength: rel.strength || 1,
          reflectionIds: rel.reflectionIds || [],
          createdAt: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    res.json({ entities, relationships, modelUsed: result.modelUsed });
  } catch (error: any) {
    console.error("Error in /api/gemini/extract-life-graph:", error);
    res.status(500).json({ error: error?.message || "Failed to extract Life Graph." });
  }
});

// ----------------------------------------------------------------------
// 3. LIFE GRAPH NATURAL LANGUAGE QUERY ENDPOINT
// ----------------------------------------------------------------------
app.post("/api/gemini/query-life-graph", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { query = "", entities = [], reflections = [] } = body;

    if (!query.trim()) {
      return res.status(400).json({ error: "query string is required" });
    }

    const prompt = `You are the user's personal Life Graph reasoning assistant.
The user is querying their interconnected journal memory graph.

User Query: "${query}"

Knowledge Graph Entities:
${JSON.stringify(entities.slice(0, 30), null, 2)}

Recent Journal Reflections:
${JSON.stringify(reflections.slice(0, 20), null, 2)}

Synthesize a comprehensive, empathetic, and evidence-backed response answering the user's query.
Identify matching entity IDs and reflection IDs as citations.

Return STRICT JSON matching this schema:
{
  "answer": "Clear Markdown answer directly answering the question with dates and context.",
  "matchingEntityIds": ["List of entity IDs directly relevant"],
  "matchingReflectionIds": ["List of reflection IDs cited"],
  "citations": [
    {
      "reflectionId": "id",
      "title": "Title of entry",
      "excerpt": "Specific sentence or detail from the entry"
    }
  ],
  "suggestedNodes": ["Entity names to explore next in the graph"]
}`;

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const result = await generateContentWithFallback(
      contents,
      "Respond ONLY with a valid JSON object matching the requested schema. No Markdown wrappers."
    );

    let parsed: any = {};
    try {
      const cleaned = result.text.replace(/```json\s*|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn("Failed to parse Life Graph query JSON:", parseErr);
      parsed = {
        answer: result.text,
        matchingEntityIds: [],
        matchingReflectionIds: [],
        citations: [],
        suggestedNodes: [],
      };
    }

    res.json({
      query,
      answer: parsed.answer || result.text,
      matchingEntityIds: parsed.matchingEntityIds || [],
      matchingReflectionIds: parsed.matchingReflectionIds || [],
      citations: parsed.citations || [],
      suggestedNodes: parsed.suggestedNodes || [],
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/query-life-graph:", error);
    res.status(500).json({ error: error?.message || "Failed to query Life Graph." });
  }
});



// Boot server with Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ReflectAI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
