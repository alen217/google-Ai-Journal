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
