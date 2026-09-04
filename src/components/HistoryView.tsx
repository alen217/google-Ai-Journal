import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ReflectionDoc, UserProfile, MoodType, ScrapbookLayout } from "../types";
import { MOODS, POPULAR_TAGS } from "../lib/constants";
import { JOURNAL_TEMPLATES } from "../lib/scrapbookConstants";
import { ScrapbookCanvas } from "./ScrapbookCanvas";
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
  BookOpen,
  Palette,
  Eye,
  Edit3,
  FileText,
  Image as ImageIcon
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
  const [viewMode, setViewMode] = useState<"paper" | "reading">("paper");
  const [decryptedCache, setDecryptedCache] = useState<Record<string, ReflectionDoc>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Decrypt on demand if encrypted
  const handleInspectDoc = async (doc: ReflectionDoc) => {
    if (doc.isEncrypted && doc.encryptedData && doc.iv) {
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
          scrapbook: parsed.scrapbook,
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

  // Helper to get or synthesize a scrapbook layout for any doc
  const getDocScrapbookLayout = (doc: ReflectionDoc): ScrapbookLayout => {
    if (doc.scrapbook) {
      return doc.scrapbook;
    }
    const template = JOURNAL_TEMPLATES[0]; // Minimal Paper
    const textContent = (doc.messages || [])
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");

    return {
      templateId: template.id,
      paperStyle: template.paperStyle,
      paperColor: template.paperColor,
      elements: template.generateElements(
        doc.title || "Reflective Journal",
        doc.date,
        textContent || doc.summary || "No journal text recorded.",
        doc.summary
      ),
      canvasWidth: 800,
      canvasHeight: 1000,
    };
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
    if (selectedMoodFilter !== "all" && doc.mood !== selectedMoodFilter) {
      return false;
    }
    if (selectedTagFilter !== "all" && !(doc.tags || []).includes(selectedTagFilter)) {
      return false;
    }
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
        doc.actionItems.forEach((action) => {
          md += `- [ ] ${action}\n`;
        });
        md += `\n`;
      }

      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reflectai_journal_${new Date().toISOString().split("T")[0]}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Your Personal Archives
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Newsreader'] italic text-stone-900">
            Journal Scrapbook & History
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Browse your thoughts, polaroids, and mindful reflections preserved on authentic stationery pages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMarkdown}
            disabled={reflections.length === 0}
            className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-medium shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Download full journal archive as Markdown"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Entries</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200/90 shadow-xs flex flex-col md:flex-row items-center gap-3">
        
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, insights, titles, or tags..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mood Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-medium text-stone-500 shrink-0">Mood:</label>
          <select
            value={selectedMoodFilter}
            onChange={(e) => setSelectedMoodFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full md:w-auto"
          >
            <option value="all">All Moods</option>
            {(Object.keys(MOODS) as MoodType[]).map((m) => (
              <option key={m} value={m}>
                {MOODS[m].emoji} {MOODS[m].label}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs font-medium text-stone-500 shrink-0">Tag:</label>
          <select
            value={selectedTagFilter}
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full md:w-auto"
          >
            <option value="all">All Tags</option>
            {POPULAR_TAGS.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Layout */}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Entries Feed Cards (4 cols on lg when inspecting, 12 cols if none selected) */}
          <div className={`${activeViewingDoc ? "lg:col-span-4" : "lg:col-span-12"} space-y-3`}>
            
            <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>{filteredReflections.length} {filteredReflections.length === 1 ? "Entry" : "Entries"} Found</span>
              {activeViewingDoc && (
                <button
                  onClick={() => setActiveViewingDoc(null)}
                  className="text-stone-500 hover:text-stone-800 text-[11px] underline"
                >
                  Close Inspection
                </button>
              )}
            </div>

            <div className={activeViewingDoc ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
              {filteredReflections.map((doc) => {
                const moodMeta = MOODS[doc.mood] || MOODS.reflective;
                const isSelected = activeViewingDoc?.id === doc.id;
                const hasScrapbook = Boolean(doc.scrapbook);

                return (
                  <div
                    key={doc.id}
                    id={`reflection-card-${doc.id}`}
                    onClick={() => handleInspectDoc(doc)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer text-left relative group ${
                      isSelected
                        ? "bg-[#FAF7F2] border-amber-400 shadow-md ring-2 ring-amber-400/50"
                        : "bg-white border-stone-200/90 hover:border-amber-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Washi Tape visual accent at top-right */}
                    <div className="absolute top-2 right-4 w-12 h-3 bg-amber-200/70 border border-amber-300/80 rounded-xs rotate-2 pointer-events-none shadow-2xs" />

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

                    <h4 className="text-base font-bold text-stone-900 mt-3 font-['Newsreader'] italic group-hover:text-amber-900 transition-colors line-clamp-1">
                      {doc.title || "Reflective Entry"}
                    </h4>

                    {doc.summary && !doc.isEncrypted && (
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed font-['Newsreader'] italic">
                        "{doc.summary}"
                      </p>
                    )}

                    {doc.isEncrypted && !decryptedCache[doc.id] && (
                      <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 italic">
                        <Lock className="w-3 h-3 text-amber-500" />
                        Encrypted payload &bull; Click to decrypt
                      </p>
                    )}

                    {/* Footer Tags & Scrapbook Badge */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                      <div className="flex flex-wrap gap-1">
                        {(doc.tags || []).slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-600"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 flex items-center gap-1">
                        <Palette className="w-3 h-3 text-amber-600" />
                        <span>Paper Page</span>
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Expanded Journal Page Inspection View (8 cols on lg) */}
          {activeViewingDoc && (
            <div className="lg:col-span-8 bg-stone-100/70 rounded-3xl p-4 sm:p-6 border border-stone-200/90 shadow-sm space-y-4 sticky top-20">
              
              {/* Top Inspection Control Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
                
                {/* View Mode Toggle */}
                <div className="flex items-center p-1 bg-white rounded-2xl border border-stone-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("paper")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      viewMode === "paper"
                        ? "bg-amber-400 text-stone-950 shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5 text-stone-900" />
                    <span>📜 Paper Journal View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("reading")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      viewMode === "reading"
                        ? "bg-stone-900 text-white shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-stone-100" />
                    <span>📋 Reading & Chat View</span>
                  </button>
                </div>

                {/* Edit in Studio & Close */}
                <div className="flex items-center gap-2">
                  <button
                    id="history-continue-chat-btn"
                    onClick={() => onOpenReflection(activeViewingDoc)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit in Studio</span>
                  </button>
                  <button
                    onClick={() => setActiveViewingDoc(null)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

              </div>

              {/* 1. PAPER JOURNAL VIEW (Photorealistic Canvas) */}
              {viewMode === "paper" && (
                <div className="overflow-x-auto flex justify-center py-2">
                  <ScrapbookCanvas
                    layout={getDocScrapbookLayout(activeViewingDoc)}
                    onChangeLayout={() => {}}
                    readOnly={true}
                  />
                </div>
              )}

              {/* 2. READING & CHAT VIEW */}
              {viewMode === "reading" && (
                <div className="bg-white rounded-2xl p-6 border border-stone-200 space-y-6">
                  
                  {/* Header */}
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
      )}

    </div>
  );
};
