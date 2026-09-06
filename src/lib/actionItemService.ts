import {
  DetectedActionItem,
  ActionItemExtractionResult,
  ObjectiveItem,
  ReminderItem,
  SavedCalendarEvent,
  ObjectivePriority,
  ObjectiveStatus,
  ReflectionDoc,
} from "../types";
import {
  persistObjective,
  persistReminder,
  persistCalendarItem,
  fetchUserObjectives,
  fetchUserReminders,
  fetchUserCalendarItems,
  updateObjectiveDoc,
  deleteObjectiveDoc,
  deleteReminderDoc,
} from "./firebase";

// -------------------------------------------------------------
// 1. API Extractor Client
// -------------------------------------------------------------

export async function extractActionItems(
  journalText: string,
  entryDate?: string,
  existingTitles: string[] = []
): Promise<ActionItemExtractionResult> {
  const referenceDate = new Date().toISOString().slice(0, 10);

  const response = await fetch("/api/gemini/extract-action-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      journalText,
      entryDate: entryDate || referenceDate,
      referenceDate,
      existingTitles,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to extract action items from journal entry.");
  }

  return response.json();
}

// -------------------------------------------------------------
// 2. Calendar Link & ICS Generation
// -------------------------------------------------------------

export function makeGoogleCalendarUrl(
  title: string,
  dateStr?: string,
  timeStr?: string,
  details?: string
): string {
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  let datesParam = "";

  if (timeStr && timeStr.includes(":")) {
    const [h, m] = timeStr.split(":");
    const startIso = `${cleanDate}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
    const endH = (parseInt(h, 10) + 1).toString().padStart(2, "0");
    const endIso = `${cleanDate}T${endH}${m.padStart(2, "0")}00`;
    datesParam = `${startIso}/${endIso}`;
  } else {
    datesParam = `${cleanDate}/${cleanDate}`;
  }

  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const params = new URLSearchParams({
    text: title,
    dates: datesParam,
    details: details || "Created from ReflectAI Smart Journal Assistant",
  });

  return `${base}&${params.toString()}`;
}

export function downloadIcsFile(
  title: string,
  dateStr?: string,
  timeStr?: string,
  details?: string
): void {
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `reflectai-${Date.now()}-${Math.random().toString(36).substr(2, 6)}@reflectai.app`;

  let dtStart = cleanDate;
  let dtEnd = cleanDate;

  if (timeStr && timeStr.includes(":")) {
    const [h, m] = timeStr.split(":");
    dtStart = `${cleanDate}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
    const endH = (parseInt(h, 10) + 1).toString().padStart(2, "0");
    dtEnd = `${cleanDate}T${endH}${m.padStart(2, "0")}00`;
  }

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReflectAI//Journal Calendar Assistant//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    timeStr ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    timeStr ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${title.replace(/[,;\n]/g, " ")}`,
    `DESCRIPTION:${(details || "Added from ReflectAI Journal").replace(/\n/g, "\\n")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "event"}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// 3. User Confirmation & Persistence Services
// -------------------------------------------------------------

export async function convertActionToObjective(
  userId: string,
  action: DetectedActionItem,
  reflection?: ReflectionDoc,
  options?: {
    customTitle?: string;
    description?: string;
    deadline?: string;
    priority?: ObjectivePriority;
    initialProgress?: number;
    reminderDate?: string;
    reminderTime?: string;
  }
): Promise<ObjectiveItem> {
  const objectiveId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  const objective: ObjectiveItem = {
    id: objectiveId,
    userId,
    title: options?.customTitle || action.title,
    description: options?.description || action.confidenceReason || "",
    deadline: options?.deadline || action.date || undefined,
    priority: options?.priority || action.priority || "medium",
    progress: options?.initialProgress ?? 0,
    status: (options?.initialProgress ?? 0) >= 100 ? "completed" : "in_progress",
    reminder:
      options?.reminderDate
        ? {
            date: options.reminderDate,
            time: options.reminderTime || "09:00",
            enabled: true,
            notes: `Reminder for objective: ${options.customTitle || action.title}`,
          }
        : undefined,
    sourceReflectionId: reflection?.id,
    sourceReflectionTitle: reflection?.title,
    createdAt: now,
    updatedAt: now,
  };

  await persistObjective(userId, objective);
  return objective;
}

export async function convertActionToReminder(
  userId: string,
  action: DetectedActionItem,
  reflection?: ReflectionDoc,
  options?: {
    customTitle?: string;
    date?: string;
    time?: string;
    notes?: string;
  }
): Promise<ReminderItem> {
  const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();
  const targetDate = options?.date || action.date || new Date().toISOString().slice(0, 10);

  const reminder: ReminderItem = {
    id: reminderId,
    userId,
    title: options?.customTitle || action.title,
    date: targetDate,
    time: options?.time || action.time || "09:00",
    status: "pending",
    sourceReflectionId: reflection?.id,
    sourceReflectionTitle: reflection?.title,
    notes: options?.notes || action.confidenceReason,
    createdAt: now,
    updatedAt: now,
  };

  await persistReminder(userId, reminder);
  return reminder;
}

export async function convertActionToCalendarEvent(
  userId: string,
  action: DetectedActionItem,
  reflection?: ReflectionDoc,
  options?: {
    customTitle?: string;
    date?: string;
    time?: string;
    description?: string;
  }
): Promise<SavedCalendarEvent> {
  const eventId = `cal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();
  const targetDate = options?.date || action.date || new Date().toISOString().slice(0, 10);

  const calEvent: SavedCalendarEvent = {
    id: eventId,
    userId,
    title: options?.customTitle || action.title,
    type: "event",
    date: targetDate,
    time: options?.time || action.time || undefined,
    description: options?.description || `From reflection: ${reflection?.title || "Journal entry"}`,
    reminderMinutesBefore: 60,
    sourceReflectionId: reflection?.id,
    status: "confirmed",
    createdAt: now,
  };

  await persistCalendarItem(userId, calEvent);
  return calEvent;
}

