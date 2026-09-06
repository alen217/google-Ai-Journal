import React, { useState, useEffect, useMemo } from "react";
import {
  ObjectiveItem,
  ReminderItem,
  UserProfile,
  ReflectionDoc,
  ObjectivePriority,
  ObjectiveStatus,
} from "../types";
import {
  fetchUserObjectives,
  fetchUserReminders,
  updateObjectiveDoc,
  deleteObjectiveDoc,
  deleteReminderDoc,
  updateReminderDoc,
  persistObjective,
  getTodayDateString,
} from "../lib/firebase";
import {
  makeGoogleCalendarUrl,
  downloadIcsFile,
} from "../lib/actionItemService";
import {
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  ExternalLink,
  Download,
  Edit2,
  Trash2,
  ChevronRight,
  Sparkles,
  Plus,
  Filter,
  Check,
  X,
  BookOpen,
  ArrowRight,
  Bell,
  RefreshCw,
  Search,
  Hourglass,
  Tag,
  Flag,
  Share2,
  MoreVertical,
  PartyPopper
} from "lucide-react";

interface UnfinishedThingsDashboardProps {
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  onOpenReflection: (doc: ReflectionDoc, highlightText?: string) => void;
  className?: string;
  isStandaloneView?: boolean;
  onNavigateBack?: () => void;
}

export type SectionFilter = "all" | "due_soon" | "in_progress" | "no_deadline" | "waiting";

