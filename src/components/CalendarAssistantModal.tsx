import React, { useState } from "react";
import { 
  Calendar, 
  Clock, 
  Bell, 
  Check, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  X, 
  CheckCircle2,
  CalendarCheck
} from "lucide-react";
import { DetectedCalendarItem, CalendarItemType } from "../types";
import { persistCalendarItem } from "../lib/firebase";

interface CalendarAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  items: DetectedCalendarItem[];
  sourceTitle?: string;
  sourceReflectionId?: string;
  onItemsAdded?: (addedCount: number) => void;
}

type WizardStep = "detect_prompt" | "review" | "confirm" | "success";

export const CalendarAssistantModal: React.FC<CalendarAssistantModalProps> = ({
  isOpen,
  onClose,
  userId,
  items: initialItems,
  sourceTitle,
  sourceReflectionId,
  onItemsAdded,
}) => {
  const [step, setStep] = useState<WizardStep>("detect_prompt");
  const [editableItems, setEditableItems] = useState<DetectedCalendarItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<any[]>([]);
  const [icsDownloadContent, setIcsDownloadContent] = useState<string | null>(null);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState<string | null>(null);

  // Initialize editable list whenever modal opens or initial items change
  React.useEffect(() => {
    if (isOpen) {
      setStep("detect_prompt");
      setEditableItems(
        initialItems.map((item) => ({
          ...item,
          selected: true,
          sourceReflectionId: item.sourceReflectionId || sourceReflectionId,
          sourceReflectionTitle: item.sourceReflectionTitle || sourceTitle,
        }))
      );
      setEditingItemId(null);
      setSubmissionError(null);
      setConfirmedItems([]);
      setIcsDownloadContent(null);
      setGoogleCalendarUrl(null);
    }
  }, [isOpen, initialItems, sourceTitle, sourceReflectionId]);

  if (!isOpen) return null;

  const selectedCount = editableItems.filter((i) => i.selected).length;

  // Toggle item selection
  const handleToggleSelect = (id: string) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Remove item from proposal
  const handleRemoveItem = (id: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update item field
  const handleUpdateItem = (id: string, updates: Partial<DetectedCalendarItem>) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Step 1: User chooses to review
  const handleStartReview = () => {
    setStep("review");
  };

  // Step 2: User proceeds from review to final confirmation
  const handleProceedToConfirm = () => {
    if (selectedCount === 0) {
      setSubmissionError("Please select at least one item to continue.");
      return;
    }
    setSubmissionError(null);
    setStep("confirm");
  };

  // Step 3: Final confirmation -> Calls backend API
  const handleConfirmAndAdd = async () => {
    const selectedItems = editableItems.filter((i) => i.selected);
    if (selectedItems.length === 0) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      // Strict rule: Only the user can authorize an external action.
      const response = await fetch("/api/calendar/add-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          items: selectedItems,
          userConfirmed: true, // Explicit user authorization
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process calendar items.");
      }

      // Persist confirmed items into user's Firestore collection
      for (const item of data.items || []) {
        await persistCalendarItem(userId, item);
      }

      setConfirmedItems(data.items || []);
      setIcsDownloadContent(data.icsContent || null);
      setGoogleCalendarUrl(data.firstGoogleCalendarUrl || null);
      setStep("success");

      if (onItemsAdded) {
        onItemsAdded(selectedItems.length);
      }
    } catch (err: any) {
      console.error("Calendar add error:", err);
      setSubmissionError(err?.message || "Failed to add items to calendar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download .ics file
  const handleDownloadIcs = () => {
    if (!icsDownloadContent) return;
    const blob = new Blob([icsDownloadContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reflectai-calendar-${new Date().toISOString().slice(0, 10)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-amber-50 border border-amber-200/80 rounded-2xl shadow-2xl overflow-hidden font-['Newsreader'] text-stone-900 flex flex-col max-h-[90vh]"
        style={{
          boxShadow: "0 25px 50px -12px rgba(44, 30, 18, 0.25)",
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-amber-100/70 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900 tracking-tight font-serif">
                Calendar Assistant
              </h3>
              <p className="text-xs text-stone-600 font-sans">
                Privacy-first, explicit user authorization required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-amber-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: DETECTION PROMPT */}
          {step === "detect_prompt" && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-amber-200/70 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
                <Bell className="w-8 h-8 animate-bounce" />
              </div>
              
              <div className="space-y-2 max-w-md mx-auto">
                <h4 className="text-2xl font-serif font-bold text-stone-900">
                  🔔 I found {editableItems.length} {editableItems.length === 1 ? "thing" : "things"} you may want to add to your calendar.
                </h4>
                <p className="text-sm text-stone-600 font-sans leading-relaxed">
                  ReflectAI detected actionable events, deadlines, or tasks from your journal. 
                  Nothing will ever be added automatically without your explicit review and confirmation.
                </p>
              </div>

              {/* Quick Preview list */}
              <div className="bg-white/80 rounded-xl p-4 border border-amber-200/60 text-left max-w-lg mx-auto space-y-2.5">
                <div className="text-xs font-sans font-semibold text-stone-500 uppercase tracking-wider">
                  Detected Commitments:
                </div>
                {editableItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-stone-100 last:border-0 font-sans">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-2 h-2 rounded-full ${item.type === "event" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <span className="font-medium text-stone-800 truncate">{item.title}</span>
                    </div>
                    <span className="text-xs text-stone-500 font-mono whitespace-nowrap ml-2">
                      {item.date || "Date detected"} {item.time ? `@ ${item.time}` : ""}
                    </span>
                  </div>
                ))}
                {editableItems.length > 3 && (
                  <p className="text-xs text-stone-500 text-center font-sans pt-1">
                    + {editableItems.length - 3} more items detected
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  id="calendar-not-now-btn"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-sans text-sm font-medium transition-colors"
                >
                  Not Now
                </button>
                <button
                  id="calendar-review-and-add-btn"
                  onClick={handleStartReview}
                  className="px-6 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-amber-50 font-sans text-sm font-semibold shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>Review & Add</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW BEFORE ADDING */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <div>
                  <h4 className="text-lg font-serif font-bold text-stone-900">
                    Review Calendar Items
                  </h4>
                  <p className="text-xs text-stone-600 font-sans">
                    Select items, edit dates, and choose whether each is an Event or Reminder/Task.
                  </p>
                </div>
                <div className="text-xs font-sans font-medium px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
                  {selectedCount} of {editableItems.length} selected
                </div>
              </div>

              {submissionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                {editableItems.map((item) => {
                  const isEditing = editingItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all ${
                        item.selected
                          ? "bg-white/90 border-amber-300 shadow-xs"
                          : "bg-amber-50/40 border-stone-200 opacity-60"
                      }`}
                    >
                      {isEditing ? (
                        /* Inline Edit Form */
                        <div className="space-y-3 font-sans">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <label className="block font-medium text-stone-600 mb-1">Date</label>
                              <input
                                type="date"
                                value={item.date || ""}
                                onChange={(e) => handleUpdateItem(item.id, { date: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block font-medium text-stone-600 mb-1">Time (Optional)</label>
                              <input
                                type="time"
                                value={item.time || ""}
                                onChange={(e) => handleUpdateItem(item.id, { time: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block font-medium text-stone-600 mb-1">Type</label>
                              <select
                                value={item.type}
                                onChange={(e) => handleUpdateItem(item.id, { type: e.target.value as CalendarItemType })}
                                className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg"
                              >
                                <option value="event">Calendar Event</option>
                                <option value="task">Reminder / Task</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Advance Reminder
                            </label>
                            <select
                              value={item.reminderMinutesBefore || 60}
                              onChange={(e) => handleUpdateItem(item.id, { reminderMinutesBefore: parseInt(e.target.value, 10) })}
                              className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg"
                            >
                              <option value={15}>15 minutes before</option>
                              <option value={30}>30 minutes before</option>
                              <option value={60}>1 hour before</option>
                              <option value={1440}>1 day before</option>
                              <option value={2880}>2 days before</option>
                            </select>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="px-3 py-1 rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-medium"
                            >
                              Done Editing
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard View */
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => handleToggleSelect(item.id)}
                            className="mt-1 w-4 h-4 rounded text-amber-700 focus:ring-amber-500 border-stone-300 cursor-pointer"
                          />

                          <div className="flex-1 min-w-0 font-sans">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  item.type === "event"
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : "bg-blue-100 text-blue-800 border border-blue-300"
                                }`}
                              >
                                {item.type === "event" ? "Event" : "Task / Reminder"}
                              </span>
                              <h5 className="font-semibold text-stone-900 text-sm truncate">
                                {item.title}
                              </h5>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-stone-600 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 font-mono">
                                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                                {item.date || "Date unspecified"}
                              </span>
                              {item.time && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                                  {item.time}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Bell className="w-3.5 h-3.5 text-stone-400" />
                                {item.reminderMinutesBefore
                                  ? item.reminderMinutesBefore >= 1440
                                    ? `${item.reminderMinutesBefore / 1440} day(s) before`
                                    : `${item.reminderMinutesBefore} mins before`
                                  : "Standard alert"}
                              </span>
                            </div>

                            {item.suggestedReminder && (
                              <p className="text-xs text-amber-800/90 italic font-serif mt-1">
                                💡 Suggested: {item.suggestedReminder}
                              </p>
                            )}

                            {item.isAmbiguousDate && item.clarificationPrompt && (
                              <p className="text-xs text-amber-700 bg-amber-100/80 px-2 py-1 rounded mt-1.5 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Note: {item.clarificationPrompt}</span>
                              </p>
                            )}
                          </div>

                          {/* Item Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingItemId(item.id)}
                              className="p-1 text-stone-400 hover:text-stone-800 rounded hover:bg-stone-100 transition-colors"
                              title="Edit item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {editableItems.length === 0 && (
                <div className="text-center py-8 text-stone-500 font-sans text-sm">
                  All proposed items have been removed.
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => setStep("detect_prompt")}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-amber-100 font-sans text-sm"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-sans text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    id="calendar-continue-btn"
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleProceedToConfirm}
                    className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-amber-50 font-sans text-sm font-semibold shadow-md transition-all active:scale-95"
                  >
                    Continue ({selectedCount})
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FINAL CONFIRMATION */}
          {step === "confirm" && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <Calendar className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h4 className="text-2xl font-serif font-bold text-stone-900">
                  Ready to add these to your calendar?
                </h4>
                <p className="text-sm text-stone-600 font-sans leading-relaxed">
                  <span className="font-semibold text-stone-900">{selectedCount} items</span> will be authorized and added to your calendar assistant.
                  You will be able to synchronize them directly into Google Calendar or download an .ics file.
                </p>
              </div>

              {/* Selected List Summary */}
              <div className="bg-white/80 rounded-xl p-4 border border-amber-200/80 text-left max-w-lg mx-auto max-h-48 overflow-y-auto space-y-2">
                {editableItems
                  .filter((i) => i.selected)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs font-sans py-1 border-b border-stone-100 last:border-0">
                      <span className="font-medium text-stone-800 truncate pr-2">
                        {item.title}
                      </span>
                      <span className="text-stone-500 font-mono whitespace-nowrap">
                        {item.date} {item.time ? `@ ${item.time}` : ""}
                      </span>
                    </div>
                  ))}
              </div>

              {submissionError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans flex items-center gap-2 max-w-md mx-auto">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submissionError}</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-sans text-sm font-medium transition-colors"
                >
                  Cancel / Edit
                </button>
                <button
                  id="calendar-confirm-and-add-btn"
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAndAdd}
                  className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-emerald-50 font-sans text-sm font-semibold shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Authorizing & Adding...</span>
                  ) : (
                    <>
                      <span>Confirm & Add</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS OUTCOME */}
          {step === "success" && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h4 className="text-2xl font-serif font-bold text-stone-900">
                  Successfully Authorized & Added!
                </h4>
                <p className="text-sm text-stone-600 font-sans leading-relaxed">
                  {confirmedItems.length} {confirmedItems.length === 1 ? "item has" : "items have"} been saved to your Calendar Assistant.
                  Choose how you'd like to synchronize below:
                </p>
              </div>

              {/* Sync Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto font-sans">
                {googleCalendarUrl && (
                  <a
                    href={googleCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl border border-amber-300 bg-amber-100/60 hover:bg-amber-100 text-amber-950 flex flex-col items-center gap-2 transition-all group text-center"
                  >
                    <ExternalLink className="w-5 h-5 text-amber-700 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-sm">Open in Google Calendar</span>
                    <span className="text-[11px] text-stone-600">
                      Instantly preview & save in your Google account
                    </span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  className="p-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-900 flex flex-col items-center gap-2 transition-all group text-center"
                >
                  <Download className="w-5 h-5 text-stone-700 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-sm">Download .ics File</span>
                  <span className="text-[11px] text-stone-600">
                    Import to Apple Calendar, Outlook, or any app
                  </span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 font-sans text-sm font-semibold shadow-md transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
