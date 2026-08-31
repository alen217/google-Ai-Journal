import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { 
  MoodType, 
  AIServiceMode, 
  JournalMessage, 
  ReflectionDoc, 
  UserProfile 
} from "../types";
import { MOODS, POPULAR_TAGS, JOURNALING_PROMPTS } from "../lib/constants";
import { persistReflection, getTodayDateString } from "../lib/firebase";
import { encryptPayload } from "../lib/encryption";
import { 
  Sparkles, 
  Send, 
  Save, 
  Lock, 
  ShieldCheck, 
  Flame, 
  ArrowLeft, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Brain, 
  FileText, 
  Lightbulb, 
  Compass,
  Tag,
  Smile
} from "lucide-react";

interface JournalEditorProps {
  initialDoc?: ReflectionDoc | null;
  userProfile: UserProfile;
  encryptionKey: CryptoKey | null;
  onBack: () => void;
  onSaved: (savedDoc: ReflectionDoc, updatedProfile: UserProfile, streakIncremented: boolean) => void;
  onOpenEncryptionSettings: () => void;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  initialDoc,
  userProfile,
  encryptionKey,
  onBack,
  onSaved,
  onOpenEncryptionSettings,
}) => {
  // Document state
  const [docId] = useState<string>(
    initialDoc?.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [title, setTitle] = useState<string>(initialDoc?.title || "");
  const [selectedMood, setSelectedMood] = useState<MoodType>(initialDoc?.mood || "reflective");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialDoc?.tags || ["Personal Growth"]);
  const [customTagInput, setCustomTagInput] = useState("");
  
  // Conversational turns
  const [messages, setMessages] = useState<JournalMessage[]>(
    initialDoc?.messages || []
  );
  const [inputPrompt, setInputPrompt] = useState("");
  const [aiMode, setAiMode] = useState<AIServiceMode>("reflect");
  
  // AI summary & action items
  const [summary, setSummary] = useState<string>(initialDoc?.summary || "");
  const [actionItems, setActionItems] = useState<string[]>(initialDoc?.actionItems || []);
  const [keyEmotions, setKeyEmotions] = useState<string[]>(initialDoc?.keyEmotions || []);

  // UI state
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiGenerating]);

  // Insert a quick prompt into the input
  const handleUsePrompt = (promptText: string) => {
    setInputPrompt((prev) => (prev ? `${prev}\n\n${promptText}` : promptText));
  };

  // Toggle tag
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTagInput.trim()) {
      e.preventDefault();
      const cleanTag = customTagInput.trim();
      if (!selectedTags.includes(cleanTag)) {
        setSelectedTags((prev) => [...prev, cleanTag]);
      }
      setCustomTagInput("");
    }
  };

  // Send turn to Gemini AI
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isAiGenerating) return;

    const userText = inputPrompt.trim();
    setInputPrompt("");
    setAiError(null);

    const userMessage: JournalMessage = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsAiGenerating(true);

    try {
      const response = await fetch("/api/gemini/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          mode: aiMode,
          mood: MOODS[selectedMood].label,
          tags: selectedTags,
          userPrompt: userText,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI reflection");
      }

      const modelMessage: JournalMessage = {
        id: `msg_${Date.now()}_m`,
        role: "model",
        content: data.reply || "Thank you for sharing your thoughts with me.",
        timestamp: data.timestamp || new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      setMessages((prev) => [...prev, modelMessage]);

      // If no title yet, set a sensible default or trigger quick analysis
      if (!title) {
        const words = userText.split(" ").slice(0, 5).join(" ");
        setTitle(words ? `${words}...` : "Daily Reflection");
      }
    } catch (err: any) {
      console.error("Gemini AI error:", err);
      setAiError(err?.message || "Failed to connect to Gemini AI.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Trigger Gemini Deep Analysis (auto-title, summary, takeaways)
  const handleGenerateAnalysis = async () => {
    const fullText = messages.map((m) => `${m.role === "user" ? "User" : "Gemini"}: ${m.content}`).join("\n\n");
    if (!fullText.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: fullText,
          currentMood: selectedMood,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        if (data.suggestedTitle && (!title || title.endsWith("..."))) {
          setTitle(data.suggestedTitle);
        }
        if (data.summary) setSummary(data.summary);
        if (Array.isArray(data.actionTakeaways) && data.actionTakeaways.length) {
          setActionItems(data.actionTakeaways);
        }
        if (Array.isArray(data.keyEmotions)) {
          setKeyEmotions(data.keyEmotions);
        }
      }
    } catch (err) {
      console.warn("Analysis notice:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save Reflection with persistence & encryption check
  const handleSaveDoc = async () => {
    if (!messages.length && !inputPrompt.trim()) {
      setSaveError("Please write at least one thought before saving.");
      return;
    }

    // If input has unsent text, include it
    let currentMessages = [...messages];
    if (inputPrompt.trim()) {
      currentMessages.push({
        id: `msg_${Date.now()}_u`,
        role: "user",
        content: inputPrompt.trim(),
        timestamp: new Date().toISOString(),
      });
      setInputPrompt("");
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const isEncrypted = Boolean(userProfile.e2eeEnabled);
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let messagesToSave = currentMessages;
      let summaryToSave = summary;

      if (isEncrypted) {
        if (!encryptionKey) {
          onOpenEncryptionSettings();
          throw new Error("Please unlock your encryption vault before saving encrypted reflections.");
        }

        // Package and encrypt the sensitive contents
        const payloadToEncrypt = JSON.stringify({
          messages: currentMessages,
          summary,
          actionItems,
          keyEmotions,
        });

        const encrypted = await encryptPayload(payloadToEncrypt, encryptionKey);
        encryptedData = encrypted.ciphertext;
        iv = encrypted.iv;
        // In Firestore, store placeholder in plain message fields
        messagesToSave = [
          {
            id: "encrypted_payload",
            role: "user",
            content: "[🔒 AES-GCM 256-Bit Encrypted Content]",
            timestamp: new Date().toISOString(),
          },
        ];
        summaryToSave = "[🔒 End-to-End Encrypted Summary]";
      }

      const docToPersist: ReflectionDoc = {
        id: docId,
        userId: userProfile.uid,
        title: title.trim() || `${MOODS[selectedMood].label} Reflection`,
        date: initialDoc?.date || getTodayDateString(),
        createdAt: initialDoc?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mood: selectedMood,
        moodScore: MOODS[selectedMood].score,
        tags: selectedTags,
        isEncrypted,
        encryptedData,
        iv,
        messages: isEncrypted ? currentMessages : messagesToSave, // Keep clean in local memory
        summary,
        actionItems,
        keyEmotions,
      };

      const result = await persistReflection(
        {
          ...docToPersist,
          messages: messagesToSave,
          summary: summaryToSave,
        },
        userProfile
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

      onSaved(docToPersist, result.updatedProfile, result.streakIncremented);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err?.message || "Failed to save reflection to Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Top Bar Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button
            id="editor-back-btn"
            onClick={onBack}
            className="p-2 rounded-xl text-stone-600 hover:text-stone-950 hover:bg-stone-200/70 transition-colors"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              {initialDoc ? "Editing Reflection" : "New Reflection Entry"}
            </span>
            <input
              id="editor-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title your reflection or let Gemini suggest one..."
              className="block w-full text-xl sm:text-2xl font-bold text-stone-900 bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-stone-400 font-['Newsreader'] italic"
            />
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* E2EE indicator badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs font-medium text-stone-700">
            {userProfile.e2eeEnabled ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-800 font-semibold">E2EE Protected</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-stone-400" />
                <span>Standard Firestore</span>
              </>
            )}
          </div>

          {/* Save Button */}
          <button
            id="editor-save-btn"
            onClick={handleSaveDoc}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 font-semibold text-sm shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-4 h-4 text-amber-400" />
            )}
            <span>{isSaving ? "Saving..." : saveSuccess ? "Saved to Firestore" : "Save Entry"}</span>
          </button>
        </div>
      </div>

      {/* Save Error Alert */}
      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={handleSaveDoc}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            Retry Save
          </button>
        </div>
      )}

      {/* Mood Selector Row */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-amber-600" />
            How are you feeling right now?
          </label>
          <span className="text-xs text-stone-500 font-medium">
            Tagged: <strong className="text-stone-800">{MOODS[selectedMood].label}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(Object.keys(MOODS) as MoodType[]).map((moodKey) => {
            const mood = MOODS[moodKey];
            const isSelected = selectedMood === moodKey;
            return (
              <button
                key={moodKey}
                id={`mood-btn-${moodKey}`}
                type="button"
                onClick={() => setSelectedMood(moodKey)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? `${mood.bgClass} ${mood.borderClass} ring-2 ring-amber-400/50 shadow-sm scale-102 font-bold`
                    : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <span className="text-lg">{mood.emoji}</span>
                <span className="truncate w-full text-center">{mood.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags Selector */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-amber-600" />
            Life Areas & Themes
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {POPULAR_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-semibold"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-transparent"
                }`}
              >
                {isSelected ? `✓ ${tag}` : `+ ${tag}`}
              </button>
            );
          })}

          {/* Custom tag input */}
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={handleAddCustomTag}
            placeholder="+ Add custom tag (Enter)..."
            className="px-3 py-1 text-xs rounded-lg border border-dashed border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-stone-50 text-stone-700 placeholder:text-stone-400"
          />
        </div>
      </div>

      {/* AI Mode Selector */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 rounded-2xl p-4 text-stone-100 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold tracking-tight font-['Plus_Jakarta_Sans']">
              Gemini AI Conversation Mode
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAiMode("reflect")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                aiMode === "reflect"
                  ? "bg-amber-400 text-stone-950 font-bold shadow-sm"
                  : "bg-stone-800 text-stone-300 hover:bg-stone-700"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Mindful Reflection
            </button>
            <button
              type="button"
              onClick={() => setAiMode("summarize")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                aiMode === "summarize"
                  ? "bg-amber-400 text-stone-950 font-bold shadow-sm"
                  : "bg-stone-800 text-stone-300 hover:bg-stone-700"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Executive Summary
            </button>
            <button
              type="button"
              onClick={() => setAiMode("brainstorm")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                aiMode === "brainstorm"
                  ? "bg-amber-400 text-stone-950 font-bold shadow-sm"
                  : "bg-stone-800 text-stone-300 hover:bg-stone-700"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Brainstorm Solutions
            </button>
            <button
              type="button"
              onClick={() => setAiMode("coaching")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                aiMode === "coaching"
                  ? "bg-amber-400 text-stone-950 font-bold shadow-sm"
                  : "bg-stone-800 text-stone-300 hover:bg-stone-700"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Mindful Coach
            </button>
          </div>
        </div>
      </div>

      {/* Prompts Inspo Carousel */}
      {messages.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
          <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            Looking for inspiration to start writing? Click any prompt:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {JOURNALING_PROMPTS.slice(0, 4).map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleUsePrompt(p)}
                className="text-left p-2.5 rounded-xl bg-white/80 hover:bg-white text-xs text-stone-700 hover:text-stone-950 border border-amber-200/60 transition-colors shadow-2xs"
              >
                &ldquo;{p}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversational Stream & Message History */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-6 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="py-12 text-center text-stone-400 space-y-2">
            <Compass className="w-10 h-10 mx-auto text-stone-300" />
            <p className="text-sm font-medium text-stone-600 font-['Newsreader'] italic text-lg">
              Begin your reflection below. Share what happened, how you felt, or questions weighing on your heart.
            </p>
            <p className="text-xs text-stone-400">
              Gemini will listen attentively and provide mindful perspective.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex gap-3.5 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "model" && (
                  <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-bold shrink-0 shadow-sm mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-stone-900 text-stone-100 rounded-br-xs shadow-sm"
                      : "bg-stone-50 text-stone-800 border border-stone-200/90 rounded-bl-xs shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-stone-700/20 text-[11px] opacity-75">
                    <span className="font-semibold">
                      {msg.role === "user" ? "Your Reflection" : "Gemini Reflection"}
                    </span>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="prose prose-stone max-w-none prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>

                {msg.role === "user" && userProfile.photoURL && (
                  <img
                    src={userProfile.photoURL}
                    alt="User"
                    className="w-8 h-8 rounded-full border border-stone-300 shrink-0 mt-1 object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            ))}

            {isAiGenerating && (
              <div className="flex gap-3.5 items-center text-stone-500 text-sm">
                <div className="w-8 h-8 rounded-xl bg-amber-500/80 flex items-center justify-center text-stone-950 shrink-0 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent"></span>
                  <span>Gemini is reflecting thoughtfully on your thoughts...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* AI Error Alert */}
        {aiError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Input Box Form */}
        <form onSubmit={handleSendMessage} className="pt-4 border-t border-stone-100 space-y-3">
          <div className="relative">
            <textarea
              id="editor-prompt-textarea"
              rows={4}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your reflection or response here... (Press Cmd+Enter or click Send to converse with Gemini)"
              className="w-full p-4 rounded-2xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50/50 text-stone-900 text-sm leading-relaxed placeholder:text-stone-400 resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-stone-400 hidden sm:block">
              Tip: <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border text-[10px]">Cmd+Enter</kbd> to reflect with Gemini
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleGenerateAnalysis}
                  disabled={isAnalyzing}
                  className="px-3 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Generate structured executive summary and key takeaways"
                >
                  <Brain className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isAnalyzing ? "Analyzing..." : "Auto-Summary"}</span>
                </button>
              )}

              <button
                id="editor-send-btn"
                type="submit"
                disabled={isAiGenerating || !inputPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Reflect with AI</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Summary & Key Action Items Section (if available) */}
      {(summary || actionItems.length > 0) && (
        <div className="bg-amber-50/80 rounded-3xl p-6 border border-amber-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-700" />
            <h3 className="text-base font-bold text-amber-950 font-['Plus_Jakarta_Sans']">
              AI Journal Synthesis & Takeaways
            </h3>
          </div>

          {summary && (
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                Executive Reflection
              </h4>
              <p className="text-sm text-stone-700 leading-relaxed font-['Newsreader'] italic">
                {summary}
              </p>
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="pt-2 border-t border-amber-200/70">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
                Empowering Action Steps
              </h4>
              <ul className="space-y-1.5">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-stone-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
