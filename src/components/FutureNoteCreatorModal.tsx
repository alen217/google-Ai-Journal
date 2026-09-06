import React, { useState } from "react";
import { UserProfile, FutureNote } from "../types";
import { createFutureSelfNote, ResurfacePreset, getPresetDate } from "../lib/futureSelfService";
import {
  Clock,
  Calendar,
  Sparkles,
  X,
  Check,
  Send,
  Heart,
  ChevronRight,
  Sun,
  CalendarDays,
  Moon,
  Compass,
  Smile,
  AlertCircle
} from "lucide-react";

interface FutureNoteCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  sourceReflectionId?: string;
  sourceReflectionTitle?: string;
  initialSentence?: string;
  onNoteCreated?: (note: FutureNote) => void;
}

export const FutureNoteCreatorModal: React.FC<FutureNoteCreatorModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  sourceReflectionId,
  sourceReflectionTitle,
  initialSentence,
  onNoteCreated,
}) => {
  const [message, setMessage] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<ResurfacePreset>("next_month");
  const [customDate, setCustomDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  if (!isOpen) return null;

  const targetDate = selectedPreset === "custom" ? customDate : getPresetDate(selectedPreset);

  const handleSave = async () => {
    if (!message.trim()) {
      setError("Please write a message to your future self.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const created = await createFutureSelfNote(userProfile.uid, {
        message: message.trim(),
        targetDate: targetDate,
        sourceReflectionId,
        sourceReflectionTitle,
        sourceSentence: initialSentence,
      });

      if (onNoteCreated) {
        onNoteCreated(created);
      }
      onClose();
    } catch (err: any) {
      console.error("Failed to save future note:", err);
      setError(err?.message || "Failed to schedule note for future self.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggest = () => {
    setIsSuggesting(true);
    // Thoughtful, grounding perspective suggestions based on context
    const suggestions = [
      "Remember why you chose this path today. Trust that the steps you took were rooted in your values.",
      "Check in with yourself: did that worry ever come to pass? Give yourself credit for how far you've come.",
      "Take a slow breath. If you are feeling overwhelmed right now, remember how capable you were on this day.",
      "Did you finish what you started here? Celebrate the effort, regardless of the outcome.",
      "Remember to speak to yourself with unconditional kindness today, just like you promised.",
    ];

    const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
    setMessage(pick);
    setIsSuggesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-stone-200/90 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="future-note-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-amber-50/80 via-stone-50 to-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shadow-xs">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 id="future-note-title" className="text-base font-bold text-stone-900 font-['Newsreader'] italic text-lg">
                Note to Future Me
              </h2>
              <p className="text-xs text-stone-500 font-['Plus_Jakarta_Sans']">
                A gentle message to resurface when you need it most
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Optional context prompt if tied to reflection */}
          {sourceReflectionTitle && (
            <div className="text-xs text-stone-600 bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3 flex items-start gap-2">
              <Heart className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-800">Linked to reflection: </span>
                <span className="italic font-serif">"{sourceReflectionTitle}"</span>
                {initialSentence && (
                  <p className="mt-1 text-[11px] text-stone-500 line-clamp-2">
                    "{initialSentence}"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Message Text Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                What would you like your future self to remember?
              </label>
              
              {userProfile.privacyAISettings?.futureSelfSuggestions !== false && (
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={isSuggesting}
                  className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Inspire me</span>
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g., Remember why you decided to change the project architecture. Keep faith in your decision and breathe."
              className="w-full p-4 rounded-2xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50/50 text-stone-900 text-sm leading-relaxed placeholder:text-stone-400 resize-none font-serif italic text-base"
            />
          </div>

          {/* Resurface Timeframe Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              When should this resurface?
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedPreset("tomorrow")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                  selectedPreset === "tomorrow"
                    ? "border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white text-stone-700"
                }`}
              >
                <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div>Tomorrow</div>
                  <div className="text-[10px] text-stone-400 font-normal">Next day</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset("next_week")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                  selectedPreset === "next_week"
                    ? "border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white text-stone-700"
                }`}
              >
                <CalendarDays className="w-4 h-4 text-cyan-600 shrink-0" />
                <div>
                  <div>Next week</div>
                  <div className="text-[10px] text-stone-400 font-normal">+7 days</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset("next_month")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                  selectedPreset === "next_month"
                    ? "border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white text-stone-700"
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <div>Next month</div>
                  <div className="text-[10px] text-stone-400 font-normal">+30 days</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset("three_months")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                  selectedPreset === "three_months"
                    ? "border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white text-stone-700"
                }`}
              >
                <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div>In 3 months</div>
                  <div className="text-[10px] text-stone-400 font-normal">Season ahead</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset("someday")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                  selectedPreset === "someday"
                    ? "border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white text-stone-700"
                }`}
              >
                <Smile className="w-4 h-4 text-stone-500 shrink-0" />
                <div>
                  <div>Someday</div>
                  <div className="text-[10px] text-stone-400 font-normal">No date</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset("custom")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-left flex items-center gap-2 transition-all ${
                  selectedPreset === "custom"
                    ? "border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-xs"
                    : "border-stone-200 hover:border-stone-300 bg-white text-stone-700"
                }`}
              >
                <Calendar className="w-4 h-4 text-stone-600 shrink-0" />
                <div>
                  <div>Specific date</div>
                  <div className="text-[10px] text-stone-400 font-normal">Pick day</div>
                </div>
              </button>
            </div>

            {selectedPreset === "custom" && (
              <div className="pt-2">
                <input
                  type="date"
                  value={customDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs text-stone-800 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/80 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {targetDate ? `Resurfaces on ${targetDate}` : "Resurfaces unexpectedly"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-200/60 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !message.trim()}
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Leave for Future Me</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