// -------------------------------------------------------------
// 4. Fetch Related Actions for a Journal Entry
// -------------------------------------------------------------

export interface ReflectionRelatedActions {
  objectives: ObjectiveItem[];
  reminders: ReminderItem[];
  calendarEvents: SavedCalendarEvent[];
}

export async function fetchRelatedActionsForReflection(
  userId: string,
  reflectionId: string
): Promise<ReflectionRelatedActions> {
  try {
    const [objs, rems, cals] = await Promise.all([
      fetchUserObjectives(userId, reflectionId),
      fetchUserReminders(userId, reflectionId),
      fetchUserCalendarItems(userId),
    ]);

    const matchingCals = cals.filter(
      (c) => c.sourceReflectionId === reflectionId
    ) as SavedCalendarEvent[];

    return {
      objectives: objs,
      reminders: rems,
      calendarEvents: matchingCals,
    };
  } catch (err) {
    console.error("Failed to load related actions for reflection:", err);
    return { objectives: [], reminders: [], calendarEvents: [] };
  }
}

// -------------------------------------------------------------
// 5. Update Objective Status & Progress
// -------------------------------------------------------------

export async function updateObjectiveProgress(
  userId: string,
  objectiveId: string,
  newProgress: number
): Promise<void> {
  const status: ObjectiveStatus =
    newProgress >= 100 ? "completed" : newProgress > 0 ? "in_progress" : "not_started";
  await updateObjectiveDoc(userId, objectiveId, {
    progress: Math.min(100, Math.max(0, newProgress)),
    status,
  });
}

export async function toggleObjectiveStatus(
  userId: string,
  objective: ObjectiveItem
): Promise<ObjectiveItem> {
  const newStatus: ObjectiveStatus =
    objective.status === "completed" ? "in_progress" : "completed";
  const newProgress = newStatus === "completed" ? 100 : objective.progress === 100 ? 50 : objective.progress;

  await updateObjectiveDoc(userId, objective.id, {
    status: newStatus,
    progress: newProgress,
  });

  return {
    ...objective,
    status: newStatus,
    progress: newProgress,
  };
}
