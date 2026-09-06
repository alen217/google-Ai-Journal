import React, { useEffect, useState } from "react";
import {
  ObjectiveItem,
  ReminderItem,
  SavedCalendarEvent,
  UserProfile,
} from "../types";
import {
  fetchUserObjectives,
  fetchUserReminders,
  fetchUserCalendarItems,
  deleteObjectiveDoc,
  deleteReminderDoc,
} from "../lib/firebase";
import {
  updateObjectiveProgress,
  toggleObjectiveStatus,
  makeGoogleCalendarUrl,
  downloadIcsFile,
} from "../lib/actionItemService";
import {
  Target,
  CheckCircle2,
  Clock,
  Calendar,
  Bell,
  Trash2,
  Plus,
  Minus,
  Check,
  ExternalLink,
  Download,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface ActiveObjectivesWidgetProps {
  userProfile: UserProfile;
  onNavigateToEntry?: (reflectionId: string) => void;
  className?: string;
}

export const ActiveObjectivesWidget: React.FC<ActiveObjectivesWidgetProps> = ({
  userProfile,
  onNavigateToEntry,
  className = "",
}) => {
  const [objectives, setObjectives] = useState<ObjectiveItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [calendarItems, setCalendarItems] = useState<SavedCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!userProfile?.uid) return;
    setIsLoading(true);
    try {
      const [objs, rems, cals] = await Promise.all([
        fetchUserObjectives(userProfile.uid),
        fetchUserReminders(userProfile.uid),
        fetchUserCalendarItems(userProfile.uid),
      ]);
      setObjectives(objs);
      setReminders(rems);
      setCalendarItems(cals);
    } catch (err) {
      console.error("Error loading objectives in widget:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userProfile.uid]);

  const handleToggle = async (obj: ObjectiveItem) => {
    try {
      const updated = await toggleObjectiveStatus(userProfile.uid, obj);
      setObjectives((prev) => prev.map((o) => (o.id === obj.id ? updated : o)));
    } catch (err) {
      console.error("Failed to toggle objective:", err);
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
    } catch (err) {
      console.error("Failed to update progress:", err);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    try {
      await deleteObjectiveDoc(userProfile.uid, id);
      setObjectives((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error("Failed to delete objective:", err);
    }
  };

  const inProgressObjectives = objectives.filter((o) => o.status !== "completed");
  const completedObjectives = objectives.filter((o) => o.status === "completed");

  if (isLoading) {
    return (
      <div className={`p-6 rounded-3xl bg-white border border-stone-200 shadow-xs flex items-center justify-center gap-2 text-stone-500 text-xs ${className}`}>
        <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
        <span>Loading your objectives & commitments...</span>
      </div>
    );
  }

  if (objectives.length === 0 && reminders.length === 0 && calendarItems.length === 0) {
    return null; // Keep dashboard clutter-free if none exist yet
  }

  return (
    <div
      className={`p-6 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-5 text-stone-900 ${className}`}
      id="active-objectives-dashboard-widget"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shadow-xs">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 font-['Newsreader'] italic text-base">
              🎯 Active Objectives & Commitments
            </h3>
            <p className="text-[11px] text-stone-500">
              Captured automatically from your reflections and journal entries
            </p>
          </div>
        </div>

        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
          {inProgressObjectives.length} In Progress • {completedObjectives.length} Done
        </span>
      </div>

      {/* 1. In Progress Objectives */}
      {inProgressObjectives.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inProgressObjectives.map((obj) => (
              <div
                key={obj.id}
                className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-2.5 hover:border-amber-400 transition-all shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(obj)}
                      className="mt-0.5 w-4 h-4 rounded-md border border-stone-400 hover:border-amber-600 bg-white flex items-center justify-center"
                      title="Mark as completed"
                    >
                      {obj.status === "completed" && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 leading-snug truncate">
                        {obj.title}
                      </h4>
                      {obj.description && (
                        <p className="text-[11px] text-stone-500 truncate mt-0.5 font-['Newsreader'] italic">
                          {obj.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteObjective(obj.id)}
                    className="text-stone-400 hover:text-rose-600 p-1 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress bar + Controls */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all duration-300"
                      style={{ width: `${obj.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-stone-600 font-bold w-8 text-right">
                    {obj.progress}%
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustProgress(obj, -10)}
                    disabled={obj.progress <= 0}
                    className="p-1 rounded bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 disabled:opacity-30 text-[10px]"
                    title="-10%"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustProgress(obj, 10)}
                    disabled={obj.progress >= 100}
                    className="p-1 rounded bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 disabled:opacity-30 text-[10px]"
                    title="+10%"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Badges: Due date, Priority, Source */}
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  {obj.deadline && (
                    <span className="font-mono text-stone-600 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                      <Clock className="w-3 h-3 text-amber-700" />
                      Due {obj.deadline}
                    </span>
                  )}
                  <span
                    className={`font-semibold uppercase px-1.5 py-0.5 rounded ${
                      obj.priority === "high"
                        ? "bg-rose-100 text-rose-800"
                        : obj.priority === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {obj.priority}
                  </span>
                  {obj.sourceReflectionId && onNavigateToEntry && (
                    <button
                      type="button"
                      onClick={() => onNavigateToEntry(obj.sourceReflectionId!)}
                      className="text-amber-800 hover:underline flex items-center gap-0.5 ml-auto"
                    >
                      <span>From Entry</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Upcoming Reminders and Calendar Events */}
      {(reminders.length > 0 || calendarItems.length > 0) && (
        <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-2 text-xs">
          {reminders.slice(0, 3).map((r) => (
            <div
              key={r.id}
              className="px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center gap-2 text-stone-800"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-semibold">{r.title}</span>
              <span className="text-[10px] text-stone-500 font-mono">📅 {r.date}</span>
            </div>
          ))}

          {calendarItems.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2 text-indigo-950"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span className="font-semibold">{c.title}</span>
              <span className="text-[10px] text-indigo-700 font-mono">
                {c.date} {c.time ? `@ ${c.time}` : ""}
              </span>
              <a
                href={makeGoogleCalendarUrl(c.title, c.date, c.time, c.description)}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-800 p-0.5"
                title="Google Calendar"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
