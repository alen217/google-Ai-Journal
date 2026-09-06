import React, { useEffect, useState } from "react";
import {
  ObjectiveItem,
  ReminderItem,
  SavedCalendarEvent,
  ReflectionDoc,
  UserProfile,
} from "../types";
import {
  fetchRelatedActionsForReflection,
  updateObjectiveProgress,
  toggleObjectiveStatus,
  makeGoogleCalendarUrl,
  downloadIcsFile,
} from "../lib/actionItemService";
import {
  deleteObjectiveDoc,
  deleteReminderDoc,
  deleteCalendarItemDoc,
} from "../lib/firebase";
import {
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  Target,
  Bell,
  Trash2,
  ExternalLink,
  Download,
  Plus,
  Minus,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface RelatedActionsViewProps {
  reflection: ReflectionDoc;
  userProfile: UserProfile;
  onActionUpdated?: () => void;
  className?: string;
}

export const RelatedActionsView: React.FC<RelatedActionsViewProps> = ({
  reflection,
  userProfile,
  onActionUpdated,
  className = "",
}) => {
  const [objectives, setObjectives] = useState<ObjectiveItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<SavedCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!reflection?.id || !userProfile?.uid) return;
    setIsLoading(true);
    try {
      const data = await fetchRelatedActionsForReflection(userProfile.uid, reflection.id);
      setObjectives(data.objectives);
      setReminders(data.reminders);
      setCalendarEvents(data.calendarEvents);
    } catch (err) {
      console.error("Error loading related actions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reflection.id, userProfile.uid]);

  const handleToggleObjective = async (obj: ObjectiveItem) => {
    try {
      const updated = await toggleObjectiveStatus(userProfile.uid, obj);
      setObjectives((prev) => prev.map((o) => (o.id === obj.id ? updated : o)));
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      console.error("Error toggling objective:", err);
    }
  };

  const handleAdjustProgress = async (obj: ObjectiveItem, delta: number) => {
    const newProgress = Math.min(100, Math.max(0, obj.progress + delta));
    try {
      await updateObjectiveProgress(userProfile.uid, obj.id, newProgress);
      setObjectives((prev) =>
        prev.map((o) =>
          o.id === obj.id
            ? {
                ...o,
                progress: newProgress,
                status: newProgress >= 100 ? "completed" : newProgress > 0 ? "in_progress" : "not_started",
              }
            : o
        )
      );
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      console.error("Error adjusting progress:", err);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    try {
      await deleteObjectiveDoc(userProfile.uid, id);
      setObjectives((prev) => prev.filter((o) => o.id !== id));
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      console.error("Error deleting objective:", err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminderDoc(userProfile.uid, id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      console.error("Error deleting reminder:", err);
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    try {
      await deleteCalendarItemDoc(userProfile.uid, id);
      setCalendarEvents((prev) => prev.filter((c) => c.id !== id));
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      console.error("Error deleting calendar item:", err);
    }
  };

  const totalActionsCount = objectives.length + reminders.length + calendarEvents.length;

  if (isLoading) {
    return (
      <div className={`p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-stone-500 text-xs flex items-center gap-2 ${className}`}>
        <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-600" />
        <span>Checking for connected objectives & reminders...</span>
      </div>
    );
  }

  if (totalActionsCount === 0) {
    return null;
  }

  return (
    <div
      className={`p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-stone-900 shadow-xs space-y-4 ${className}`}
      id="related-actions-section"
    >
      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-800" />
          <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider font-['Plus_Jakarta_Sans']">
            Related actions from this entry
          </h4>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900">
          {totalActionsCount} {totalActionsCount === 1 ? "action item" : "action items"}
        </span>
      </div>

      {/* 1. Objectives */}
      {objectives.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Objectives & Goals
          </span>
          <div className="space-y-2">
            {objectives.map((obj) => (
              <div
                key={obj.id}
                className={`p-3 rounded-xl border transition-all ${
                  obj.status === "completed"
                    ? "bg-emerald-50/60 border-emerald-200 text-stone-600"
                    : "bg-white/90 border-amber-200/90 text-stone-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleObjective(obj)}
                      className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        obj.status === "completed"
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-stone-400 hover:border-amber-600 bg-white"
                      }`}
                      title={obj.status === "completed" ? "Mark incomplete" : "Mark completed"}
                    >
                      {obj.status === "completed" && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold ${
                            obj.status === "completed" ? "line-through text-stone-500" : "text-stone-900"
                          }`}
                        >
                          {obj.title}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            obj.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : obj.status === "in_progress"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {obj.status === "completed"
                            ? "Completed"
                            : obj.status === "in_progress"
                            ? `In Progress (${obj.progress}%)`
                            : "Not Started"}
                        </span>
                        {obj.deadline && (
                          <span className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Due {obj.deadline}</span>
                          </span>
                        )}
                        <span
                          className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${
                            obj.priority === "high"
                              ? "bg-rose-100 text-rose-800"
                              : obj.priority === "medium"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {obj.priority} priority
                        </span>
                      </div>

                      {/* Progress Bar & Adjustment */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              obj.status === "completed" ? "bg-emerald-600" : "bg-amber-600"
                            }`}
                            style={{ width: `${obj.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-stone-500 w-8 text-right">
                          {obj.progress}%
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustProgress(obj, -10)}
                            disabled={obj.progress <= 0}
                            className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30 text-[10px]"
                            title="Decrease progress by 10%"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustProgress(obj, 10)}
                            disabled={obj.progress >= 100}
                            className="p-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-30 text-[10px]"
                            title="Increase progress by 10%"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteObjective(obj.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete objective"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Reminders */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Scheduled Reminders
          </span>
          <div className="space-y-1.5">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className="p-2.5 rounded-xl bg-white/90 border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bell className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="font-semibold text-stone-900 truncate">{rem.title}</span>
                  <span className="text-[10px] text-stone-500 bg-amber-50 px-2 py-0.5 rounded-md font-mono shrink-0">
                    📅 {rem.date} {rem.time ? `• ${rem.time}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteReminder(rem.id)}
                  className="text-stone-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50"
                  title="Remove reminder"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Calendar Events */}
      {calendarEvents.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Calendar Commitments
          </span>
          <div className="space-y-1.5">
            {calendarEvents.map((cal) => (
              <div
                key={cal.id}
                className="p-2.5 rounded-xl bg-white/90 border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-semibold text-stone-900 truncate">{cal.title}</span>
                  <span className="text-[10px] text-stone-500 bg-indigo-50 px-2 py-0.5 rounded-md font-mono shrink-0">
                    {cal.date} {cal.time ? `@ ${cal.time}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={makeGoogleCalendarUrl(cal.title, cal.date, cal.time, cal.description)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-stone-500 hover:text-indigo-600 rounded hover:bg-stone-100"
                    title="Open in Google Calendar"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadIcsFile(cal.title, cal.date, cal.time, cal.description)}
                    className="p-1 text-stone-500 hover:text-indigo-600 rounded hover:bg-stone-100"
                    title="Download .ics file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCalendar(cal.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                    title="Remove calendar item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
