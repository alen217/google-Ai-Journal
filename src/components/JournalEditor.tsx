import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { 
  MoodType, 
  AIServiceMode, 
  JournalMessage, 
  ReflectionDoc, 
  UserProfile,
  ScrapbookLayout,
  ScrapbookElement,
  PaperStyle
} from "../types";
import { MOODS, POPULAR_TAGS, JOURNALING_PROMPTS } from "../lib/constants";
import { 
  JOURNAL_TEMPLATES, 
  PAPER_STYLES, 
  JournalTemplate 
} from "../lib/scrapbookConstants";
import { persistReflection, getTodayDateString } from "../lib/firebase";
import { encryptPayload } from "../lib/encryption";
import { VoiceDictationBar } from "./VoiceDictationBar";
import { ScrapbookCanvas } from "./ScrapbookCanvas";
import { ScrapbookToolbar } from "./ScrapbookToolbar";
import { EntryInsightsSection } from "./EntryInsightsSection";
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
  Smile,
  Palette,
  Eye,
  Edit3,
  Layers,
  LayoutTemplate,
  Camera,
  Check
} from "lucide-react";

interface JournalEditorProps {
  initialDoc?: ReflectionDoc | null;
  initialPrompt?: string | null;
  userProfile: UserProfile;
  encryptionKey: CryptoKey | null;
  onBack: () => void;
  onSaved: (savedDoc: ReflectionDoc, updatedProfile: UserProfile, streakIncremented: boolean) => void;
  onOpenEncryptionSettings: () => void;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  initialDoc,
  initialPrompt,
  userProfile,
  encryptionKey,
  onBack,
  onSaved,
  onOpenEncryptionSettings,
}) => {
  // Document identifiers & core metadata
  const [docId] = useState<string>(
    initialDoc?.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [savedReflectionDoc, setSavedReflectionDoc] = useState<ReflectionDoc | null>(initialDoc || null);
  const [showInsightsSection, setShowInsightsSection] = useState<boolean>(Boolean(initialDoc));
  const [title, setTitle] = useState<string>(initialDoc?.title || "");
  const [selectedMood, setSelectedMood] = useState<MoodType>(initialDoc?.mood || "reflective");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialDoc?.tags || ["Personal Growth"]);
  const [customTagInput, setCustomTagInput] = useState("");
  
  // Conversational turns
  const [messages, setMessages] = useState<JournalMessage[]>(
    initialDoc?.messages || []
  );
  const [inputPrompt, setInputPrompt] = useState(initialPrompt || "");
  const [aiMode, setAiMode] = useState<AIServiceMode>("reflect");
  
  // AI summary & action items
  const [summary, setSummary] = useState<string>(initialDoc?.summary || "");
  const [actionItems, setActionItems] = useState<string[]>(initialDoc?.actionItems || []);
  const [keyEmotions, setKeyEmotions] = useState<string[]>(initialDoc?.keyEmotions || []);

  // -------------------------------------------------------------
  // Visual Scrapbook Layout & Canvas State
  // -------------------------------------------------------------
  const [editorMode, setEditorMode] = useState<"write" | "scrapbook" | "preview">(
    initialDoc?.scrapbook ? "scrapbook" : "write"
  );
  const [selectedCanvasElementId, setSelectedCanvasElementId] = useState<string | null>(null);

  // Initialize scrapbook layout
  const defaultDateStr = initialDoc?.date || getTodayDateString();
  const initialTextContent = (initialDoc?.messages || [])
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");

  const [scrapbookLayout, setScrapbookLayout] = useState<ScrapbookLayout>(() => {
    if (initialDoc?.scrapbook) {
      return initialDoc.scrapbook;
    }
    // Generate initial layout from default template
    const template = JOURNAL_TEMPLATES[0];
    return {
      templateId: template.id,
      paperStyle: template.paperStyle,
      paperColor: template.paperColor,
      elements: template.generateElements(
        initialDoc?.title || "Mindful Reflection",
        defaultDateStr,
        initialTextContent,
        initialDoc?.summary
      ),
      canvasWidth: 800,
      canvasHeight: 1100,
    };
  });

  // Undo / Redo history stack for scrapbook changes
  const [historyStack, setHistoryStack] = useState<ScrapbookLayout[]>([scrapbookLayout]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // UI state
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message in write mode
  useEffect(() => {
    if (editorMode === "write") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAiGenerating, editorMode]);

  // Autosave draft to localStorage
  useEffect(() => {
    const draftKey = `reflectai_draft_${docId}`;
    try {
      const draftData = {
        title,
        selectedMood,
        selectedTags,
        messages,
        inputPrompt,
        summary,
        actionItems,
        keyEmotions,
        scrapbookLayout,
        updatedAt: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      setHasUnsavedDraft(true);
    } catch {
      // Ignore quota errors
    }
  }, [docId, title, selectedMood, selectedTags, messages, inputPrompt, summary, actionItems, keyEmotions, scrapbookLayout]);

  // Clean draft on unmount if saved
  const clearDraft = () => {
    try {
      localStorage.removeItem(`reflectai_draft_${docId}`);
      setHasUnsavedDraft(false);
    } catch {
      // Ignore
    }
  };

  // -------------------------------------------------------------
  // Scrapbook History Management (Undo / Redo)
  // -------------------------------------------------------------
  const handleScrapbookChange = (newLayout: ScrapbookLayout) => {
    setScrapbookLayout(newLayout);
    // Push onto history stack (limit to 25 steps)
    const currentHistory = historyStack.slice(0, historyIndex + 1);
    const updated = [...currentHistory, newLayout].slice(-25);
    setHistoryStack(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = historyIndex - 1;
      setHistoryIndex(prev);
      setScrapbookLayout(historyStack[prev]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const next = historyIndex + 1;
      setHistoryIndex(next);
      setScrapbookLayout(historyStack[next]);
    }
  };

  // Apply a preset template
  const handleApplyTemplate = (template: JournalTemplate) => {
    const currentText = messages.map((m) => m.content).join("\n\n") || inputPrompt;
    const newElements = template.generateElements(
      title || "Mindful Reflection",
      defaultDateStr,
      currentText,
      summary
    );
    const updatedLayout: ScrapbookLayout = {
      templateId: template.id,
      paperStyle: template.paperStyle,
      paperColor: template.paperColor,
      elements: newElements,
      canvasWidth: 800,
      canvasHeight: 1100,
    };
    handleScrapbookChange(updatedLayout);
    setSelectedCanvasElementId(null);
  };

  // Synchronize written text into Scrapbook canvas when switching tabs
  const handleSwitchToScrapbook = () => {
    // If text was written in inputPrompt or messages, ensure canvas has a text element reflecting it
    const allUserTexts = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .concat(inputPrompt.trim() ? [inputPrompt.trim()] : [])
      .join("\n\n");

    if (allUserTexts) {
      const hasMainBody = scrapbookLayout.elements.some(
        (el) => el.id === "main_body" || (el.type === "text" && el.content && el.content.length > 50)
      );

      if (!hasMainBody) {
        // Update main text element
        setScrapbookLayout((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (el.id === "main_body" || el.type === "text") {
              return { ...el, content: allUserTexts };
            }
            return el;
          }),
        }));
      }
    }

    setEditorMode("scrapbook");
  };

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
      const clean = customTagInput.trim();
      if (!selectedTags.includes(clean)) {
        setSelectedTags([...selectedTags, clean]);
      }
      setCustomTagInput("");
    }
  };

  // -------------------------------------------------------------
  // Gemini AI Reflection Handler
  // -------------------------------------------------------------
  const handleSendPrompt = async () => {
    if (!inputPrompt.trim() || isAiGenerating) return;

    const userText = inputPrompt.trim();
    setInputPrompt("");
    setAiError(null);

    const userMsg: JournalMessage = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsAiGenerating(true);

    try {
      const response = await fetch("/api/gemini/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          mode: aiMode,
          mood: MOODS[selectedMood].label,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate reflection from Gemini.");
      }

      const aiMsg: JournalMessage = {
        id: `msg_${Date.now()}_ai`,
        role: "model",
        content: data.geminiReply,
        timestamp: new Date().toISOString(),
        modelUsed: data.modelUsed,
      };

      setMessages([...updatedMessages, aiMsg]);

      // Update AI reflection attributes
      if (data.summary) setSummary(data.summary);
      if (data.actionItems) setActionItems(data.actionItems);
      if (data.keyEmotions) setKeyEmotions(data.keyEmotions);

      // Auto-set title if currently blank
      if (!title.trim() && userText) {
        const words = userText.split(" ").slice(0, 5).join(" ");
        setTitle(`${words}...`);
      }

      // Automatically add Gemini card to scrapbook elements if in scrapbook mode
      if (data.summary) {
        setScrapbookLayout((prev) => {
          const hasAiCard = prev.elements.some((el) => el.type === "ai_card");
          if (hasAiCard) {
            return {
              ...prev,
              elements: prev.elements.map((el) =>
                el.type === "ai_card" ? { ...el, content: data.summary } : el
              ),
            };
          } else {
            const newAiCard: ScrapbookElement = {
              id: `ai_card_${Date.now()}`,
              type: "ai_card",
              x: 60,
              y: 600,
              width: 680,
              height: 130,
              rotation: 0,
              zIndex: 12,
              content: data.summary,
              caption: "Gemini Reflection Insight",
              backgroundColor: "#fef3c7",
              borderColor: "#fde68a",
              color: "#78350f",
            };
            return {
              ...prev,
              elements: [...prev.elements, newAiCard],
            };
          }
        });
      }
    } catch (err: any) {
      console.error("Gemini reflect error:", err);
      setAiError(err?.message || "Failed to reach Gemini AI companion.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // Save Reflection (Persists content + Scrapbook canvas layout)
  // -------------------------------------------------------------
  const handleSaveDoc = async () => {
    if (!messages.length && !inputPrompt.trim() && !scrapbookLayout.elements.length) {
      setSaveError("Please write or place thoughts onto your journal page before saving.");
      return;
    }

    // Include any trailing input prompt
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

      // Clean undefined values from scrapbook payload before saving
      const cleanScrapbook: ScrapbookLayout = JSON.parse(JSON.stringify(scrapbookLayout));

      if (isEncrypted) {
        if (!encryptionKey) {
          onOpenEncryptionSettings();
          throw new Error("Please unlock your encryption vault before saving encrypted reflections.");
        }

        // Package and encrypt the sensitive contents including scrapbook layout
        const payloadToEncrypt = JSON.stringify({
          messages: currentMessages,
          summary,
          actionItems,
          keyEmotions,
          scrapbook: cleanScrapbook,
        });

        const encrypted = await encryptPayload(payloadToEncrypt, encryptionKey);
        encryptedData = encrypted.ciphertext;
        iv = encrypted.iv;

        // In Firestore, store encrypted placeholder for public inspection
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
        messages: isEncrypted ? currentMessages : messagesToSave,
        summary,
        actionItems,
        keyEmotions,
        scrapbook: isEncrypted ? undefined : cleanScrapbook,
      };

      const result = await persistReflection(
        {
          ...docToPersist,
          messages: messagesToSave,
          summary: summaryToSave,
          scrapbook: isEncrypted ? undefined : cleanScrapbook,
        },
        userProfile
      );

      const finalDoc: ReflectionDoc = {
        ...docToPersist,
        scrapbook: cleanScrapbook,
        messages: currentMessages,
      };

      setSavedReflectionDoc(finalDoc);
      setShowInsightsSection(true);
      setSaveSuccess(true);
      clearDraft();
      setTimeout(() => setSaveSuccess(false), 4000);

      // Pass the fully restored document back to App state
      onSaved(
        finalDoc,
        result.updatedProfile,
        result.streakIncremented
      );
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err?.message || "Failed to save reflection to Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: Navigation, Workflow Tabs & Save Button            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        
        {/* Left: Back & Title */}
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
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>{defaultDateStr}</span>
              <span>&bull;</span>
              <span>{MOODS[selectedMood].emoji} {MOODS[selectedMood].label}</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-['Newsreader'] italic text-stone-900 truncate max-w-sm sm:max-w-md">
              {title || "Untitled Reflection"}
            </h1>
          </div>
        </div>

        {/* Center: Workflow Mode Tabs */}
        <div className="flex items-center p-1 bg-stone-200/80 rounded-2xl border border-stone-300/80 self-start sm:self-center shadow-inner">
          <button
            type="button"
            onClick={() => setEditorMode("write")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              editorMode === "write"
                ? "bg-white text-stone-900 shadow-xs scale-100"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
            <span>1. Write & Converse</span>
          </button>

          <button
            type="button"
            onClick={handleSwitchToScrapbook}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              editorMode === "scrapbook"
                ? "bg-white text-stone-900 shadow-xs scale-100"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            <span>2. Scrapbook Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setEditorMode("preview")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              editorMode === "preview"
                ? "bg-white text-stone-900 shadow-xs scale-100"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>3. Paper Preview</span>
          </button>
        </div>

        {/* Right: Security Badge & Save Button */}
        <div className="flex items-center gap-2">
          {userProfile.e2eeEnabled && (
            <button
              onClick={onOpenEncryptionSettings}
              className="px-2.5 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-medium border border-stone-200 flex items-center gap-1 hover:bg-stone-200 transition-colors"
              title="AES-256 Client-Side Encryption Enabled"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">E2EE</span>
            </button>
          )}

          {savedReflectionDoc && (
            <button
              id="editor-analyze-entry-btn"
              type="button"
              onClick={() => setShowInsightsSection((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{showInsightsSection ? "Hide Insights" : "✨ Analyze Entry"}</span>
            </button>
          )}

          <button
            id="editor-save-doc-btn"
            type="button"
            onClick={handleSaveDoc}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
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
        </div>

      </div>

      {/* Save Error Notice */}
      {saveError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-800 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Save Success Notice Toast with Analyze Entry Prompt */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-300 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">✨ Journal entry saved securely! Ready to detect calendar commitments and insights?</span>
          </div>
          <button
            type="button"
            onClick={() => setShowInsightsSection(true)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-amber-50 font-semibold flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>✨ Analyze Entry</span>
          </button>
        </div>
      )}

      {/* ✨ Expandable Journal Insights Section */}
      {savedReflectionDoc && showInsightsSection && (
        <div className="animate-fade-in">
          <EntryInsightsSection
            reflection={savedReflectionDoc}
            userProfile={userProfile}
            rawText={
              savedReflectionDoc.messages
                ?.filter((m) => m.role === "user")
                .map((m) => m.content)
                .join("\n\n") || inputPrompt
            }
          />
        </div>
      )}


      {/* ============================================================= */}
      {/* MODE 1: WRITE & CONVERSE (Interactive Writing Experience)     */}
      {/* ============================================================= */}
      {editorMode === "write" && (
        <div className="space-y-6">
          
          {/* Metadata Row: Mood Selector & Title */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/90 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <input
                  id="editor-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your reflection a title (e.g. Walking through morning mist...)"
                  className="w-full text-lg sm:text-xl font-bold font-['Newsreader'] italic text-stone-900 border-none outline-none placeholder:text-stone-300 focus:ring-0 bg-transparent"
                />
              </div>

              {/* Mood Selector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(Object.keys(MOODS) as MoodType[]).map((moodKey) => {
                  const m = MOODS[moodKey];
                  const isSelected = selectedMood === moodKey;
                  return (
                    <button
                      key={moodKey}
                      type="button"
                      onClick={() => setSelectedMood(moodKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95 ${
                        isSelected
                          ? `${m.bgClass} ring-2 ring-amber-500 font-bold shadow-xs`
                          : "bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200"
                      }`}
                    >
                      <span>{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags Row */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100 text-xs">
              <span className="text-stone-400 font-medium flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Tags:
              </span>
              {POPULAR_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      isSelected
                        ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-600"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="+ tag & Enter"
                className="px-2 py-0.5 rounded-lg bg-stone-50 border border-stone-200 text-[11px] text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 w-24"
              />
            </div>

          </div>

          {/* Prompt Starters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-600" />
              Prompts:
            </span>
            {JOURNALING_PROMPTS.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleUsePrompt(promptText)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-medium whitespace-nowrap shadow-2xs transition-colors flex items-center gap-1"
              >
                <span className="text-stone-500 italic truncate max-w-[240px]">{promptText}</span>
              </button>
            ))}
          </div>

          {/* Conversation Feed */}
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="p-10 rounded-3xl bg-white border border-stone-200/90 text-center space-y-3 shadow-xs">
                <Brain className="w-10 h-10 text-stone-300 mx-auto" />
                <h3 className="text-lg font-bold text-stone-800 font-['Newsreader'] italic">
                  A blank page for your thoughts.
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                  Write freely below or use speech dictation. When ready, invite Gemini AI to reflect, synthesize takeaways, or continue in your digital scrapbook studio!
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-5 rounded-3xl text-sm leading-relaxed transition-all shadow-xs ${
                    m.role === "user"
                      ? "bg-white text-stone-900 border border-stone-200 ml-4 sm:ml-12 font-['Newsreader'] text-base"
                      : "bg-amber-50/80 text-stone-800 border border-amber-200/80 mr-4 sm:mr-12"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                    <span className="flex items-center gap-1.5 text-stone-700">
                      {m.role === "user" ? "You" : "Gemini Mindful Companion"}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="prose prose-stone max-w-none text-sm leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))
            )}

            {isAiGenerating && (
              <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-200/70 mr-4 sm:mr-12 flex items-center gap-3 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                <span className="text-xs text-stone-600 italic">
                  Gemini is holding space and crafting a mindful reflection...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Dictation Bar */}
          <VoiceDictationBar
            currentText={inputPrompt}
            onTextChange={setInputPrompt}
            onAppendText={(chunk) => {
              setInputPrompt((prev) => (prev ? `${prev} ${chunk.trim()}` : chunk.trim()));
            }}
            currentMood={MOODS[selectedMood].label}
          />

          {/* Input Box & AI Controls */}
          <div className="bg-white p-4 rounded-3xl border border-stone-200/90 shadow-sm space-y-3">
            
            <textarea
              id="editor-prompt-textarea"
              rows={4}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              placeholder="Type your reflection or speak using the voice bar above... (Press Cmd+Enter to send to Gemini)"
              className="w-full p-2 bg-transparent text-stone-900 placeholder:text-stone-400 border-none outline-none resize-y text-sm leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-100">
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-500">Gemini Lens:</span>
                <select
                  value={aiMode}
                  onChange={(e) => setAiMode(e.target.value as AIServiceMode)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none"
                >
                  <option value="reflect">🌸 Mindful Reflection</option>
                  <option value="summarize">📋 Executive Summary</option>
                  <option value="brainstorm">💡 Brainstorm Solutions</option>
                  <option value="coaching">🧭 Mindful Life Coach</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSwitchToScrapbook}
                  className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>Customize in Scrapbook Studio &rarr;</span>
                </button>

                <button
                  id="editor-reflect-ai-btn"
                  type="button"
                  onClick={handleSendPrompt}
                  disabled={isAiGenerating || !inputPrompt.trim()}
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Reflect with AI</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      )}


      {/* ============================================================= */}
      {/* MODE 2: SCRAPBOOK STUDIO (Interactive Visual Canvas & Design) */}
      {/* ============================================================= */}
      {editorMode === "scrapbook" && (
        <div className="space-y-6">
          
          {/* Top Scrapbook Toolbar */}
          <ScrapbookToolbar
            layout={scrapbookLayout}
            onChangeLayout={handleScrapbookChange}
            selectedElementId={selectedCanvasElementId}
            onSelectElement={setSelectedCanvasElementId}
            entryTitle={title}
            entryDate={defaultDateStr}
            entryText={messages.map((m) => m.content).join("\n\n") || inputPrompt}
            aiSummary={summary}
            onApplyTemplate={handleApplyTemplate}
          />

          {/* Center Interactive Paper Canvas */}
          <div className="bg-stone-200/50 p-4 sm:p-8 rounded-3xl border border-stone-300/80 shadow-inner flex justify-center">
            <ScrapbookCanvas
              layout={scrapbookLayout}
              onChangeLayout={handleScrapbookChange}
              selectedElementId={selectedCanvasElementId}
              onSelectElement={setSelectedCanvasElementId}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < historyStack.length - 1}
            />
          </div>

        </div>
      )}


      {/* ============================================================= */}
      {/* MODE 3: PAPER PREVIEW (Clean Photorealistic Finished View)    */}
      {/* ============================================================= */}
      {editorMode === "preview" && (
        <div className="space-y-6">
          
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <Eye className="w-4 h-4 text-amber-700" />
              <span>Full Journal Page Preview — This is exactly how your entry will look when saved and read.</span>
            </div>
            <button
              onClick={() => setEditorMode("scrapbook")}
              className="font-bold underline text-amber-950"
            >
              &larr; Back to Customizing
            </button>
          </div>

          <div className="bg-stone-200/50 p-4 sm:p-8 rounded-3xl border border-stone-300/80 shadow-inner flex justify-center">
            <ScrapbookCanvas
              layout={scrapbookLayout}
              onChangeLayout={() => {}}
              readOnly={true}
            />
          </div>

        </div>
      )}

    </div>
  );
};
