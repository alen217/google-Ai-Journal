import React, { useState, useMemo, useRef } from "react";
import { 
  ReflectionDoc, 
  UserProfile, 
  MoodType, 
  AppView, 
  AIServiceMode, 
  JournalMessage 
} from "../types";
import { 
  MOODS, 
  STREAK_MILESTONES 
} from "../lib/constants";
import { 
  persistReflection, 
  getTodayDateString 
} from "../lib/firebase";
import { encryptPayload } from "../lib/encryption";
import { VoiceDictationBar } from "./VoiceDictationBar";
import { 
  Sparkles, 
  Flame, 
  PlusCircle, 
  BookOpen, 
  Smile, 
  ShieldCheck, 
  Lock, 
  Compass, 
  ArrowRight, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Mic, 
  Search, 
  Filter, 
  Download, 
  ArrowUpRight, 
  BarChart3, 
  Award, 
  Check, 
  RefreshCw, 
  Send, 
  AlertCircle, 
  X, 
  ChevronRight, 
  MessageSquare,
  FileText,
  Heart,
  SlidersHorizontal,
  Palette
} from "lucide-react";

interface DashboardProps {
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  onStartNewReflection: (starterPrompt?: string, mood?: MoodType) => void;
  onOpenReflection: (doc: ReflectionDoc) => void;
  onNavigate: (view: AppView) => void;
  onOpenEncryptionSettings: () => void;
  isEncryptedUnlocked: boolean;
  onReflectionSaved?: (
    savedDoc: ReflectionDoc, 
    updatedProfile: UserProfile, 
    streakIncremented: boolean
  ) => void;
  encryptionKey?: CryptoKey | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  userProfile,
  reflections,
  onStartNewReflection,
  onOpenReflection,
  onNavigate,
  onOpenEncryptionSettings,
  isEncryptedUnlocked,
  onReflectionSaved,
  encryptionKey,
}) => {
  // -------------------------------------------------------------
  // 1. TOP ENTRY COMPOSER STATE
  // -------------------------------------------------------------
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [selectedMood, setSelectedMood] = useState<MoodType>("reflective");
  const [selectedMode, setSelectedMode] = useState<AIServiceMode>("reflect");
  
  // In-place AI conversation state
  const [conversation, setConversation] = useState<JournalMessage[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiActionItems, setAiActionItems] = useState<string[]>([]);
  const [aiKeyEmotions, setAiKeyEmotions] = useState<string[]>([]);
  
  // Status flags
  const [isReflectingWithAI, setIsReflectingWithAI] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // -------------------------------------------------------------
  // 2. VISUAL DETAILS & FILTER STATE
  // -------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<string>("all");

  // Streak details
  const currentStreak = userProfile.currentStreak || 0;
  const longestStreak = userProfile.longestStreak || 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m.days > currentStreak) || null;
  const previousMilestone = [...STREAK_MILESTONES].reverse().find((m) => m.days <= currentStreak) || null;

  // Milestone progress calculation
  const milestoneProgress = useMemo(() => {
    if (!nextMilestone) return 100;
    const baseDays = previousMilestone ? previousMilestone.days : 0;
    const targetDays = nextMilestone.days;
    const progress = ((currentStreak - baseDays) / (targetDays - baseDays)) * 100;
    return Math.min(100, Math.max(5, Math.round(progress)));
  }, [currentStreak, nextMilestone, previousMilestone]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Today formatted
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  // -------------------------------------------------------------
  // 3. VISUAL ANALYTICS CALCULATIONS
  // -------------------------------------------------------------
  // Mood frequency breakdown
  const moodDistribution = useMemo(() => {
    if (!reflections.length) return [];
    const counts: Record<string, number> = {};
    reflections.forEach((r) => {
      counts[r.mood] = (counts[r.mood] || 0) + 1;
    });

    return Object.entries(counts).map(([moodKey, count]) => {
      const moodMeta = MOODS[moodKey as MoodType] || MOODS.reflective;
      const percent = Math.round((count / reflections.length) * 100);
      return {
        mood: moodKey as MoodType,
        count,
        percent,
        label: moodMeta.label,
        emoji: moodMeta.emoji,
        bgClass: moodMeta.bgClass,
      };
    }).sort((a, b) => b.count - a.count);
  }, [reflections]);

  // Total words written across reflections
  const totalWordsWritten = useMemo(() => {
    return reflections.reduce((acc, r) => {
      const msgWords = (r.messages || []).reduce((wAcc, m) => {
        return wAcc + (m.content ? m.content.trim().split(/\s+/).length : 0);
      }, 0);
      return acc + msgWords;
    }, 0);
  }, [reflections]);

  // 30-Day Activity Heatmap Matrix
  const activityMap = useMemo(() => {
    const days = [];
    const reflectionDates = new Set(reflections.map((r) => r.date));
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const isLogged = reflectionDates.has(dateStr);
      days.push({
        dateStr,
        dayNum: d.getDate(),
        month: d.toLocaleDateString(undefined, { month: "short" }),
        isLogged,
        isToday: i === 0,
      });
    }
    return days;
  }, [reflections]);

  // Filtered recent reflections
  const filteredReflections = useMemo(() => {
    return reflections.filter((doc) => {
      if (moodFilter !== "all" && doc.mood !== moodFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title?.toLowerCase().includes(q);
        const matchSummary = doc.summary?.toLowerCase().includes(q);
        const matchMessages = (doc.messages || []).some((m) =>
          m.content.toLowerCase().includes(q)
        );
        const matchTags = (doc.tags || []).some((t) =>
          t.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchSummary && !matchMessages && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [reflections, moodFilter, searchQuery]);

  // -------------------------------------------------------------
  // 4. TOP COMPOSER HANDLERS
  // -------------------------------------------------------------
  // Fill starter prompt
  const handleSelectStarter = (starterText: string, moodHint?: MoodType) => {
    setEntryContent(starterText);
    if (moodHint) setSelectedMood(moodHint);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Trigger Gemini AI Reflection
  const handleReflectWithAI = async () => {
    if (!entryContent.trim()) {
      setComposerError("Please enter your reflection thoughts or speak before asking Gemini to reflect.");
      return;
    }

    setComposerError(null);
    setIsReflectingWithAI(true);

    const userMsg: JournalMessage = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      content: entryContent.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedConversation = [...conversation, userMsg];
    setConversation(updatedConversation);

    try {
      const res = await fetch("/api/gemini/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: entryContent.trim(),
          mode: selectedMode,
          mood: MOODS[selectedMood].label,
          conversationHistory: conversation.map((c) => ({
            role: c.role,
            content: c.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate reflection response.");
      }

      const aiMsg: JournalMessage = {
        id: `msg_${Date.now()}_ai`,
        role: "model",
        content: data.geminiReply || "I have received your reflection. How does it feel to name this?",
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      setConversation([...updatedConversation, aiMsg]);
      if (data.summary) setAiSummary(data.summary);
      if (data.actionItems) setAiActionItems(data.actionItems);
      if (data.keyEmotions) setAiKeyEmotions(data.keyEmotions);
      
      // Auto-set title if blank
      if (!entryTitle.trim()) {
        const firstWords = entryContent.trim().split(" ").slice(0, 5).join(" ");
        setEntryTitle(firstWords ? `${firstWords}...` : "Reflective Entry");
      }

      // Clear input so user can send follow-ups if desired
      setEntryContent("");
    } catch (err: any) {
      console.error("AI Reflection error:", err);
      setComposerError(err?.message || "Failed to generate AI reflection.");
    } finally {
      setIsReflectingWithAI(false);
    }
  };

  // Direct Save to Firestore
  const handleDirectSave = async () => {
    const textToSave = entryContent.trim();
    if (!textToSave && conversation.length === 0) {
      setComposerError("Please write or speak some thoughts before saving.");
      return;
    }

    setIsSavingEntry(true);
    setComposerError(null);

    try {
      // Build conversation messages
      let finalMessages = [...conversation];
      if (textToSave) {
        finalMessages.push({
          id: `msg_${Date.now()}_u`,
          role: "user",
          content: textToSave,
          timestamp: new Date().toISOString(),
        });
      }

      const docId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const titleToUse = entryTitle.trim() || 
        (textToSave ? `${textToSave.split(" ").slice(0, 5).join(" ")}...` : "Reflective Journal");

      let docPayload: ReflectionDoc = {
        id: docId,
        userId: userProfile.uid,
        title: titleToUse,
        date: getTodayDateString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mood: selectedMood,
        moodScore: MOODS[selectedMood].score,
        tags: ["Personal Reflection"],
        messages: finalMessages,
        summary: aiSummary || undefined,
        actionItems: aiActionItems.length ? aiActionItems : undefined,
        keyEmotions: aiKeyEmotions.length ? aiKeyEmotions : undefined,
        isEncrypted: Boolean(userProfile.e2eeEnabled),
      };

      // Client-Side Encryption if enabled
      if (userProfile.e2eeEnabled) {
        if (!encryptionKey) {
          onOpenEncryptionSettings();
          setIsSavingEntry(false);
          return;
        }

        const sensitiveData = JSON.stringify({
          messages: finalMessages,
          summary: docPayload.summary,
          actionItems: docPayload.actionItems,
          keyEmotions: docPayload.keyEmotions,
        });

        const encrypted = await encryptPayload(sensitiveData, encryptionKey);
        docPayload.encryptedData = encrypted.ciphertext;
        docPayload.iv = encrypted.iv;
        docPayload.messages = [];
        docPayload.summary = undefined;
        docPayload.actionItems = undefined;
        docPayload.keyEmotions = undefined;
      }

      const result = await persistReflection(docPayload, userProfile);

      if (onReflectionSaved) {
        onReflectionSaved(result.reflection, result.updatedProfile, result.streakIncremented);
      }

      // Reset Top Entry Composer
      setEntryTitle("");
      setEntryContent("");
      setConversation([]);
      setAiSummary(null);
      setAiActionItems([]);
      setAiKeyEmotions([]);
      setSaveSuccessNotice("✨ Reflection successfully saved to your private journal!");

      setTimeout(() => {
        setSaveSuccessNotice(null);
      }, 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      setComposerError(err?.message || "Failed to save reflection to Firestore.");
    } finally {
      setIsSavingEntry(false);
    }
  };

  // Export full markdown archive
  const handleExportMarkdown = () => {
    let md = `# ReflectAI Journal Archive\n`;
    md += `User: ${userProfile.displayName} (${userProfile.email})\n`;
    md += `Generated: ${new Date().toLocaleString()}\n`;
    md += `Total Reflections: ${reflections.length} | Current Streak: ${currentStreak} Days\n\n---\n\n`;

    reflections.forEach((doc, idx) => {
      const mood = MOODS[doc.mood]?.label || doc.mood;
      md += `## ${idx + 1}. ${doc.title || "Reflective Entry"}\n`;
      md += `**Date:** ${doc.date} | **Mood:** ${mood} | **Tags:** ${(doc.tags || []).join(", ") || "None"}\n\n`;

      if (doc.summary) {
        md += `> **Executive Summary:** ${doc.summary}\n\n`;
      }

      if (doc.messages && doc.messages.length) {
        md += `### Conversation & Reflection:\n`;
        doc.messages.forEach((m) => {
          md += `**${m.role === "user" ? "You" : "Gemini"}:** ${m.content}\n\n`;
        });
      }

      if (doc.actionItems && doc.actionItems.length) {
        md += `### Key Takeaways:\n`;
        doc.actionItems.forEach((item) => {
          md += `- ${item}\n`;
        });
        md += `\n`;
      }

      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reflectai-journal-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 animate-fade-in">

      {/* ========================================================= */}
      {/* 1. FIRST AT TOP: DIRECT ENTRY FOR THE JOURNAL             */}
      {/* ========================================================= */}
      <section id="top-journal-entry-section" className="space-y-4">
        
        {/* Top Greeting & Status Pill Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {formattedToday}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-['Newsreader'] italic text-stone-900 tracking-tight">
              {greeting}, {userProfile.displayName.split(" ")[0]}.
            </h1>
          </div>

          {/* Quick Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div 
              onClick={() => onNavigate("analytics")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/80 border border-amber-300/80 text-amber-900 text-xs font-bold cursor-pointer hover:bg-amber-200/80 transition-colors shadow-xs"
              title="Click to view full consistency analytics"
            >
              <Flame className={`w-4 h-4 ${currentStreak ? "fill-amber-500 text-amber-600 animate-pulse" : "text-stone-400"}`} />
              <span>{currentStreak} Day Streak</span>
            </div>

            <div 
              onClick={onOpenEncryptionSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium cursor-pointer hover:bg-stone-200 transition-colors"
              title="Click to view encryption security settings"
            >
              {userProfile.e2eeEnabled ? (
                isEncryptedUnlocked ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> E2EE Vault Active
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Vault Locked
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-500" /> Isolated Cloud Storage
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Primary Journal Reflection Composer Card */}
        <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm p-5 sm:p-7 space-y-5 transition-shadow hover:shadow-md">
          
          {/* Header row with Mood selector & Prompt starters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-amber-600" />
                How are you feeling right now?
              </label>
              
              <span className="text-[11px] text-stone-500">
                Tap a mood to tune Gemini's emotional reflection
              </span>
            </div>

            {/* Mood Selector Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(Object.keys(MOODS) as MoodType[]).map((moodKey) => {
                const item = MOODS[moodKey];
                const isSelected = selectedMood === moodKey;
                return (
                  <button
                    key={moodKey}
                    type="button"
                    onClick={() => setSelectedMood(moodKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap active:scale-95 shadow-xs ${
                      isSelected
                        ? `${item.bgClass} ring-2 ring-amber-500 font-bold scale-105 shadow-sm`
                        : "bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200"
                    }`}
                  >
                    <span className="text-base">{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Guided Prompt Starters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-600" />
              Prompts:
            </span>

            <button
              type="button"
              onClick={() => handleSelectStarter("Today, 3 things I am deeply grateful for are: ", "radiant")}
              className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium whitespace-nowrap transition-colors"
            >
              ✨ Daily Gratitude
            </button>

            <button
              type="button"
              onClick={() => handleSelectStarter("Reflecting on today, what went well and what felt draining was... ", "calm")}
              className="px-3 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-xs font-medium whitespace-nowrap transition-colors"
            >
              🌿 Evening Unwind
            </button>

            <button
              type="button"
              onClick={() => handleSelectStarter("A challenge I am facing right now is... ", "reflective")}
              className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-medium whitespace-nowrap transition-colors"
            >
              💡 Challenge Solver
            </button>

            <button
              type="button"
              onClick={() => handleSelectStarter("If I spoke to myself with unconditional kindness, I would acknowledge that... ", "joyful")}
              className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-medium whitespace-nowrap transition-colors"
            >
              🌱 Kind Self-Talk
            </button>
          </div>

          {/* Optional Title Input */}
          <div>
            <input
              id="top-journal-title-input"
              type="text"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Title for today's reflection (optional, e.g., Finding peace in small moments)"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm font-['Newsreader'] italic focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-400"
            />
          </div>

          {/* Voice Dictation & Speech-to-Text Bar */}
          <VoiceDictationBar
            currentText={entryContent}
            onTextChange={setEntryContent}
            onAppendText={(chunk) => {
              setEntryContent((prev) => (prev ? `${prev} ${chunk.trim()}` : chunk.trim()));
            }}
            currentMood={MOODS[selectedMood].label}
          />

          {/* Writing Textarea */}
          <div className="relative">
            <textarea
              id="top-journal-textarea"
              ref={textareaRef}
              rows={4}
              value={entryContent}
              onChange={(e) => setEntryContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleReflectWithAI();
                }
              }}
              placeholder="What is resting on your heart or mind today? Type or use 'Dictate with Voice' to speak freely..."
              className="w-full p-4 rounded-2xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50/50 text-stone-900 text-sm leading-relaxed placeholder:text-stone-400 resize-y"
            />

            {/* Word & character counter */}
            <div className="absolute right-3 bottom-3 text-[11px] text-stone-400 bg-white/80 px-2 py-0.5 rounded-md border border-stone-200">
              {entryContent.trim() ? entryContent.trim().split(/\s+/).length : 0} words
            </div>
          </div>

          {/* Mode Selector & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            
            {/* Reflection Mode Selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-600 hidden sm:inline">
                AI Mode:
              </span>
              <select
                id="top-reflection-mode-select"
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as AIServiceMode)}
                className="px-3 py-2 rounded-xl bg-stone-100 border border-stone-200 text-stone-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="reflect">🌸 Mindful Reflection</option>
                <option value="summarize">📋 Executive Summary</option>
                <option value="brainstorm">💡 Brainstorm Solutions</option>
                <option value="coaching">🧭 Mindful Life Coach</option>
              </select>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Reflect with AI Button */}
              <button
                id="top-reflect-with-ai-btn"
                type="button"
                onClick={handleReflectWithAI}
                disabled={isReflectingWithAI || isSavingEntry || !entryContent.trim()}
                className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                title="Converse with Gemini 3.6 Flash (Cmd+Enter)"
              >
                {isReflectingWithAI ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Reflecting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Reflect with AI</span>
                  </>
                )}
              </button>

              {/* Save Entry Direct Button */}
              <button
                id="top-quick-save-btn"
                type="button"
                onClick={handleDirectSave}
                disabled={isSavingEntry || (!entryContent.trim() && conversation.length === 0)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingEntry ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Entry</span>
                  </>
                )}
              </button>

              {/* Full Editor Switch */}
              <button
                type="button"
                onClick={() => onStartNewReflection(entryContent, selectedMood)}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Design in Scrapbook Studio"
              >
                <Palette className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Scrapbook Studio</span>
              </button>

              <button
                type="button"
                onClick={() => onStartNewReflection(entryContent, selectedMood)}
                className="px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Expand to Full Thread View"
              >
                <ArrowUpRight className="w-4 h-4 text-stone-500" />
                <span className="hidden md:inline">Full Thread</span>
              </button>

            </div>

          </div>

          {/* Composer Error Notice */}
          {composerError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{composerError}</span>
            </div>
          )}

          {/* Save Success Notice */}
          {saveSuccessNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessNotice}</span>
              </div>
              <button
                onClick={() => onNavigate("history")}
                className="text-xs font-bold text-emerald-700 underline"
              >
                View in Archive &rarr;
              </button>
            </div>
          )}

          {/* Live In-Place Conversation / AI Reflection Bubble */}
          {conversation.length > 0 && (
            <div className="mt-4 p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Gemini Mindful Dialogue
                </span>

                <button
                  type="button"
                  onClick={handleDirectSave}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Conversation</span>
                </button>
              </div>

              {/* Message Feed */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-stone-900 text-stone-100 ml-6"
                        : "bg-white text-stone-800 border border-amber-200 font-['Newsreader'] italic mr-6 shadow-2xs"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">
                      {msg.role === "user" ? "You" : "Gemini Mindful Companion"}
                    </div>
                    <div>{msg.content}</div>
                  </div>
                ))}
              </div>

              {/* Summary if present */}
              {aiSummary && (
                <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs text-stone-700">
                  <span className="font-bold text-amber-900 block mb-0.5">Summary Insight:</span>
                  {aiSummary}
                </div>
              )}
            </div>
          )}

        </div>

      </section>


      {/* ========================================================= */}
      {/* 2. BELOW THAT: VISUAL REPRESENTATION OF DETAILS & OPTIONS */}
      {/* ========================================================= */}
      <section id="details-and-options-section" className="space-y-6">
        
        {/* Section Heading */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold font-['Plus_Jakarta_Sans'] text-stone-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-600" />
              Emotional Insights & Reflection Details
            </h2>
            <p className="text-xs text-stone-500">
              Visual breakdown of your inner spectrum, recent entries, and reflection habits
            </p>
          </div>

          <button
            onClick={() => onNavigate("analytics")}
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
          >
            Deep Analytics &rarr;
          </button>
        </div>

        {/* Visual Details Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 1: Emotional Spectrum Distribution Bar (Spans 2 cols) */}
          <div className="md:col-span-2 p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Smile className="w-4 h-4 text-amber-600" />
                Mood Spectrum Distribution
              </h3>
              <span className="text-xs text-stone-400">
                {reflections.length} Total Logs
              </span>
            </div>

            {/* Proportional Stacked Color Bar */}
            {moodDistribution.length > 0 ? (
              <div className="space-y-3">
                <div className="h-4 w-full rounded-full bg-stone-100 flex overflow-hidden border border-stone-200">
                  {moodDistribution.map((item) => (
                    <div
                      key={item.mood}
                      style={{ width: `${item.percent}%` }}
                      className={`h-full ${item.bgClass} transition-all`}
                      title={`${item.label}: ${item.percent}% (${item.count})`}
                    />
                  ))}
                </div>

                {/* Legend Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {moodDistribution.slice(0, 6).map((item) => (
                    <button
                      key={item.mood}
                      type="button"
                      onClick={() => setMoodFilter(moodFilter === item.mood ? "all" : item.mood)}
                      className={`p-2 rounded-xl text-left flex items-center gap-2 border transition-all ${
                        moodFilter === item.mood
                          ? "border-amber-400 bg-amber-50/80 shadow-xs"
                          : "border-stone-100 hover:border-stone-200 bg-stone-50"
                      }`}
                    >
                      <span className="text-base">{item.emoji}</span>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold text-stone-800 truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {item.percent}% ({item.count})
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-stone-400 italic">
                Save your first reflection above to see your emotional spectrum.
              </div>
            )}
          </div>

          {/* Card 2: Key Metrics Glance */}
          <div className="p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-amber-600" />
              Journal Stats
            </h3>

            <div className="space-y-3">
              <div>
                <div className="text-2xl font-black text-stone-900 font-['Plus_Jakarta_Sans']">
                  {reflections.length}
                </div>
                <div className="text-xs text-stone-500">Reflections Logged</div>
              </div>

              <div className="pt-2 border-t border-stone-100">
                <div className="text-lg font-bold text-stone-800 font-['Plus_Jakarta_Sans']">
                  {totalWordsWritten.toLocaleString()}
                </div>
                <div className="text-xs text-stone-500">Total Words Written</div>
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500">Top State:</span>
                <span className="font-bold text-amber-900">
                  {moodDistribution[0] ? `${moodDistribution[0].emoji} ${moodDistribution[0].label}` : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Storage & Privacy Details */}
          <div className="p-5 rounded-3xl bg-stone-900 text-stone-100 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Isolation
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Enforced
                </span>
              </div>

              <h4 className="text-sm font-bold font-['Plus_Jakarta_Sans']">
                Isolated Firestore
              </h4>

              <p className="text-[11px] text-stone-300 leading-relaxed">
                Entries are isolated at <code className="bg-stone-800 text-amber-300 px-1 py-0.5 rounded text-[10px]">/users/{userProfile.uid.slice(0, 6)}...</code> with owner-bound rules.
              </p>
            </div>

            <button
              onClick={onOpenEncryptionSettings}
              className="mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>{userProfile.e2eeEnabled ? "Vault Options" : "Enable AES-256"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Visual Gallery of Recent Reflections with Filter & Search Options */}
        <div className="space-y-4">
          
          {/* Options & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-stone-100/80 border border-stone-200">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reflections, insights, tags..."
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-white border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Mood Options */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setMoodFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  moodFilter === "all"
                    ? "bg-stone-900 text-stone-100"
                    : "bg-white hover:bg-stone-200 text-stone-700 border border-stone-200"
                }`}
              >
                All Entries ({reflections.length})
              </button>

              {(Object.keys(MOODS) as MoodType[]).slice(0, 4).map((mKey) => (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setMoodFilter(moodFilter === mKey ? "all" : mKey)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                    moodFilter === mKey
                      ? "bg-amber-400 text-stone-950 font-bold"
                      : "bg-white hover:bg-stone-50 text-stone-700 border border-stone-200"
                  }`}
                >
                  <span>{MOODS[mKey].emoji}</span>
                  <span className="hidden sm:inline">{MOODS[mKey].label}</span>
                </button>
              ))}
            </div>

          </div>

          {/* Cards Grid */}
          {filteredReflections.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-stone-200 text-center space-y-3 shadow-xs">
              <Compass className="w-9 h-9 text-stone-300 mx-auto" />
              <h3 className="text-base font-bold text-stone-800 font-['Newsreader'] italic">
                No matching reflections found.
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {searchQuery || moodFilter !== "all"
                  ? "Try adjusting your search query or mood filter above."
                  : "Write your first mindful reflection in the entry box above."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReflections.slice(0, 6).map((doc) => {
                const moodMeta = MOODS[doc.mood] || MOODS.reflective;
                const snippet = doc.summary || 
                  (doc.messages && doc.messages[0]?.content) || 
                  "Reflective conversation with Gemini AI";

                return (
                  <div
                    key={doc.id}
                    onClick={() => onOpenReflection(doc)}
                    className="p-5 rounded-2xl bg-white border border-stone-200/90 hover:border-amber-400 shadow-2xs hover:shadow-sm cursor-pointer transition-all text-left flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{moodMeta.emoji}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${moodMeta.bgClass}`}>
                            {moodMeta.label}
                          </span>
                        </div>

                        <span className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {doc.date}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-stone-900 font-['Newsreader'] italic group-hover:text-amber-900 transition-colors line-clamp-1">
                        {doc.title || "Reflective Journal"}
                      </h4>

                      <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                        {doc.isEncrypted ? "🔒 End-to-End Encrypted reflection vault" : snippet}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400 group-hover:text-amber-700 transition-colors">
                      <span>{doc.messages?.length || 1} exchange{(doc.messages?.length || 1) > 1 ? "s" : ""}</span>
                      <span className="font-semibold flex items-center gap-0.5">
                        Read entry <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {reflections.length > 6 && (
            <div className="text-center pt-2">
              <button
                onClick={() => onNavigate("history")}
                className="px-5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <span>View All {reflections.length} Reflections in Archive</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

      </section>


      {/* ========================================================= */}
      {/* 3. UNDER IT: THE STREAK AND OTHER NAVIGATION             */}
      {/* ========================================================= */}
      <section id="streak-and-navigation-section" className="space-y-6 pt-4 border-t border-stone-200">
        
        {/* Streak Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold font-['Plus_Jakarta_Sans'] text-stone-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-600" />
              Journaling Streak & Consistency Roadmap
            </h2>
            <p className="text-xs text-stone-500">
              Build daily clarity through mindful journaling streaks and unlock milestone badges
            </p>
          </div>

          <div className="text-right">
            <div className="text-xl font-black text-amber-600 font-['Plus_Jakarta_Sans']">
              {currentStreak} Days
            </div>
            <div className="text-[11px] text-stone-400">
              Longest: {longestStreak}d
            </div>
          </div>
        </div>

        {/* Streak Visual Tracker Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-stone-100 shadow-md space-y-6">
          
          {/* Milestone Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-300">
                {nextMilestone 
                  ? `Next Milestone: ${nextMilestone.title} (${nextMilestone.days} Days)` 
                  : "🏆 Streak Master Achieved!"}
              </span>
              <span className="font-bold text-amber-400">
                {milestoneProgress}% Complete
              </span>
            </div>

            <div className="h-3 w-full bg-stone-800 rounded-full overflow-hidden border border-stone-700">
              <div
                style={{ width: `${milestoneProgress}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500 shadow-sm"
              />
            </div>
          </div>

          {/* 30-Day Activity Heatmap Dots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Past 30 Days Consistency:</span>
              <span className="text-stone-300 font-medium">
                {activityMap.filter((d) => d.isLogged).length} / 30 Days Logged
              </span>
            </div>

            <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-30 gap-1.5 py-1">
              {activityMap.map((day) => (
                <div
                  key={day.dateStr}
                  title={`${day.month} ${day.dayNum}: ${day.isLogged ? "Reflection Logged! ✨" : "No Entry"}`}
                  className={`h-6 rounded-lg flex items-center justify-center text-[10px] font-mono transition-all ${
                    day.isLogged
                      ? "bg-amber-400 text-stone-950 font-bold ring-1 ring-amber-300"
                      : day.isToday
                      ? "bg-stone-800 border border-amber-400/60 text-amber-300"
                      : "bg-stone-800/80 text-stone-500 border border-stone-700/50"
                  }`}
                >
                  {day.dayNum}
                </div>
              ))}
            </div>
          </div>

          {/* Milestones Roadmap Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-stone-800">
            {STREAK_MILESTONES.map((milestone) => {
              const isUnlocked = currentStreak >= milestone.days;
              return (
                <div
                  key={milestone.days}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    isUnlocked
                      ? "bg-stone-800/90 border-amber-400/70 text-amber-300"
                      : "bg-stone-900/50 border-stone-800 text-stone-500 opacity-60"
                  }`}
                >
                  <div className="text-2xl mb-1">{milestone.icon}</div>
                  <div className="text-xs font-bold truncate text-stone-200">
                    {milestone.title}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {milestone.days} Days
                  </div>
                  {isUnlocked && (
                    <div className="text-[9px] font-bold text-amber-400 mt-1 uppercase tracking-wider">
                      Unlocked
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Other Navigation Hub (Action Cards) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-600" />
            Explore & Manage Reflections
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Nav Card 1: Past Entries Archive */}
            <div
              onClick={() => onNavigate("history")}
              className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-amber-400 shadow-2xs hover:shadow-sm cursor-pointer transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-amber-900">
                Past Entries Archive
              </h4>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Browse and filter your complete history of {reflections.length} journal reflections.
              </p>
              <div className="mt-3 text-xs font-semibold text-amber-700 flex items-center gap-1">
                Open Archive <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Nav Card 2: Deep Mood & Streak Analytics */}
            <div
              onClick={() => onNavigate("analytics")}
              className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-indigo-400 shadow-2xs hover:shadow-sm cursor-pointer transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-indigo-900">
                Mood & Streak Analytics
              </h4>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Examine emotional vitality charts, consistency patterns, and badge milestones.
              </p>
              <div className="mt-3 text-xs font-semibold text-indigo-700 flex items-center gap-1">
                View Trends <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Nav Card 3: E2EE Vault Settings */}
            <div
              onClick={onOpenEncryptionSettings}
              className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-emerald-400 shadow-2xs hover:shadow-sm cursor-pointer transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-emerald-900">
                E2EE Encryption Vault
              </h4>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                {userProfile.e2eeEnabled 
                  ? "Manage your zero-knowledge AES-256 master passphrase."
                  : "Enable client-side encryption for private reflections."}
              </p>
              <div className="mt-3 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                Vault Settings <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Nav Card 4: Export Journal Markdown */}
            <div
              onClick={handleExportMarkdown}
              className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-cyan-400 shadow-2xs hover:shadow-sm cursor-pointer transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-cyan-900">
                Export Journal (.md)
              </h4>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Download a clean Markdown backup of all reflections and AI summaries.
              </p>
              <div className="mt-3 text-xs font-semibold text-cyan-700 flex items-center gap-1">
                Download Backup <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

          </div>
        </div>

      </section>

    </div>
  );
};