export const UnfinishedThingsDashboard: React.FC<UnfinishedThingsDashboardProps> = ({
  userProfile,
  reflections,
  onOpenReflection,
  className = "",
  isStandaloneView = false,
  onNavigateBack,
}) => {
  const [objectives, setObjectives] = useState<ObjectiveItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SectionFilter>("all");

  // Editing state for an item
  const [editingItem, setEditingItem] = useState<ObjectiveItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editPriority, setEditPriority] = useState<ObjectivePriority>("medium");
  const [editProgress, setEditProgress] = useState(0);
  const [editIsWaiting, setEditIsWaiting] = useState(false);
  const [editWaitingOn, setEditWaitingOn] = useState("");

  // New item modal
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newPriority, setNewPriority] = useState<ObjectivePriority>("medium");
  const [newCategory, setNewCategory] = useState<"standard" | "waiting">("standard");
  const [newWaitingOn, setNewWaitingOn] = useState("");

  // Snooze dropdown tracking
  const [snoozingItemId, setSnoozingItemId] = useState<string | null>(null);

  // Load objectives & reminders from Firestore
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [objs, rems] = await Promise.all([
        fetchUserObjectives(userProfile.uid),
        fetchUserReminders(userProfile.uid),
      ]);
      setObjectives(objs);
      setReminders(rems);
    } catch (err) {
      console.error("Failed to load unfinished things:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userProfile.uid]);

  const todayStr = getTodayDateString();

  // Helper to test if date is due soon (within 3 days or overdue)
  const isDateDueSoon = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const target = new Date(dateStr).getTime();
    const today = new Date(todayStr).getTime();
    const diffDays = (target - today) / (1000 * 60 * 60 * 24);
    // Overdue or due within 3 days
    return diffDays <= 3;
  };

  // -------------------------------------------------------------
  // Filter and Categorize Items into 4 Sections
  // -------------------------------------------------------------
  const categorized = useMemo(() => {
    const activeObjectives = objectives.filter(
      (item) => item.status !== "completed"
    );

    // 1. 🔵 Waiting: Items waiting on someone else
    const waitingItems = activeObjectives.filter(
      (item) => item.isWaiting || item.title.toLowerCase().startsWith("waiting for")
    );
    const nonWaiting = activeObjectives.filter(
      (item) => !item.isWaiting && !item.title.toLowerCase().startsWith("waiting for")
    );

    // 2. 🔴 Due Soon: Has approaching deadline
    const dueSoonItems = nonWaiting.filter(
      (item) => item.deadline && isDateDueSoon(item.deadline)
    );

    // 3. 🟡 In Progress: Started (progress > 0 or status === "in_progress") and not in due soon
    const inProgressItems = nonWaiting.filter(
      (item) =>
        !dueSoonItems.includes(item) &&
        (item.status === "in_progress" || (item.progress > 0 && item.progress < 100))
    );

    // 4. ⚪ No Deadline: Unfinished items without a deadline and not waiting
    const noDeadlineItems = nonWaiting.filter(
      (item) => !item.deadline && !inProgressItems.includes(item)
    );

    return {
      dueSoon: dueSoonItems,
      inProgress: inProgressItems,
      noDeadline: noDeadlineItems,
      waiting: waitingItems,
      totalCount: activeObjectives.length,
    };
  }, [objectives, todayStr]);

  // Handle Completing an Item
  const handleToggleComplete = async (item: ObjectiveItem) => {
    const newStatus: ObjectiveStatus = item.status === "completed" ? "in_progress" : "completed";
    const newProgress = newStatus === "completed" ? 100 : item.progress === 100 ? 50 : item.progress;

    // Optimistic UI update
    setObjectives((prev) =>
      prev.map((o) => (o.id === item.id ? { ...o, status: newStatus, progress: newProgress } : o))
    );

    try {
      await updateObjectiveDoc(userProfile.uid, item.id, {
        status: newStatus,
        progress: newProgress,
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      loadData();
    }
  };

  // Handle Updating Progress for In-Progress item
  const handleUpdateProgress = async (item: ObjectiveItem, newProgress: number) => {
    const newStatus: ObjectiveStatus =
      newProgress >= 100 ? "completed" : newProgress > 0 ? "in_progress" : "not_started";

    setObjectives((prev) =>
      prev.map((o) => (o.id === item.id ? { ...o, progress: newProgress, status: newStatus } : o))
    );

    try {
      await updateObjectiveDoc(userProfile.uid, item.id, {
        progress: newProgress,
        status: newStatus,
      });
    } catch (err) {
      console.error("Failed to update progress:", err);
      loadData();
    }
  };

  // Handle Snoozing an Item
  const handleSnooze = async (item: ObjectiveItem, days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const newDeadline = d.toISOString().slice(0, 10);

    setObjectives((prev) =>
      prev.map((o) => (o.id === item.id ? { ...o, deadline: newDeadline, snoozedUntil: newDeadline } : o))
    );
    setSnoozingItemId(null);

    try {
      await updateObjectiveDoc(userProfile.uid, item.id, {
        deadline: newDeadline,
        snoozedUntil: newDeadline,
      });
    } catch (err) {
      console.error("Failed to snooze:", err);
      loadData();
    }
  };

  // Handle Dismissing / Deleting an Item
  const handleDismiss = async (item: ObjectiveItem) => {
    setObjectives((prev) => prev.filter((o) => o.id !== item.id));
    try {
      await deleteObjectiveDoc(userProfile.uid, item.id);
    } catch (err) {
      console.error("Failed to delete objective:", err);
      loadData();
    }
  };

  // Save Edit Item Modal
  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const updates: Partial<ObjectiveItem> = {
      title: editTitle.trim() || editingItem.title,
      deadline: editDeadline || undefined,
      priority: editPriority,
      progress: editProgress,
      status: editProgress >= 100 ? "completed" : editProgress > 0 ? "in_progress" : "not_started",
      isWaiting: editIsWaiting,
      waitingOn: editWaitingOn.trim() || undefined,
    };

    setObjectives((prev) =>
      prev.map((o) => (o.id === editingItem.id ? { ...o, ...updates } : o))
    );
    setEditingItem(null);

    try {
      await updateObjectiveDoc(userProfile.uid, editingItem.id, updates);
    } catch (err) {
      console.error("Failed to save edit:", err);
      loadData();
    }
  };

  // Save New Unfinished Item
  const handleAddNewItem = async () => {
    if (!newTitle.trim()) return;

    const newObj: ObjectiveItem = {
      id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: userProfile.uid,
      title: newTitle.trim(),
      deadline: newDeadline || undefined,
      priority: newPriority,
      progress: 0,
      status: "not_started",
      isWaiting: newCategory === "waiting",
      waitingOn: newCategory === "waiting" ? newWaitingOn.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setObjectives((prev) => [newObj, ...prev]);
    setIsAddingNew(false);
    setNewTitle("");
    setNewDeadline("");
    setNewWaitingOn("");

    try {
      await persistObjective(userProfile.uid, newObj);
    } catch (err) {
      console.error("Failed to persist new objective:", err);
      loadData();
    }
  };

  // Open original reflection with sentence highlight
  const handleOpenSourceReflection = (item: ObjectiveItem) => {
    if (!item.sourceReflectionId) return;
    const foundDoc = reflections.find((r) => r.id === item.sourceReflectionId);
    if (foundDoc) {
      onOpenReflection(foundDoc, item.sourceSentence || item.title);
    }
  };

  // Calculate deadline relative badge text
  const formatDeadlineBadge = (deadlineStr?: string) => {
    if (!deadlineStr) return null;
    const today = new Date(todayStr).getTime();
    const target = new Date(deadlineStr).getTime();
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { text: `Overdue by ${Math.abs(diff)}d`, isUrgent: true };
    if (diff === 0) return { text: "Due today", isUrgent: true };
    if (diff === 1) return { text: "Tomorrow", isUrgent: true };
    if (diff <= 3) return { text: `In ${diff} days`, isUrgent: true };
    return { text: deadlineStr, isUrgent: false };
  };

  return (
    <div
      id="unfinished-things-dashboard"
      className={`rounded-3xl bg-white border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-6 ${className}`}
    >
      {/* ------------------------------------------------------------- */}
      {/* HEADER ROW */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shadow-2xs">
              <Hourglass className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-['Plus_Jakarta_Sans'] text-stone-900 flex items-center gap-2">
                Things you haven't finished
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  {categorized.totalCount}
                </span>
              </h2>
              <p className="text-xs text-stone-500 font-['Plus_Jakarta_Sans']">
                Actionable tasks and objectives gathered from your journal entries so nothing gets left behind.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setIsAddingNew(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>

          {isStandaloneView && onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors"
            >
              &larr; Back to Dashboard
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FILTER TABS & SEARCH */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeFilter === "all"
                ? "bg-stone-900 text-amber-300 shadow-2xs"
                : "bg-stone-100 hover:bg-stone-200 text-stone-600"
            }`}
          >
            All Items ({categorized.totalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("due_soon")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === "due_soon"
                ? "bg-rose-900 text-rose-100 shadow-2xs"
                : "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60"
            }`}
          >
            <span>🔴 Due Soon</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-200/80 text-rose-950">
              {categorized.dueSoon.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("in_progress")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === "in_progress"
                ? "bg-amber-800 text-amber-100 shadow-2xs"
                : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60"
            }`}
          >
            <span>🟡 In Progress</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-200/80 text-amber-950">
              {categorized.inProgress.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("no_deadline")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === "no_deadline"
                ? "bg-stone-800 text-stone-100 shadow-2xs"
                : "bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200"
            }`}
          >
            <span>⚪ No Deadline</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-800">
              {categorized.noDeadline.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("waiting")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === "waiting"
                ? "bg-sky-900 text-sky-100 shadow-2xs"
                : "bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/60"
            }`}
          >
            <span>🔵 Waiting</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-200/80 text-sky-950">
              {categorized.waiting.length}
            </span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-44"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ALL CAUGHT UP EMPTY STATE */}
      {/* ------------------------------------------------------------- */}
      {categorized.totalCount === 0 && !isLoading && (
        <div className="py-12 px-6 text-center space-y-3 rounded-3xl bg-amber-50/50 border border-amber-200/60 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mx-auto text-amber-700 shadow-xs">
            <PartyPopper className="w-7 h-7 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 font-['Newsreader'] italic">
            You're all caught up!
          </h3>
          <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
            Nothing is waiting for you right now. Enjoy the moment. As you write new journal entries, unfinished commitments and deadlines will gently appear here.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTIONS RENDER */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-7">
        
        {/* ========================================================= */}
        {/* 1. 🔴 DUE SOON SECTION */}
        {/* ========================================================= */}
        {(activeFilter === "all" || activeFilter === "due_soon") && categorized.dueSoon.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-950 font-['Plus_Jakarta_Sans']">
                Due Soon ({categorized.dueSoon.length})
              </h3>
              <span className="text-[11px] text-stone-400">· Approaching deadlines</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categorized.dueSoon
                .filter((item) =>
                  !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((item) => {
                  const badge = formatDeadlineBadge(item.deadline);
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-stone-900 leading-snug font-['Plus_Jakarta_Sans']">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-rose-800 font-medium">
                            {badge && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-semibold text-[11px]">
                                {badge.text}
                              </span>
                            )}
                            {item.sourceReflectionTitle && (
                              <button
                                onClick={() => handleOpenSourceReflection(item)}
                                className="text-stone-500 hover:text-stone-800 flex items-center gap-1 italic truncate max-w-[200px]"
                                title="Open original reflection"
                              >
                                From "{item.sourceReflectionTitle}"
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                            item.priority === "high"
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-rose-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(item)}
                            className="px-3 py-1 rounded-lg bg-white hover:bg-rose-100 text-rose-950 border border-rose-300 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Complete</span>
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setSnoozingItemId(snoozingItemId === item.id ? null : item.id)
                              }
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-medium shadow-2xs transition-colors flex items-center gap-1"
                            >
                              <Clock className="w-3.5 h-3.5 text-stone-500" />
                              <span>Snooze</span>
                            </button>

                            {snoozingItemId === item.id && (
                              <div className="absolute left-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-stone-200 p-1.5 w-32 space-y-1 text-xs font-medium">
                                <button
                                  onClick={() => handleSnooze(item, 1)}
                                  className="w-full text-left px-2.5 py-1 rounded hover:bg-stone-100 text-stone-700"
                                >
                                  +1 Day
                                </button>
                                <button
                                  onClick={() => handleSnooze(item, 3)}
                                  className="w-full text-left px-2.5 py-1 rounded hover:bg-stone-100 text-stone-700"
                                >
                                  +3 Days
                                </button>
                                <button
                                  onClick={() => handleSnooze(item, 7)}
                                  className="w-full text-left px-2.5 py-1 rounded hover:bg-stone-100 text-stone-700"
                                >
                                  +1 Week
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-stone-400">
                          <a
                            href={makeGoogleCalendarUrl(
                              item.title,
                              item.deadline,
                              item.reminder?.time,
                              item.description
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:text-stone-700 hover:bg-white"
                            title="Add to Google Calendar"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setEditTitle(item.title);
                              setEditDeadline(item.deadline || "");
                              setEditPriority(item.priority);
                              setEditProgress(item.progress);
                              setEditIsWaiting(Boolean(item.isWaiting));
                              setEditWaitingOn(item.waitingOn || "");
                            }}
                            className="p-1 rounded hover:text-stone-700 hover:bg-white"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDismiss(item)}
                            className="p-1 rounded hover:text-rose-600 hover:bg-white"
                            title="Dismiss task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. 🟡 IN PROGRESS SECTION */}
        {/* ========================================================= */}
        {(activeFilter === "all" || activeFilter === "in_progress") && categorized.inProgress.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 font-['Plus_Jakarta_Sans']">
                In Progress ({categorized.inProgress.length})
              </h3>
              <span className="text-[11px] text-stone-400">· Started objectives</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categorized.inProgress
                .filter((item) =>
                  !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-stone-900 leading-snug font-['Plus_Jakarta_Sans']">
                          {item.title}
                        </h4>
                        {item.sourceReflectionTitle && (
                          <button
                            onClick={() => handleOpenSourceReflection(item)}
                            className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 italic truncate max-w-[220px]"
                          >
                            From "{item.sourceReflectionTitle}"
                          </button>
                        )}
                      </div>

                      <span className="text-xs font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                        {item.progress}% complete
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="w-full bg-amber-100/80 rounded-full h-2.5 overflow-hidden border border-amber-200">
                        <div
                          className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(5, item.progress)}%` }}
                        />
                      </div>

                      {/* Quick progress adjustments */}
                      <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                        <span>Set progress:</span>
                        <div className="flex items-center gap-1">
                          {[25, 50, 75, 100].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleUpdateProgress(item, val)}
                              className={`px-1.5 py-0.5 rounded ${
                                item.progress === val
                                  ? "bg-amber-600 text-white font-bold"
                                  : "hover:bg-amber-100 text-stone-600"
                              }`}
                            >
                              {val}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-amber-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateProgress(item, Math.min(100, item.progress + 20))}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-medium shadow-2xs transition-colors"
                        >
                          + Continue
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-stone-400">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditTitle(item.title);
                            setEditDeadline(item.deadline || "");
                            setEditPriority(item.priority);
                            setEditProgress(item.progress);
                            setEditIsWaiting(Boolean(item.isWaiting));
                            setEditWaitingOn(item.waitingOn || "");
                          }}
                          className="p-1 rounded hover:text-stone-700 hover:bg-white"
                          title="Edit task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismiss(item)}
                          className="p-1 rounded hover:text-rose-600 hover:bg-white"
                          title="Dismiss task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. ⚪ NO DEADLINE SECTION */}
        {/* ========================================================= */}
        {(activeFilter === "all" || activeFilter === "no_deadline") && categorized.noDeadline.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 font-['Plus_Jakarta_Sans']">
                No Deadline ({categorized.noDeadline.length})
              </h3>
              <span className="text-[11px] text-stone-400">· Open intentions and aspirations</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categorized.noDeadline
                .filter((item) =>
                  !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-stone-900 leading-snug font-['Plus_Jakarta_Sans']">
                          {item.title}
                        </h4>
                        {item.sourceReflectionTitle && (
                          <button
                            onClick={() => handleOpenSourceReflection(item)}
                            className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 italic truncate max-w-[220px]"
                          >
                            From "{item.sourceReflectionTitle}"
                          </button>
                        )}
                      </div>

                      <span className="text-[10px] font-semibold text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded-md">
                        Someday
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-200/70 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditTitle(item.title);
                            setEditDeadline(item.deadline || getTodayDateString());
                            setEditPriority(item.priority);
                            setEditProgress(item.progress);
                            setEditIsWaiting(Boolean(item.isWaiting));
                            setEditWaitingOn(item.waitingOn || "");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5 text-stone-600" />
                          <span>Set deadline</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateProgress(item, 25)}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-medium transition-colors"
                        >
                          Start
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-stone-400">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          className="p-1 rounded hover:text-emerald-700 hover:bg-white"
                          title="Complete task"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismiss(item)}
                          className="p-1 rounded hover:text-rose-600 hover:bg-white"
                          title="Dismiss task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. 🔵 WAITING SECTION */}
        {/* ========================================================= */}
        {(activeFilter === "all" || activeFilter === "waiting") && categorized.waiting.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-950 font-['Plus_Jakarta_Sans']">
                Waiting ({categorized.waiting.length})
              </h3>
              <span className="text-[11px] text-stone-400">· Pending on another person or external response</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categorized.waiting
                .filter((item) =>
                  !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-sky-50/40 border border-sky-200/80 shadow-2xs hover:shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-stone-900 leading-snug font-['Plus_Jakarta_Sans']">
                          {item.title}
                        </h4>
                        <div className="text-xs text-sky-800 flex items-center gap-1.5 font-medium">
                          {item.waitingOn ? (
                            <span>Waiting on: <strong>{item.waitingOn}</strong></span>
                          ) : (
                            <span>External dependency</span>
                          )}
                          {item.sourceReflectionTitle && (
                            <button
                              onClick={() => handleOpenSourceReflection(item)}
                              className="text-stone-500 hover:text-stone-800 italic truncate max-w-[180px]"
                            >
                              · In "{item.sourceReflectionTitle}"
                            </button>
                          )}
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-sky-900 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                        Waiting
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-sky-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditTitle(`Follow up on: ${item.title}`);
                            setEditDeadline(getTodayDateString());
                            setEditPriority("high");
                            setEditProgress(item.progress);
                            setEditIsWaiting(false);
                            setEditWaitingOn("");
                          }}
                          className="px-3 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-950 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1"
                        >
                          <Bell className="w-3.5 h-3.5 text-sky-700" />
                          <span>Follow up</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-medium shadow-2xs transition-colors"
                        >
                          Complete
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-stone-400">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setEditTitle(item.title);
                            setEditDeadline(item.deadline || "");
                            setEditPriority(item.priority);
                            setEditProgress(item.progress);
                            setEditIsWaiting(true);
                            setEditWaitingOn(item.waitingOn || "");
                          }}
                          className="p-1 rounded hover:text-stone-700 hover:bg-white"
                          title="Edit task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDismiss(item)}
                          className="p-1 rounded hover:text-rose-600 hover:bg-white"
                          title="Dismiss task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: EDIT TASK */}
      {/* ------------------------------------------------------------- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
                Edit Task
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700">Task Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-300 text-stone-900 bg-stone-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700">Deadline (Optional)</label>
                <input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-stone-300 text-stone-900 bg-stone-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as ObjectivePriority)}
                    className="w-full mt-1 p-2 rounded-xl border border-stone-300 text-stone-800 bg-stone-50 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700">Progress ({editProgress}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={editProgress}
                    onChange={(e) => setEditProgress(Number(e.target.value))}
                    className="w-full mt-2 accent-amber-500"
                  />
                </div>
              </div>

              {/* Waiting status toggle */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <label className="flex items-center gap-2 font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsWaiting}
                    onChange={(e) => setEditIsWaiting(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span>Waiting on someone or external action</span>
                </label>

                {editIsWaiting && (
                  <input
                    type="text"
                    placeholder="Who or what are you waiting on? (e.g. Teammate's PR review)"
                    value={editWaitingOn}
                    onChange={(e) => setEditWaitingOn(e.target.value)}
                    className="w-full p-2 rounded-lg border border-stone-300 text-stone-800 text-xs bg-white"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD NEW TASK */}
      {/* ------------------------------------------------------------- */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
                Add an Unfinished Task
              </h3>
              <button
                onClick={() => setIsAddingNew(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700">What needs to be finished?</label>
                <input
                  type="text"
                  placeholder="e.g., Submit expense report, Learn Docker..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-stone-300 text-stone-900 bg-stone-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-stone-700">Deadline (Leave blank for Someday / No Deadline)</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-stone-300 text-stone-900 bg-stone-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as ObjectivePriority)}
                    className="w-full mt-1 p-2 rounded-xl border border-stone-300 text-stone-800 bg-stone-50 focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full mt-1 p-2 rounded-xl border border-stone-300 text-stone-800 bg-stone-50 focus:outline-none"
                  >
                    <option value="standard">Standard Objective</option>
                    <option value="waiting">Waiting on Someone</option>
                  </select>
                </div>
              </div>

              {newCategory === "waiting" && (
                <div>
                  <label className="font-bold text-stone-700">Who are you waiting on?</label>
                  <input
                    type="text"
                    placeholder="e.g. Teammate, Client, Supervisor..."
                    value={newWaitingOn}
                    onChange={(e) => setNewWaitingOn(e.target.value)}
                    className="w-full mt-1 p-2 rounded-xl border border-stone-300 text-stone-900 bg-stone-50"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewItem}
                disabled={!newTitle.trim()}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-xs disabled:opacity-50"
              >
                Add to Unfinished
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
