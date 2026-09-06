import React, { useState } from "react";
import { FutureNote } from "../types";
import { calculateTimeAgo, markNoteAsRead, keepNoteForLater } from "../lib/futureSelfService";
import {
  Clock,
  CheckCircle2,
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Bookmark,
  Sparkles,
  Heart,
  Quote
} from "lucide-react";

interface PastSelfMessageCardProps {
  notes: FutureNote[];
  userId: string;
  onOpenReflection?: (reflectionId: string, highlightSentence?: string) => void;
  onNoteUpdated?: () => void;
  className?: string;
}

export const PastSelfMessageCard: React.FC<PastSelfMessageCardProps> = ({
  notes,
  userId,
  onOpenReflection,
  onNoteUpdated,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!notes || notes.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentIndex, notes.length - 1);
  const currentNote = notes[safeIndex];

  const handleMarkRead = async () => {
    if (!currentNote) return;
    setIsProcessing(true);
    try {
      await markNoteAsRead(userId, currentNote.id);
      if (onNoteUpdated) onNoteUpdated();
    } catch (err) {
      console.error("Failed to mark note read:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeepForLater = async () => {
    if (!currentNote) return;
    setIsProcessing(true);
    try {
      await keepNoteForLater(userId, currentNote.id, 7);
      if (onNoteUpdated) onNoteUpdated();
    } catch (err) {
      console.error("Failed to keep note for later:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const timeAgo = calculateTimeAgo(currentNote.createdAt);
  const noteDate = new Date(currentNote.createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      id="past-self-message-card"
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50/40 border border-amber-200/90 shadow-sm p-6 sm:p-7 space-y-4 transition-all hover:shadow-md ${className}`}
    >
      {/* Subtle background decorative seal */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-100/40 pointer-events-none flex items-center justify-center opacity-60">
        <Quote className="w-16 h-16 text-amber-300/40" />
      </div>

      {/* Top Header Row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-200/70 border border-amber-300 flex items-center justify-center text-amber-900 shadow-2xs">
            <Clock className="w-4 h-4 text-amber-800" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 font-['Plus_Jakarta_Sans'] flex items-center gap-1.5">
              <span>A message from your past self</span>
              <Sparkles className="w-3 h-3 text-amber-600" />
            </h3>
            <span className="text-xs text-stone-500 font-medium">
              {noteDate}
            </span>
          </div>
        </div>

        {/* Counter & Navigation if multiple */}
        {notes.length > 1 && (
          <div className="flex items-center gap-1.5 bg-white/80 border border-amber-200 px-2 py-1 rounded-full text-xs text-amber-950 font-medium shadow-2xs">
            <span>
              {safeIndex + 1} of {notes.length}
            </span>
            <button
              onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : notes.length - 1))}
              className="p-0.5 rounded-full hover:bg-stone-100 text-stone-600"
              title="Previous note"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev < notes.length - 1 ? prev + 1 : 0))}
              className="p-0.5 rounded-full hover:bg-stone-100 text-stone-600"
              title="Next note"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* The Personal Note Itself */}
      <div className="pl-3 sm:pl-4 border-l-2 border-amber-400/80 py-1">
        <blockquote className="text-base sm:text-lg font-serif italic text-stone-800 font-['Newsreader'] leading-relaxed">
          "{currentNote.message}"
        </blockquote>

        <p className="mt-2 text-xs font-semibold text-amber-900/80 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
          <Heart className="w-3.5 h-3.5 text-amber-600" />
          <span>You wrote this {timeAgo}.</span>
          {currentNote.sourceReflectionTitle && (
            <span className="text-stone-500 font-normal">
              · In "{currentNote.sourceReflectionTitle}"
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="pt-2 flex items-center justify-between flex-wrap gap-2.5 border-t border-amber-100/90">
        <div className="flex items-center gap-2">
          <button
            id="past-self-mark-read-btn"
            type="button"
            onClick={handleMarkRead}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark as Read</span>
          </button>

          <button
            id="past-self-keep-later-btn"
            type="button"
            onClick={handleKeepForLater}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 text-xs font-medium shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Bookmark className="w-3.5 h-3.5 text-stone-500" />
            <span>Keep for Later</span>
          </button>
        </div>

        {currentNote.sourceReflectionId && onOpenReflection && (
          <button
            type="button"
            onClick={() => onOpenReflection(currentNote.sourceReflectionId!, currentNote.sourceSentence || currentNote.message)}
            className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 transition-colors group"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
            <span>Open Original Entry &rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
};
