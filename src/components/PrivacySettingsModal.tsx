import React, { useState } from "react";
import { UserProfile, PrivacyAISettings, DEFAULT_PRIVACY_AI_SETTINGS, ReflectionDoc } from "../types";
import { updateUserProfileDoc, deleteAllUserData, deleteReflectionDoc } from "../lib/firebase";
import {
  Shield,
  Sparkles,
  Lock,
  Download,
  Trash2,
  X,
  Check,
  AlertTriangle,
  FileText,
  Search,
  CheckSquare,
  Smile,
  Compass,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  HelpCircle
} from "lucide-react";

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  onProfileUpdated: (updatedProfile: UserProfile) => void;
  onDataPurged?: () => void;
}

export const PrivacySettingsModal: React.FC<PrivacySettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  reflections,
  onProfileUpdated,
  onDataPurged,
}) => {
  const currentSettings: PrivacyAISettings =
    userProfile.privacyAISettings || DEFAULT_PRIVACY_AI_SETTINGS;

  const [settings, setSettings] = useState<PrivacyAISettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Manage Memories modal / Selective delete
  const [isManageMemoriesOpen, setIsManageMemoriesOpen] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Total delete confirmation modal
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  if (!isOpen) return null;

  // Toggle master switch
  const handleMasterToggle = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      aiAnalysisEnabled: enabled,
    }));
  };

  // Toggle individual feature
  const handleToggleFeature = (feature: keyof PrivacyAISettings) => {
    setSettings((prev) => ({
      ...prev,
      [feature]: !prev[feature],
    }));
  };

  // Save privacy settings to Firestore
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateUserProfileDoc(userProfile.uid, {
        privacyAISettings: settings,
      });

      const updated: UserProfile = {
        ...userProfile,
        privacyAISettings: settings,
      };
      onProfileUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Failed to save privacy settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Export My Journal (Client-side JSON and Markdown generator)
  // -------------------------------------------------------------
  const handleExportJournal = () => {
    // 1. JSON Export
    const exportData = {
      user: {
        displayName: userProfile.displayName,
        email: userProfile.email,
        totalEntries: userProfile.totalEntries,
        currentStreak: userProfile.currentStreak,
      },
      exportedAt: new Date().toISOString(),
      entriesCount: reflections.length,
      entries: reflections.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        createdAt: r.createdAt,
        messagesCount: r.messages?.length || 0,
        tags: r.tags,
        messages: r.messages?.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        scrapbook: r.scrapbook,
      })),
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(exportData, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute(
      "download",
      `journal_export_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    // 2. Formatted Markdown Export
    let mdContent = `# My Journal Export\n**Author:** ${userProfile.displayName || "Journaler"}\n**Exported On:** ${new Date().toLocaleDateString()}\n**Total Reflections:** ${reflections.length}\n\n---\n\n`;

    reflections.forEach((ref) => {
      mdContent += `## ${ref.title || "Untitled Reflection"}\n`;
      mdContent += `*Date: ${ref.date} | Created: ${ref.createdAt}*\n\n`;
      if (ref.tags && ref.tags.length > 0) {
        mdContent += `**Tags:** ${ref.tags.join(", ")}\n\n`;
      }
      if (ref.messages && ref.messages.length > 0) {
        ref.messages.forEach((m) => {
          mdContent += `**${m.role === "user" ? "Me" : "Companion"}:**\n${m.content}\n\n`;
        });
      }
      mdContent += `---\n\n`;
    });

    const mdBlob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const mdUrl = URL.createObjectURL(mdBlob);
    const mdLink = document.createElement("a");
    mdLink.href = mdUrl;
    mdLink.setAttribute(
      "download",
      `journal_export_${new Date().toISOString().slice(0, 10)}.md`
    );
    document.body.appendChild(mdLink);
    mdLink.click();
    mdLink.remove();
    URL.revokeObjectURL(mdUrl);
  };

  // -------------------------------------------------------------
  // Delete Selected Memories
  // -------------------------------------------------------------
  const handleDeleteSelected = async () => {
    if (selectedEntryIds.length === 0) return;
    setIsDeletingSelected(true);
    try {
      for (const id of selectedEntryIds) {
        await deleteReflectionDoc(userProfile.uid, id);
      }
      setSelectedEntryIds([]);
      setIsManageMemoriesOpen(false);
      if (onDataPurged) onDataPurged();
    } catch (err) {
      console.error("Failed to delete selected entries:", err);
    } finally {
      setIsDeletingSelected(false);
    }
  };

  // -------------------------------------------------------------
  // Delete All Journal Data (Permanent Purge)
  // -------------------------------------------------------------
  const handleConfirmDeleteAll = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeletingAll(true);
    try {
      await deleteAllUserData(userProfile.uid);
      setIsDeleteAllOpen(false);
      setDeleteConfirmText("");
      if (onDataPurged) onDataPurged();
      onClose();
    } catch (err) {
      console.error("Failed to purge all data:", err);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-stone-200/90 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-settings-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shadow-xs">
              <Shield className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <h2 id="privacy-settings-title" className="text-base font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
                Privacy & AI Controls
              </h2>
              <p className="text-xs text-stone-500 font-['Plus_Jakarta_Sans']">
                Manage your privacy, AI intelligence, and personal data storage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* ========================================================= */}
          {/* 1. MASTER TOGGLE: ANALYZE MY JOURNAL WITH AI */}
          {/* ========================================================= */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50/80 to-stone-50 border border-amber-200/90 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
                    Analyze my journal with AI
                  </h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-['Plus_Jakarta_Sans']">
                  Allow AI to identify tasks, objectives, reminders, insights, and other useful information from your journal.
                </p>
              </div>

              {/* Master Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.aiAnalysisEnabled}
                onClick={() => handleMasterToggle(!settings.aiAnalysisEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  settings.aiAnalysisEnabled ? "bg-amber-500" : "bg-stone-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.aiAnalysisEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {!settings.aiAnalysisEnabled && (
              <div className="pt-2 text-xs font-medium text-stone-600 flex items-center gap-1.5 border-t border-amber-200/60">
                <Lock className="w-3.5 h-3.5 text-stone-500" />
                <span>AI analysis is disabled. Your journal entries will remain strictly private and unparsed.</span>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 2. INDIVIDUAL AI FEATURE TOGGLES */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 font-['Plus_Jakarta_Sans']">
              AI Features
            </h4>

            <div className="space-y-2">
              {/* Smart task detection */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Smart task detection</span>
                    <span className="text-[11px] text-stone-500">Detect tasks and deadlines from journal entries</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.aiAnalysisEnabled}
                  checked={settings.smartTaskDetection && settings.aiAnalysisEnabled}
                  onChange={() => handleToggleFeature("smartTaskDetection")}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 disabled:opacity-40"
                />
              </label>

              {/* AI summaries */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">AI summaries</span>
                    <span className="text-[11px] text-stone-500">Generate key takeaways and reflections</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.aiAnalysisEnabled}
                  checked={settings.aiSummaries && settings.aiAnalysisEnabled}
                  onChange={() => handleToggleFeature("aiSummaries")}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 disabled:opacity-40"
                />
              </label>

              {/* Weekly insights */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Compass className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Weekly insights</span>
                    <span className="text-[11px] text-stone-500">Periodic pattern analysis and review</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.aiAnalysisEnabled}
                  checked={settings.weeklyInsights && settings.aiAnalysisEnabled}
                  onChange={() => handleToggleFeature("weeklyInsights")}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 disabled:opacity-40"
                />
              </label>

              {/* Journal search */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Journal search</span>
                    <span className="text-[11px] text-stone-500">Smart semantic search across past entries</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.aiAnalysisEnabled}
                  checked={settings.journalSearch && settings.aiAnalysisEnabled}
                  onChange={() => handleToggleFeature("journalSearch")}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 disabled:opacity-40"
                />
              </label>

              {/* Mood/sentiment insights */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Smile className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Mood & sentiment insights</span>
                    <span className="text-[11px] text-stone-500">Emotional tone and energy trajectory</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.aiAnalysisEnabled}
                  checked={settings.moodSentimentInsights && settings.aiAnalysisEnabled}
                  onChange={() => handleToggleFeature("moodSentimentInsights")}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 disabled:opacity-40"
                />
              </label>

              {/* Future Self suggestions */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-stone-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Future Self suggestions</span>
                    <span className="text-[11px] text-stone-500">Gentle prompts when creating notes to future self</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.aiAnalysisEnabled}
                  checked={settings.futureSelfSuggestions && settings.aiAnalysisEnabled}
                  onChange={() => handleToggleFeature("futureSelfSuggestions")}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. YOUR DATA (Export, Delete memory, Delete all) */}
          {/* ========================================================= */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 font-['Plus_Jakarta_Sans']">
              Your Data
            </h4>

            <div className="space-y-2.5">
              {/* Export My Journal */}
              <div className="p-3.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold text-stone-900">Export my journal</h5>
                  <p className="text-[11px] text-stone-500">
                    Download your journal entries in JSON & formatted Markdown.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJournal}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-stone-700" />
                  <span>Export</span>
                </button>
              </div>

              {/* Delete a memory */}
              <div className="p-3.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold text-stone-900">Delete a memory</h5>
                  <p className="text-[11px] text-stone-500">
                    Remove selected memories or journal entries permanently.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManageMemoriesOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-stone-600" />
                  <span>Manage Memories</span>
                </button>
              </div>

              {/* Delete all journal data */}
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold text-rose-950">Delete all journal data</h5>
                  <p className="text-[11px] text-rose-700">
                    Permanently wipe all journal reflections, unfinished items, and memory caches.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteAllOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All Data</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {saveSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Settings saved successfully
              </span>
            ) : (
              "Preferences saved to your account"
            )}
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
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* SUB-MODAL: MANAGE MEMORIES (SELECTIVE DELETION) */}
      {/* ============================================================= */}
      {isManageMemoriesOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
                  Delete a Memory
                </h3>
                <p className="text-[11px] text-stone-500">
                  Select specific entries to permanently remove
                </p>
              </div>
              <button
                onClick={() => setIsManageMemoriesOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 max-h-60 pr-1">
              {reflections.length === 0 ? (
                <p className="text-xs text-stone-500 italic py-4 text-center">
                  No journal entries found.
                </p>
              ) : (
                reflections.map((r) => {
                  const isChecked = selectedEntryIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? "border-rose-400 bg-rose-50/60"
                          : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      <div className="space-y-0.5 truncate max-w-[340px]">
                        <span className="font-bold text-stone-900 block truncate">
                          {r.title || "Untitled entry"}
                        </span>
                        <span className="text-[11px] text-stone-500">{r.date}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedEntryIds((prev) =>
                            prev.includes(r.id)
                              ? prev.filter((id) => id !== r.id)
                              : [...prev, r.id]
                          );
                        }}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <span className="text-xs text-stone-500">
                {selectedEntryIds.length} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManageMemoriesOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={isDeletingSelected || selectedEntryIds.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isDeletingSelected ? "Deleting..." : `Delete ${selectedEntryIds.length} Memories`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* SUB-MODAL: DELETE ALL JOURNAL DATA PERMANENT CONFIRMATION */}
      {/* ============================================================= */}
      {isDeleteAllOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-rose-300 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-stone-100 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Delete All Journal Data?
                </h3>
                <p className="text-xs text-stone-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed">
              This action is permanent and cannot be undone. All entries, encrypted payloads, objectives, and reflections will be deleted.
            </p>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-stone-700">
                Type <strong>DELETE</strong> below to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full p-2.5 rounded-xl border border-stone-300 text-stone-900 uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteAllOpen(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={deleteConfirmText !== "DELETE" || isDeletingAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {isDeletingAll ? "Deleting everything..." : "Permanently Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
