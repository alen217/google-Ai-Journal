import React, { useState } from "react";
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  CheckSquare, 
  Clock, 
  Bell, 
  Edit3, 
  Trash2, 
  Plus, 
  CalendarPlus, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  ExternalLink,
  Lock
} from "lucide-react";
import { 
  EntryAnalysisResult, 
  DetectedCalendarItem, 
  ReflectionDoc, 
  UserProfile 
} from "../types";
import { persistAnalysisDoc, deleteAnalysisDoc } from "../lib/firebase";
import { CalendarAssistantModal } from "./CalendarAssistantModal";

interface EntryInsightsSectionProps {
  reflection: ReflectionDoc;
  userProfile: UserProfile;
  rawText?: string;
  initialAnalysis?: EntryAnalysisResult | null;
  onAnalysisUpdated?: (analysis: EntryAnalysisResult | null) => void;
}

export const EntryInsightsSection: React.FC<EntryInsightsSectionProps> = ({
  reflection,
  userProfile,
  rawText,
  initialAnalysis,
  onAnalysisUpdated,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [analysis, setAnalysis] = useState<EntryAnalysisResult | null>(initialAnalysis || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Calendar Modal state
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [itemsForCalendar, setItemsForCalendar] = useState<DetectedCalendarItem[]>([]);

  // Inline editing state for individual items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  // Re-sync if initialAnalysis changes
  React.useEffect(() => {
    if (initialAnalysis) {
      setAnalysis(initialAnalysis);
    }
  }, [initialAnalysis]);

  // Extract raw text if not provided
  const entryText = rawText || (
    reflection.messages
      ? reflection.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n")
      : ""
  );

  // Run AI Analysis
  const handleAnalyzeEntry = async () => {
    if (!entryText.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/gemini/analyze-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalText: entryText,
          entryDate: reflection.date || new Date().toISOString().slice(0, 10),
          referenceDate: "2026-09-04",
          options: {
            allowCalendarSuggestions: true,
            allowEmotionalAnalysis: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze journal entry.");
      }

      const newAnalysis: EntryAnalysisResult = {
        id: `analysis_${reflection.id}_${Date.now()}`,
        reflectionId: reflection.id,
        userId: userProfile.uid,
        createdAt: new Date().toISOString(),
        detectedEvents: data.detectedEvents || [],
        detectedTasks: data.detectedTasks || [],
        detectedDates: data.detectedDates || [],
        suggestedReminders: data.suggestedReminders || [],
        insightsSummary: data.insightsSummary || "Analysis completed.",
      };

      // Persist in Firestore
      await persistAnalysisDoc(userProfile.uid, newAnalysis.id, newAnalysis);

      setAnalysis(newAnalysis);
      setIsExpanded(true);

      if (onAnalysisUpdated) {
        onAnalysisUpdated(newAnalysis);
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      setAnalysisError(err?.message || "Failed to run entry analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Delete analysis record
  const handleDeleteAnalysis = async () => {
    if (!analysis) return;
    try {
      await deleteAnalysisDoc(userProfile.uid, analysis.id);
      setAnalysis(null);
      if (onAnalysisUpdated) {
        onAnalysisUpdated(null);
      }
    } catch (err) {
      console.warn("Delete analysis error:", err);
    }
  };

  // Start inline editing
  const handleStartEdit = (item: DetectedCalendarItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDate(item.date || "");
    setEditTime(item.time || "");
  };

  // Save inline edit
  const handleSaveEdit = (itemId: string, isTask: boolean) => {
    if (!analysis) return;
    const updatedEvents = analysis.detectedEvents.map((e) =>
      e.id === itemId ? { ...e, title: editTitle, date: editDate, time: editTime || undefined } : e
    );
    const updatedTasks = analysis.detectedTasks.map((t) =>
      t.id === itemId ? { ...t, title: editTitle, date: editDate, time: editTime || undefined } : t
    );

    const updatedAnalysis = {
      ...analysis,
      detectedEvents: updatedEvents,
      detectedTasks: updatedTasks,
    };
    setAnalysis(updatedAnalysis);
    setEditingItemId(null);
    persistAnalysisDoc(userProfile.uid, updatedAnalysis.id, updatedAnalysis).catch(console.warn);
  };

  // Remove single item from analysis
  const handleRemoveItem = (itemId: string) => {
    if (!analysis) return;
    const updatedAnalysis = {
      ...analysis,
      detectedEvents: analysis.detectedEvents.filter((e) => e.id !== itemId),
      detectedTasks: analysis.detectedTasks.filter((t) => t.id !== itemId),
    };
    setAnalysis(updatedAnalysis);
    persistAnalysisDoc(userProfile.uid, updatedAnalysis.id, updatedAnalysis).catch(console.warn);
  };

  // Open calendar flow for a single item
  const handleAddSingleItemToCalendar = (item: DetectedCalendarItem) => {
    setItemsForCalendar([item]);
    setIsCalendarModalOpen(true);
  };

  // Open calendar flow for all detected items
  const handleReviewAllCalendarItems = () => {
    if (!analysis) return;
    const all = [...analysis.detectedEvents, ...analysis.detectedTasks];
    if (all.length === 0) return;
    setItemsForCalendar(all);
    setIsCalendarModalOpen(true);
  };

  const totalActionable = (analysis?.detectedEvents.length || 0) + (analysis?.detectedTasks.length || 0);

  return (
    <div 
      id={`entry-insights-${reflection.id}`}
      className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-amber-100/40 p-5 shadow-sm font-['Newsreader'] text-stone-900 transition-all"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold font-serif text-stone-900 tracking-tight">
                ✨ Journal Insights & Calendar Assistant
              </h3>
              {analysis && (
                <span className="text-[11px] font-sans font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  {totalActionable} detected
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 font-sans">
              Identifies actionable events, commitments, deadlines & reminders with privacy control.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          {!analysis ? (
            <button
              id={`btn-analyze-entry-${reflection.id}`}
              onClick={handleAnalyzeEntry}
              disabled={isAnalyzing || !entryText.trim()}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-amber-50 font-sans text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Entry...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ Analyze Entry</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAnalyzeEntry}
                disabled={isAnalyzing}
                title="Re-run analysis"
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-amber-200/60 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleDeleteAnalysis}
                title="Delete analysis"
                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-amber-200/60 transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {analysisError && (
        <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Expanded Insights Section */}
      {analysis && isExpanded && (
        <div className="mt-5 pt-4 border-t border-amber-200/80 space-y-5 animate-fade-in">
          
          {/* Executive Summary */}
          {analysis.insightsSummary && (
            <div className="p-3.5 rounded-xl bg-white/70 border border-amber-200/60 text-stone-800 text-sm italic font-serif leading-relaxed">
              "{analysis.insightsSummary}"
            </div>
          )}

          {/* 4 Core Blocks: Important Events, Tasks, Detected Dates, Suggested Reminders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 📌 IMPORTANT EVENTS */}
            <div className="p-4 rounded-xl bg-white/80 border border-amber-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">📌</span>
                  <h4 className="font-serif font-bold text-stone-900 text-base">
                    Important Events
                  </h4>
                </div>
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  {analysis.detectedEvents.length}
                </span>
              </div>

              {analysis.detectedEvents.length === 0 ? (
                <p className="text-xs font-sans text-stone-400 italic py-2">
                  No specific events scheduled in this entry.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {analysis.detectedEvents.map((event) => {
                    const isEditing = editingItemId === event.id;

                    return (
                      <div
                        key={event.id}
                        className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors font-sans text-xs"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                            />
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs flex-1"
                              />
                              <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs flex-1"
                              />
                            </div>
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => handleSaveEdit(event.id, false)}
                                className="px-2 py-0.5 bg-amber-700 text-white rounded text-[11px] font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-stone-900 text-sm">
                                {event.title}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleStartEdit(event)}
                                  className="p-1 text-stone-400 hover:text-stone-700 rounded"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(event.id)}
                                  className="p-1 text-stone-400 hover:text-rose-600 rounded"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-stone-600 mt-1 flex-wrap font-mono text-[11px]">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-stone-400" />
                                {event.date || "Date unspecified"}
                              </span>
                              {event.time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-stone-400" />
                                  {event.time}
                                </span>
                              )}
                              {event.category && (
                                <span className="uppercase text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded bg-amber-200/70 text-amber-900">
                                  {event.category}
                                </span>
                              )}
                            </div>

                            {event.relativeDateText && (
                              <p className="text-[11px] text-amber-800 italic mt-1 font-serif">
                                Mentioned as: "{event.relativeDateText}"
                              </p>
                            )}

                            {/* Add to Calendar button */}
                            <div className="mt-2 pt-1.5 border-t border-amber-100/80 flex justify-end">
                              <button
                                onClick={() => handleAddSingleItemToCalendar(event)}
                                className="px-2 py-1 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-950 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              >
                                <CalendarPlus className="w-3 h-3" />
                                <span>Add to Calendar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ✅ TASKS & DEADLINES */}
            <div className="p-4 rounded-xl bg-white/80 border border-blue-200/70 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">✅</span>
                  <h4 className="font-serif font-bold text-stone-900 text-base">
                    Tasks & Deadlines
                  </h4>
                </div>
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                  {analysis.detectedTasks.length}
                </span>
              </div>

              {analysis.detectedTasks.length === 0 ? (
                <p className="text-xs font-sans text-stone-400 italic py-2">
                  No pending action tasks detected in this entry.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {analysis.detectedTasks.map((task) => {
                    const isEditing = editingItemId === task.id;

                    return (
                      <div
                        key={task.id}
                        className="p-2.5 rounded-lg border border-blue-100 bg-blue-50/40 hover:bg-blue-50 transition-colors font-sans text-xs"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                            />
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                            />
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => handleSaveEdit(task.id, true)}
                                className="px-2 py-0.5 bg-blue-700 text-white rounded text-[11px] font-medium"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-stone-900 text-sm">
                                {task.title}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleStartEdit(task)}
                                  className="p-1 text-stone-400 hover:text-stone-700 rounded"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveItem(task.id)}
                                  className="p-1 text-stone-400 hover:text-rose-600 rounded"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-stone-600 mt-1 flex-wrap text-[11px]">
                              {task.date && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3 text-stone-400" />
                                  Target: {task.date}
                                </span>
                              )}
                              {task.suggestedReminder && (
                                <span className="flex items-center gap-1 text-amber-800">
                                  <Bell className="w-3 h-3" />
                                  {task.suggestedReminder}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 pt-1.5 border-t border-blue-100/80 flex justify-end">
                              <button
                                onClick={() => handleAddSingleItemToCalendar(task)}
                                className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              >
                                <CalendarPlus className="w-3 h-3" />
                                <span>Add to Calendar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 📅 DETECTED DATES */}
            <div className="p-4 rounded-xl bg-white/80 border border-stone-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <h4 className="font-serif font-bold text-stone-900 text-base">
                    Detected Dates
                  </h4>
                </div>
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {analysis.detectedDates.length}
                </span>
              </div>

              {analysis.detectedDates.length === 0 ? (
                <p className="text-xs font-sans text-stone-400 italic py-2">
                  No chronological dates detected.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {analysis.detectedDates.map((d, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-stone-50 font-sans text-xs border border-stone-100"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold text-stone-800">{d.label}</span>
                        {d.context && (
                          <span className="text-stone-500 text-[11px] block truncate">
                            {d.context}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-medium text-stone-600 shrink-0">
                        {d.date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🔔 SUGGESTED REMINDERS */}
            <div className="p-4 rounded-xl bg-white/80 border border-stone-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔔</span>
                  <h4 className="font-serif font-bold text-stone-900 text-base">
                    Suggested Reminders
                  </h4>
                </div>
                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  {analysis.suggestedReminders.length}
                </span>
              </div>

              {analysis.suggestedReminders.length === 0 ? (
                <p className="text-xs font-sans text-stone-400 italic py-2">
                  No anticipatory reminders needed for this entry.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {analysis.suggestedReminders.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-amber-50/60 font-sans text-xs border border-amber-100 flex items-start gap-2"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-stone-800 font-medium">{r.reminder}</p>
                        {r.targetItemTitle && (
                          <p className="text-[10px] text-stone-500">
                            Linked to: {r.targetItemTitle} {r.targetDate ? `(${r.targetDate})` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Primary CTA: Review & Add to Calendar */}
          {totalActionable > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-100/90 to-amber-200/70 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-800 text-amber-50 flex items-center justify-center">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-serif font-bold text-stone-900 text-base">
                    🔔 I found {totalActionable} items you may want to add to your calendar.
                  </h5>
                  <p className="text-xs font-sans text-stone-700">
                    Review each proposed date, time, and reminder setting before confirming.
                  </p>
                </div>
              </div>

              <button
                id={`btn-review-calendar-${reflection.id}`}
                onClick={handleReviewAllCalendarItems}
                className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 font-sans text-xs font-semibold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>Review & Add to Calendar</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      )}

      {/* Calendar Assistant Modal (3-Step Authorization Flow) */}
      <CalendarAssistantModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        userId={userProfile.uid}
        items={itemsForCalendar}
        sourceTitle={reflection.title}
        sourceReflectionId={reflection.id}
        onItemsAdded={(count) => {
          console.log(`Added ${count} items to calendar.`);
        }}
      />
    </div>
  );
};
