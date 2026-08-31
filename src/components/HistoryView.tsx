import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ReflectionDoc, UserProfile, MoodType } from "../types";
import { MOODS, POPULAR_TAGS } from "../lib/constants";
import { deleteReflectionDoc } from "../lib/firebase";
import { decryptPayload } from "../lib/encryption";
import { 
  Search, 
  Filter, 
  Trash2, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Calendar, 
  Download, 
  Sparkles, 
  ChevronRight, 
  MessageSquare, 
  ArrowLeft,
  X,
  Smile,
  Tag,
  BookOpen
} from "lucide-react";

interface HistoryViewProps {
  reflections: ReflectionDoc[];
  userProfile: UserProfile;
  encryptionKey: CryptoKey | null;
  onOpenReflection: (doc: ReflectionDoc) => void;
  onDeleteReflection: (id: string) => void;
  onOpenEncryptionSettings: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  reflections,
  userProfile,
  encryptionKey,
  onOpenReflection,
  onDeleteReflection,
  onOpenEncryptionSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>("all");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [activeViewingDoc, setActiveViewingDoc] = useState<ReflectionDoc | null>(null);
  const [decryptedCache, setDecryptedCache] = useState<Record<string, ReflectionDoc>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Decrypt on demand if encrypted
  const handleInspectDoc = async (doc: ReflectionDoc) => {
    if (doc.isEncrypted && doc.encryptedData && doc.iv) {
      // Check cache first
      if (decryptedCache[doc.id]) {
        setActiveViewingDoc(decryptedCache[doc.id]);
        return;
      }

      if (!encryptionKey) {
        onOpenEncryptionSettings();
        return;
      }

      try {
        const decryptedJson = await decryptPayload(doc.encryptedData, doc.iv, encryptionKey);
        const parsed = JSON.parse(decryptedJson);
        const fullDoc: ReflectionDoc = {
          ...doc,
          messages: parsed.messages || [],
          summary: parsed.summary,
          actionItems: parsed.actionItems,
          keyEmotions: parsed.keyEmotions,
        };
        setDecryptedCache((prev) => ({ ...prev, [doc.id]: fullDoc }));
        setActiveViewingDoc(fullDoc);
      } catch (err) {
        console.error("Decryption failed:", err);
        alert("Failed to decrypt reflection with current encryption key. Please check your passphrase.");
      }
    } else {
      setActiveViewingDoc(doc);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this journal reflection? This action cannot be undone.")) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteReflectionDoc(userProfile.uid, id);
      onDeleteReflection(id);
      if (activeViewingDoc?.id === id) {
        setActiveViewingDoc(null);
      }
    } catch (err) {
      console.error("Failed to delete reflection:", err);
      alert("Failed to delete reflection. Please check your connection.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filter reflections
  const filteredReflections = reflections.filter((doc) => {
    // Mood filter
    if (selectedMoodFilter !== "all" && doc.mood !== selectedMoodFilter) {
      return false;
    }
    // Tag filter
    if (selectedTagFilter !== "all" && !(doc.tags || []).includes(selectedTagFilter)) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title?.toLowerCase().includes(q);
      const matchTag = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchSummary = doc.summary?.toLowerCase().includes(q);
      const matchMessages = (doc.messages || []).some((m) => m.content.toLowerCase().includes(q));
      if (!matchTitle && !matchTag && !matchSummary && !matchMessages) {
        return false;
      }
    }
    return true;
  });

  // Export data to Markdown file
  const handleExportMarkdown = () => {
    let md = `# ReflectAI Journal Export\nUser: ${userProfile.displayName} (${userProfile.email})\nExported on: ${new Date().toLocaleString()}\n\n---\n\n`;

    reflections.forEach((doc, idx) => {
      const mood = MOODS[doc.mood]?.label || doc.mood;
      md += `## ${idx + 1}. ${doc.title || "Reflection"}\n`;
      md += `**Date:** ${doc.date} | **Mood:** ${mood} | **Tags:** ${(doc.tags || []).join(", ") || "None"}\n\n`;
      
      if (doc.summary) {
        md += `> **Executive Summary:** ${doc.summary}\n\n`;
      }

      if (doc.messages && doc.messages.length) {
        md += `### Conversation:\n`;
        doc.messages.forEach((m) => {
          md += `**${m.role === "user" ? "You" : "Gemini"}:** ${m.content}\n\n`;
        });
      }

      if (doc.actionItems && doc.actionItems.length) {
        md += `### Action Takeaways:\n`;
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
    a.download = `reflectai-journal-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            Your Private Journal Archive
          </div>
          <h2 className="text-3xl font-bold text-stone-900 font-['Newsreader'] italic">
            Past Journal Entries & Reflections
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {reflections.length} {reflections.length === 1 ? "entry" : "entries"} saved to your isolated Cloud Firestore
          </p>
        </div>

        {reflections.length > 0 && (
          <button
            id="history-export-btn"
            onClick={handleExportMarkdown}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-amber-400" />
            Export Journal (.md)
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <input
              id="history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reflections by keywords, feelings, or takeaways..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50 text-stone-900 placeholder:text-stone-400"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          </div>

          {/* Mood Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Smile className="w-4 h-4 text-stone-500 shrink-0 hidden sm:inline" />
            <select
              id="history-mood-filter-select"
              value={selectedMoodFilter}
              onChange={(e) => setSelectedMoodFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-stone-300 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            >
              <option value="all">All Moods</option>
              {(Object.keys(MOODS) as MoodType[]).map((m) => (
                <option key={m} value={m}>
                  {MOODS[m].emoji} {MOODS[m].label}
                </option>
              ))}
            </select>

            {/* Tag Filter */}
            <select
              id="history-tag-filter-select"
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl border border-stone-300 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            >
              <option value="all">All Tags</option>
              {POPULAR_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Entries List or Detail Split View */}
      {filteredReflections.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-stone-300" />
          <h3 className="text-lg font-bold text-stone-700 font-['Newsreader'] italic">
            No reflections match your search criteria.
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Try adjusting your search terms, changing the mood filter, or penning a new reflection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Entries Feed (1 col on lg or full width if inspecting) */}
          <div className={`${activeViewingDoc ? "lg:col-span-1" : "lg:col-span-3"} space-y-3`}>
            {filteredReflections.map((doc) => {
              const moodMeta = MOODS[doc.mood] || MOODS.reflective;
              const isSelected = activeViewingDoc?.id === doc.id;

              return (
                <div
                  key={doc.id}
                  id={`reflection-card-${doc.id}`}
                  onClick={() => handleInspectDoc(doc)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer text-left relative group ${
                    isSelected
                      ? "bg-amber-50/90 border-amber-400 shadow-md ring-2 ring-amber-400/40"
                      : "bg-white border-stone-200/90 hover:border-stone-400 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{moodMeta.emoji}</span>
                      <div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${moodMeta.bgClass}`}>
                          {moodMeta.label}
                        </span>
                        <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                          {doc.date}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {doc.isEncrypted && (
                        <div
                          title="End-to-End Encrypted with AES-GCM 256"
                          className="p-1 rounded-md bg-stone-100 text-emerald-700 text-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                      )}
                      
                      <button
                        title="Delete Reflection"
                        onClick={(e) => handleDelete(doc.id, e)}
                        disabled={deletingId === doc.id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-stone-900 mt-3 font-['Newsreader'] italic group-hover:text-amber-900 transition-colors">
                    {doc.title || "Reflective Entry"}
                  </h4>

                  {doc.summary && !doc.isEncrypted && (
                    <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                      {doc.summary}
                    </p>
                  )}

                  {doc.isEncrypted && !decryptedCache[doc.id] && (
                    <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 italic">
                      <Lock className="w-3 h-3 text-amber-500" />
                      Encrypted payload &bull; Click to decrypt
                    </p>
                  )}

                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {doc.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600"
                        >
                          #{t}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-[10px] text-stone-400">
                          +{doc.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Expanded Reading View (2 cols on lg) */}
          {activeViewingDoc && (
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-md space-y-6 sticky top-24">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{MOODS[activeViewingDoc.mood]?.emoji || "✨"}</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${MOODS[activeViewingDoc.mood]?.bgClass || "bg-stone-100 text-stone-800"}`}>
                      {MOODS[activeViewingDoc.mood]?.label || activeViewingDoc.mood}
                    </span>
                    <span className="text-xs text-stone-500">
                      {activeViewingDoc.date}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900 font-['Newsreader'] italic">
                    {activeViewingDoc.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="history-continue-chat-btn"
                    onClick={() => onOpenReflection(activeViewingDoc)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Continue Reflection
                  </button>
                  <button
                    onClick={() => setActiveViewingDoc(null)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Summary if present */}
              {activeViewingDoc.summary && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Executive Reflection Summary
                  </h4>
                  <p className="text-xs text-stone-700 leading-relaxed font-['Newsreader'] italic">
                    {activeViewingDoc.summary}
                  </p>
                </div>
              )}

              {/* Action Items */}
              {activeViewingDoc.actionItems && activeViewingDoc.actionItems.length > 0 && (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Action Takeaways
                  </h4>
                  <ul className="space-y-1.5">
                    {activeViewingDoc.actionItems.map((item, idx) => (
                      <li key={idx} className="text-xs text-stone-700 flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Messages Flow */}
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Conversation History
                </h4>
                {activeViewingDoc.messages && activeViewingDoc.messages.length > 0 ? (
                  activeViewingDoc.messages.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className={`p-4 rounded-2xl text-xs leading-relaxed ${
                        m.role === "user"
                          ? "bg-stone-900 text-stone-100 ml-6"
                          : "bg-stone-50 text-stone-800 border border-stone-200 mr-6"
                      }`}
                    >
                      <div className="font-semibold text-[10px] opacity-75 mb-1">
                        {m.role === "user" ? "You" : "Gemini AI"}
                      </div>
                      <div className="prose prose-stone max-w-none text-xs">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-400 italic">
                    No message turns found in this record.
                  </p>
                )}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
