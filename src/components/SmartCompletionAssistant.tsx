import React, { useState, useEffect } from "react";
import {
  DetectedActionItem,
  ReflectionDoc,
  UserProfile,
  ObjectivePriority,
  ObjectiveStatus,
} from "../types";
import {
  extractActionItems,
  convertActionToObjective,
  convertActionToReminder,
  convertActionToCalendarEvent,
  makeGoogleCalendarUrl,
  downloadIcsFile,
} from "../lib/actionItemService";
import {
  fetchUserObjectives,
  fetchUserReminders,
  fetchUserCalendarItems,
} from "../lib/firebase";
import {
  Sparkles,
  CheckCircle2,
  Calendar as CalendarIcon,
  Bell,
  Target,
  X,
  Edit2,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Download,
  HelpCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface SmartCompletionAssistantProps {
  reflection: ReflectionDoc;
  userProfile: UserProfile;
  rawJournalText: string;
  onActionsUpdated?: () => void;
  className?: string;
}

export const SmartCompletionAssistant: React.FC<SmartCompletionAssistantProps> = ({
  reflection,
  userProfile,
  rawJournalText,
  onActionsUpdated,
  className = "",
}) => {
  const [items, setItems] = useState<DetectedActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);

  // In-line editing state for a specific task
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  // Objective conversion modal / drawer state
  const [objectiveModalItem, setObjectiveModalItem] = useState<DetectedActionItem | null>(null);
  const [objTitle, setObjTitle] = useState("");
  const [objDescription, setObjDescription] = useState("");
  const [objDeadline, setObjDeadline] = useState("");
  const [objPriority, setObjPriority] = useState<ObjectivePriority>("medium");
  const [objProgress, setObjProgress] = useState(0);
  const [objReminderEnabled, setObjReminderEnabled] = useState(false);
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Time picker state for Calendar addition when time is missing
  const [calendarModalItem, setCalendarModalItem] = useState<DetectedActionItem | null>(null);
  const [calTime, setCalTime] = useState("10:00");
  const [calDate, setCalDate] = useState("");

  // Success notifications per item (e.g. { [itemId]: "Saved as Objective!" })
  const [itemStatuses, setItemStatuses] = useState<Record<string, { message: string; type: "objective" | "reminder" | "calendar"; id?: string }>>({});

  // Auto-analyze after saving or mount if text exists and not analyzed
  useEffect(() => {
    if (
      rawJournalText &&
      !hasAnalyzed &&
      !isLoading &&
      userProfile.privacyAISettings?.aiAnalysisEnabled !== false &&
      userProfile.privacyAISettings?.smartTaskDetection !== false
    ) {
      handleAnalyzeEntry();
    }
  }, [rawJournalText, reflection.id, userProfile.privacyAISettings]);

  const handleAnalyzeEntry = async () => {
    if (!rawJournalText.trim()) return;

    if (
      userProfile.privacyAISettings?.aiAnalysisEnabled === false ||
      userProfile.privacyAISettings?.smartTaskDetection === false
    ) {
      setRationale("AI task detection is currently paused in your Privacy & AI settings.");
      setHasAnalyzed(true);
      return;
    }

    setIsLoading(true);
    setAnalysisError(null);

    try {
      // 1. Fetch existing titles to avoid duplicate suggestions
      const [existingObjs, existingRems, existingCals] = await Promise.all([
        fetchUserObjectives(userProfile.uid),
        fetchUserReminders(userProfile.uid),
        fetchUserCalendarItems(userProfile.uid),
      ]);

      const existingTitles = [
        ...existingObjs.map((o) => o.title),
        ...existingRems.map((r) => r.title),
        ...existingCals.map((c) => c.title),
      ];

      // 2. Call the action items extractor
      const result = await extractActionItems(
        rawJournalText,
        reflection.date,
        existingTitles
      );

      setItems(result.detectedItems);
      setRationale(result.rationale);
      setHasAnalyzed(true);
    } catch (err: any) {
      console.error("Action item analysis failed:", err);
      setAnalysisError(err?.message || "Could not analyze reflection for action items.");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Inline Task Editing
  // -------------------------------------------------------------
  const handleStartEditing = (item: DetectedActionItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDate(item.date || "");
    setEditTime(item.time || "");
  };

  const handleSaveEditing = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            title: editTitle.trim() || item.title,
            date: editDate || undefined,
            time: editTime || undefined,
            isAmbiguousDate: editDate ? false : item.isAmbiguousDate,
          };
        }
        return item;
      })
    );
    setEditingItemId(null);
  };

  // -------------------------------------------------------------
  // Conversational Ambiguity Answers (Today, Tomorrow, This Week, Pick Date)
  // -------------------------------------------------------------
  const handleClarifyDate = (itemId: string, choice: "today" | "tomorrow" | "this_week" | "choose_date") => {
    const today = new Date();
    let newDateStr = today.toISOString().slice(0, 10);

    if (choice === "tomorrow") {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      newDateStr = tomorrow.toISOString().slice(0, 10);
    } else if (choice === "this_week") {
      // nearest Friday
      const friday = new Date(today);
      const dayOffset = (5 + 7 - today.getDay()) % 7 || 7;
      friday.setDate(today.getDate() + dayOffset);
      newDateStr = friday.toISOString().slice(0, 10);
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            date: newDateStr,
            isAmbiguousDate: false,
            relativeDateText: choice === "today" ? "Today" : choice === "tomorrow" ? "Tomorrow" : "This Friday",
          };
        }
        return item;
      })
    );

    if (choice === "choose_date") {
      const item = items.find((i) => i.id === itemId);
      if (item) handleStartEditing(item);
    }
  };

  // -------------------------------------------------------------
  // Action: Add Reminder
  // -------------------------------------------------------------
  const handleAddReminder = async (item: DetectedActionItem) => {
    setIsSavingAction(true);
    try {
      const reminder = await convertActionToReminder(userProfile.uid, item, reflection, {
        customTitle: item.title,
        date: item.date || new Date().toISOString().slice(0, 10),
        time: item.time || "09:00",
      });

      setItemStatuses((prev) => ({
        ...prev,
        [item.id]: {
          message: `✓ Reminder set for ${reminder.date}${reminder.time ? ` at ${reminder.time}` : ""}`,
          type: "reminder",
          id: reminder.id,
        },
      }));

      if (onActionsUpdated) onActionsUpdated();
    } catch (err: any) {
      alert("Failed to save reminder: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingAction(false);
    }
  };

  // -------------------------------------------------------------
  // Action: Add to Calendar
  // -------------------------------------------------------------
  const handleOpenCalendarModal = (item: DetectedActionItem) => {
    setCalendarModalItem(item);
    setCalDate(item.date || new Date().toISOString().slice(0, 10));
    setCalTime(item.time || "10:00");
  };

  const handleConfirmAddToCalendar = async () => {
    if (!calendarModalItem) return;
    setIsSavingAction(true);

    try {
      const calEvent = await convertActionToCalendarEvent(
        userProfile.uid,
        calendarModalItem,
        reflection,
        {
          customTitle: calendarModalItem.title,
          date: calDate,
          time: calTime,
        }
      );

      setItemStatuses((prev) => ({
        ...prev,
        [calendarModalItem.id]: {
          message: `✓ Added to Calendar on ${calDate} at ${calTime}`,
          type: "calendar",
          id: calEvent.id,
        },
      }));

      setCalendarModalItem(null);
      if (onActionsUpdated) onActionsUpdated();
    } catch (err: any) {
      alert("Failed to add to calendar: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingAction(false);
    }
  };

  // -------------------------------------------------------------
  // Action: Add as Objective
  // -------------------------------------------------------------
  const handleOpenObjectiveModal = (item: DetectedActionItem) => {
    setObjectiveModalItem(item);
    setObjTitle(item.title);
    setObjDescription(item.confidenceReason || "");
    setObjDeadline(item.date || "");
    setObjPriority(item.priority || "medium");
    setObjProgress(0);
    setObjReminderEnabled(Boolean(item.date));
  };

  const handleConfirmCreateObjective = async () => {
    if (!objectiveModalItem) return;
    setIsSavingAction(true);

    try {
      const obj = await convertActionToObjective(
        userProfile.uid,
        objectiveModalItem,
        reflection,
        {
          customTitle: objTitle.trim() || objectiveModalItem.title,
          description: objDescription.trim(),
          deadline: objDeadline || undefined,
          priority: objPriority,
          initialProgress: objProgress,
          reminderDate: objReminderEnabled && objDeadline ? objDeadline : undefined,
          reminderTime: "09:00",
        }
      );

      setItemStatuses((prev) => ({
        ...prev,
        [objectiveModalItem.id]: {
          message: `✓ Added as Objective (${objPriority} priority)`,
          type: "objective",
          id: obj.id,
        },
      }));

      setObjectiveModalItem(null);
      if (onActionsUpdated) onActionsUpdated();
    } catch (err: any) {
      alert("Failed to save objective: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingAction(false);
    }
  };

  // -------------------------------------------------------------
  // Action: Dismiss
  // -------------------------------------------------------------
  const handleDismiss = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <div
      className={`rounded-3xl border border-amber-300/80 bg-gradient-to-b from-amber-50/90 to-orange-50/70 p-5 sm:p-6 shadow-sm text-stone-900 transition-all ${className}`}
      id="smart-completion-assistant"
    >
      {/* Top Banner Header: Matches Paper Journal Aesthetic */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/80">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-amber-400/90 text-amber-950 flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-950 font-['Newsreader'] italic text-base">
                ✨ Things to remember
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono">
                Smart Assistant
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              You mentioned a few things that may need your attention.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleAnalyzeEntry}
            disabled={isLoading}
            className="text-[11px] font-semibold text-amber-900 hover:text-amber-950 px-2.5 py-1 rounded-xl bg-amber-100/80 hover:bg-amber-200/80 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Re-analyze reflection text"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Analyzing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-stone-600 animate-pulse">
          <Sparkles className="w-5 h-5 text-amber-600 animate-spin" />
          <p className="text-xs font-medium font-['Plus_Jakarta_Sans']">
            Reading your thoughts for commitments, deadlines, and unfinished tasks...
          </p>
        </div>
      )}

      {/* Error state */}
      {analysisError && !isLoading && (
        <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{analysisError}</span>
          <button
            onClick={() => setAnalysisError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Zero items state */}
      {!isLoading && hasAnalyzed && items.length === 0 && (
        <div className="py-6 text-center space-y-1">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
          <p className="text-xs font-semibold text-stone-700">
            No unfinished tasks or commitments found in this entry.
          </p>
          <p className="text-[11px] text-stone-500 font-['Newsreader'] italic">
            Enjoy your day and keep reflecting freely!
          </p>
        </div>
      )}

      {/* List of Detected Action Items */}
      {!isLoading && items.length > 0 && (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const isEditing = editingItemId === item.id;
            const status = itemStatuses[item.id];

            return (
              <div
                key={item.id}
                className="bg-white/95 rounded-2xl border border-amber-200/90 p-4 shadow-xs hover:border-amber-400/80 transition-all space-y-3"
              >
                {/* Status confirmed badge if already converted */}
                {status ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 animate-fade-in">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{status.message}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
                      Confirmed
                    </span>
                  </div>
                ) : null}

                {/* Card Title & Edit Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="mt-0.5 text-amber-700 text-sm font-bold select-none">
                      ☐
                    </span>

                    {isEditing ? (
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full text-xs font-bold text-stone-900 border border-amber-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                          placeholder="Task title"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="text-[11px] font-mono border border-stone-300 rounded-lg px-2 py-1 text-stone-700 outline-none"
                          />
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="text-[11px] font-mono border border-stone-300 rounded-lg px-2 py-1 text-stone-700 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditing(item.id)}
                            className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="px-2 py-1 text-stone-500 hover:text-stone-800 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-stone-900 leading-snug">
                            {item.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleStartEditing(item)}
                            className="text-stone-400 hover:text-stone-700 p-0.5 rounded transition-colors"
                            title="Edit task text before saving"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Date & Phrasing Badges */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                          {item.date ? (
                            <span className="font-mono text-stone-600 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-amber-700" />
                              <span>{item.relativeDateText || item.date}</span>
                              {item.time ? <span>• {item.time}</span> : null}
                            </span>
                          ) : null}

                          {item.isDuplicate && (
                            <span className="text-[10px] text-amber-800 bg-amber-100/90 font-semibold px-2 py-0.5 rounded-md">
                              Already in your tasks
                            </span>
                          )}

                          {item.confidenceReason && (
                            <span className="text-[11px] text-stone-500 italic truncate max-w-xs font-['Newsreader']">
                              &ldquo;{item.confidenceReason}&rdquo;
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dismiss Button */}
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.id)}
                    className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
                    title="Dismiss this suggestion"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Conversational Ambiguity Follow-up */}
                {item.isAmbiguousDate && !isEditing && (
                  <div className="p-3 rounded-xl bg-amber-100/60 border border-amber-200 text-xs text-amber-950 space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        {item.clarificationPrompt ||
                          `I noticed you mentioned "${item.title}". When would you like to complete it?`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleClarifyDate(item.id, "today")}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-200/80 text-amber-950 border border-amber-300 font-semibold text-[11px] transition-colors"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClarifyDate(item.id, "tomorrow")}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-200/80 text-amber-950 border border-amber-300 font-semibold text-[11px] transition-colors"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClarifyDate(item.id, "this_week")}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-200/80 text-amber-950 border border-amber-300 font-semibold text-[11px] transition-colors"
                      >
                        This week
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClarifyDate(item.id, "choose_date")}
                        className="px-2.5 py-1 rounded-lg bg-amber-800 text-white font-semibold text-[11px] hover:bg-amber-900 transition-colors"
                      >
                        Choose date
                      </button>
                    </div>
                  </div>
                )}

                {/* Proactive Calendar Suggestion Banner */}
                {(item.category === "meeting" ||
                  item.category === "appointment" ||
                  item.category === "deadline" ||
                  item.category === "submission" ||
                  item.category === "event") &&
                  !status && (
                    <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-950">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                        <span className="font-medium">
                          📅 <strong>Add to Calendar?</strong> You mentioned{" "}
                          <span className="italic">{item.title}</span>{" "}
                          {item.relativeDateText ? item.relativeDateText : ""}.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenCalendarModal(item)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-[11px] transition-colors"
                        >
                          Add to Calendar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddReminder(item)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-semibold text-[11px] transition-colors"
                        >
                          Remind Me
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismiss(item.id)}
                          className="text-stone-400 hover:text-stone-700 text-[11px] px-1.5"
                        >
                          Not Now
                        </button>
                      </div>
                    </div>
                  )}

                {/* Actionable Buttons Bar: [Add Reminder] [Add to Calendar] [Add as Objective] [Dismiss] */}
                {!status && (
                  <div className="flex items-center gap-2 pt-1 flex-wrap border-t border-stone-100 text-xs">
                    <button
                      type="button"
                      onClick={() => handleAddReminder(item)}
                      disabled={isSavingAction}
                      className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Set an in-app reminder"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-700" />
                      <span>Add Reminder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCalendarModal(item)}
                      disabled={isSavingAction}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      title="Proactively sync with Google Calendar or .ics"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Add to Calendar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenObjectiveModal(item)}
                      disabled={isSavingAction}
                      className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-100 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
                      title="Convert to tracked Objective with progress and priority"
                    >
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>Add as Objective</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDismiss(item.id)}
                      className="px-2.5 py-1.5 text-stone-400 hover:text-stone-700 text-xs ml-auto"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 1: ADD AS OBJECTIVE                                      */}
      {/* ============================================================= */}
      {objectiveModalItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-['Newsreader'] italic text-base">
                    Create Objective
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Track ongoing progress from this reflection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setObjectiveModalItem(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Objective Title
                </label>
                <input
                  type="text"
                  value={objTitle}
                  onChange={(e) => setObjTitle(e.target.value)}
                  className="w-full font-semibold border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="e.g. Finish final project report"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Description / Notes
                </label>
                <textarea
                  value={objDescription}
                  onChange={(e) => setObjDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                  placeholder="Details, requirements or next steps..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={objDeadline}
                    onChange={(e) => setObjDeadline(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-stone-800 font-mono focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={objPriority}
                    onChange={(e) => setObjPriority(e.target.value as ObjectivePriority)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-stone-800 focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between font-semibold text-stone-700">
                  <span>Current Progress</span>
                  <span className="font-mono text-amber-900 font-bold">{objProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={objProgress}
                  onChange={(e) => setObjProgress(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono">
                  <span>Not Started (0%)</span>
                  <span>In Progress (50%)</span>
                  <span>Completed (100%)</span>
                </div>
              </div>

              {/* Optional Reminder Checkbox */}
              {objDeadline && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-stone-700">
                  <input
                    type="checkbox"
                    checked={objReminderEnabled}
                    onChange={(e) => setObjReminderEnabled(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Set automatic reminder on deadline day at 09:00 AM</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setObjectiveModalItem(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateObjective}
                disabled={isSavingAction}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingAction ? "Saving..." : "Create Objective"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: ADD TO CALENDAR TIME SELECTION                        */}
      {/* ============================================================= */}
      {calendarModalItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-['Newsreader'] italic text-base">
                    Add to Calendar
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Schedule event with exact date and time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalendarModalItem(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-500 text-[10px] block uppercase tracking-wider font-semibold">
                  Event Title
                </span>
                <span className="font-bold text-stone-900 text-sm">
                  {calendarModalItem.title}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-stone-800 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Event Time
                  </label>
                  <input
                    type="time"
                    value={calTime}
                    onChange={(e) => setCalTime(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-stone-800 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Direct Links */}
              <div className="pt-2 flex items-center gap-2">
                <a
                  href={makeGoogleCalendarUrl(calendarModalItem.title, calDate, calTime)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Calendar</span>
                </a>

                <button
                  type="button"
                  onClick={() => downloadIcsFile(calendarModalItem.title, calDate, calTime)}
                  className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
                  title="Download .ics file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.ics file</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCalendarModalItem(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddToCalendar}
                disabled={isSavingAction}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {isSavingAction ? "Saving..." : "Save to My Calendar"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
