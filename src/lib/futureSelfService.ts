import { FutureNote } from "../types";
import {
  persistFutureNote,
  fetchUserFutureNotes,
  updateFutureNoteDoc,
  deleteFutureNoteDoc,
  getTodayDateString,
} from "./firebase";

// -------------------------------------------------------------
// Time Ago Calculator (Human-friendly, poetic format)
// -------------------------------------------------------------
export function calculateTimeAgo(dateIso: string): string {
  try {
    const created = new Date(dateIso).getTime();
    const now = Date.now();
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "earlier today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 60) return "1 month ago";
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return "over a year ago";
  } catch {
    return "in a past reflection";
  }
}

// -------------------------------------------------------------
// Calculate Future Date from Preset
// -------------------------------------------------------------
export type ResurfacePreset = "tomorrow" | "next_week" | "next_month" | "three_months" | "someday" | "custom";

export function getPresetDate(preset: ResurfacePreset): string | undefined {
  const d = new Date();
  switch (preset) {
    case "tomorrow":
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    case "next_week":
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    case "next_month":
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    case "three_months":
      d.setMonth(d.getMonth() + 3);
      return d.toISOString().slice(0, 10);
    case "someday":
      return undefined;
    default:
      return undefined;
  }
}

// -------------------------------------------------------------
// Service Functions
// -------------------------------------------------------------
export async function createFutureSelfNote(
  userId: string,
  params: {
    message: string;
    targetDate?: string;
    sourceReflectionId?: string;
    sourceReflectionTitle?: string;
    sourceSentence?: string;
  }
): Promise<FutureNote> {
  const id = `fnote_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
  const now = new Date().toISOString();

  const note: FutureNote = {
    id,
    userId,
    message: params.message.trim(),
    targetDate: params.targetDate || undefined,
    sourceReflectionId: params.sourceReflectionId,
    sourceReflectionTitle: params.sourceReflectionTitle,
    sourceSentence: params.sourceSentence,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await persistFutureNote(userId, note);
  return note;
}

export async function getDueAndUpcomingFutureNotes(
  userId: string,
  todayStr?: string
): Promise<{ dueNotes: FutureNote[]; upcomingNotes: FutureNote[] }> {
  const allNotes = await fetchUserFutureNotes(userId);
  const today = todayStr || getTodayDateString();

  const dueNotes: FutureNote[] = [];
  const upcomingNotes: FutureNote[] = [];

  for (const note of allNotes) {
    if (note.status === "archived") continue;

    // A note is due if:
    // 1. It has a target date <= today and is not yet marked read
    // 2. OR it was marked delivered
    if (note.status === "read") {
      continue;
    }

    if (note.targetDate && note.targetDate <= today) {
      dueNotes.push(note);
    } else {
      upcomingNotes.push(note);
    }
  }

  return { dueNotes, upcomingNotes };
}

export async function fetchDueFutureNotes(userId: string): Promise<FutureNote[]> {
  const { dueNotes } = await getDueAndUpcomingFutureNotes(userId);
  return dueNotes;
}

export async function markNoteAsRead(userId: string, noteId: string): Promise<void> {
  await updateFutureNoteDoc(userId, noteId, {
    status: "read",
    readAt: new Date().toISOString(),
  });
}

export async function keepNoteForLater(userId: string, noteId: string, daysToSnooze: number = 7): Promise<void> {
  const d = new Date();
  d.setDate(d.getDate() + daysToSnooze);
  const newDate = d.toISOString().slice(0, 10);

  await updateFutureNoteDoc(userId, noteId, {
    targetDate: newDate,
    status: "pending",
  });
}

export async function archiveFutureNote(userId: string, noteId: string): Promise<void> {
  await updateFutureNoteDoc(userId, noteId, {
    status: "archived",
  });
}

export async function deleteFutureNote(userId: string, noteId: string): Promise<void> {
  await deleteFutureNoteDoc(userId, noteId);
}
