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
