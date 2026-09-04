import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  BarChart2, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Bell, 
  ArrowRight, 
  ArrowLeft, 
  ChevronRight, 
  Download, 
  ExternalLink, 
  Shield, 
  Filter, 
  Trash2, 
  TrendingUp, 
  Smile, 
  HelpCircle, 
  RefreshCw,
  Edit,
  PenTool,
  AlertCircle
} from "lucide-react";
import { 
  ReflectionDoc, 
  UserProfile, 
  WeeklyAnalysisResult, 
  MonthlyAnalysisResult, 
  DetectedCalendarItem, 
  SavedCalendarEvent,
  CalendarAssistantSettings
} from "../types";
import { 
  fetchUserAnalyses, 
  persistAnalysisDoc, 
  deleteAnalysisDoc, 
  fetchUserCalendarItems, 
  deleteCalendarItemDoc 
} from "../lib/firebase";
import { CalendarAssistantModal } from "./CalendarAssistantModal";

interface InsightsDashboardProps {
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  onStartNewJournalWithPrompt: (promptText: string) => void;
  onNavigateToHistory: () => void;
}

type TabType = "week" | "month" | "calendar_hub";

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  userProfile,
  reflections,
  onStartNewJournalWithPrompt,
  onNavigateToHistory,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("week");

  // Settings
  const [settings, setSettings] = useState<CalendarAssistantSettings>({
    allowAIJournalAnalysis: true,
    allowCalendarSuggestions: true,
    allowEmotionalAnalysis: true,
  });

  // Week selection
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0); // 0 = current week, 1 = previous week
  const [weeklyAnalysis, setWeeklyAnalysis] = useState<WeeklyAnalysisResult | null>(null);
  const [isAnalyzingWeek, setIsAnalyzingWeek] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);

  // Month selection
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = current month (Sep 2026), 1 = previous month (Aug 2026)
  const [monthlyAnalysis, setMonthlyAnalysis] = useState<MonthlyAnalysisResult | null>(null);
  const [isAnalyzingMonth, setIsAnalyzingMonth] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  // Saved Calendar Items
  const [savedCalendarEvents, setSavedCalendarEvents] = useState<SavedCalendarEvent[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // Calendar Assistant Modal
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [modalItems, setModalItems] = useState<DetectedCalendarItem[]>([]);
  const [modalSourceTitle, setModalSourceTitle] = useState("Weekly/Monthly Insights");

  // Load saved analyses and calendar items on mount
  useEffect(() => {
    loadSavedCalendarItems();
    loadSavedAnalyses();
  }, [userProfile.uid]);

  const loadSavedCalendarItems = async () => {
    setIsLoadingCalendar(true);
    try {
      const items = await fetchUserCalendarItems(userProfile.uid);
      setSavedCalendarEvents(items as SavedCalendarEvent[]);
    } catch (err) {
      console.warn("Failed to load saved calendar events:", err);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const loadSavedAnalyses = async () => {
    try {
      const analyses = await fetchUserAnalyses(userProfile.uid);
      const weekRecord = analyses.find((a: any) => a.type === "week");
      if (weekRecord) setWeeklyAnalysis(weekRecord as WeeklyAnalysisResult);
      const monthRecord = analyses.find((a: any) => a.type === "month");
      if (monthRecord) setMonthlyAnalysis(monthRecord as MonthlyAnalysisResult);
    } catch (err) {
      console.warn("Failed to load past analyses:", err);
    }
  };

  // Helper date calculations based on reference date 2026-09-04
  const referenceDate = new Date(2026, 8, 4); // Sep 4, 2026

  // Calculate week boundaries
  const getWeekRange = (offsetWeeks: number) => {
    const target = new Date(referenceDate);
    target.setDate(target.getDate() - offsetWeeks * 7);
    // Find Monday
    const day = target.getDay();
    const diffToMonday = target.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(target.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    return {
      start: fmt(monday),
      end: fmt(sunday),
      label,
      identifier: `2026-W${36 - offsetWeeks}`,
    };
  };

  // Calculate month boundaries
  const getMonthRange = (offsetMonths: number) => {
    const target = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offsetMonths, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const monthName = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return {
      start: fmt(firstDay),
      end: fmt(lastDay),
      monthName,
      identifier: `${year}-${String(month + 1).padStart(2, "0")}`,
    };
  };

  const currentWeekInfo = getWeekRange(selectedWeekOffset);
  const previousWeekInfo = getWeekRange(selectedWeekOffset + 1);

  const currentMonthInfo = getMonthRange(selectedMonthOffset);
  const previousMonthInfo = getMonthRange(selectedMonthOffset + 1);

  // Filter entries for current period
  const getEntriesInRange = (start: string, end: string) => {
    return reflections.filter((r) => {
      const entryDate = r.date || r.createdAt.slice(0, 10);
      return entryDate >= start && entryDate <= end;
    });
  };

  const currentWeekEntries = getEntriesInRange(currentWeekInfo.start, currentWeekInfo.end);
  const previousWeekEntries = getEntriesInRange(previousWeekInfo.start, previousWeekInfo.end);

  const currentMonthEntries = getEntriesInRange(currentMonthInfo.start, currentMonthInfo.end);
  const previousMonthEntries = getEntriesInRange(previousMonthInfo.start, previousMonthInfo.end);

  // -------------------------------------------------------------
  // Analyze My Week Action
  // -------------------------------------------------------------
  const handleAnalyzeWeek = async () => {
    if (currentWeekEntries.length === 0) {
      setWeekError("No journal entries found in this week range to analyze.");
      return;
    }

    setIsAnalyzingWeek(true);
    setWeekError(null);

    try {
      const response = await fetch("/api/gemini/analyze-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType: "week",
          periodLabel: currentWeekInfo.label,
          referenceDate: "2026-09-04",
          entries: currentWeekEntries.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            mood: e.mood,
            moodScore: e.moodScore,
            tags: e.tags,
            text: e.messages?.filter((m) => m.role === "user").map((m) => m.content).join("\n") || "",
          })),
          previousPeriodEntries: previousWeekEntries.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            mood: e.mood,
            text: e.messages?.filter((m) => m.role === "user").map((m) => m.content).join("\n") || "",
          })),
          options: {
            allowEmotionalAnalysis: settings.allowEmotionalAnalysis,
            allowCalendarSuggestions: settings.allowCalendarSuggestions,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze week.");
      }

      const result: WeeklyAnalysisResult = {
        id: `week_${currentWeekInfo.identifier}_${Date.now()}`,
        userId: userProfile.uid,
        weekIdentifier: currentWeekInfo.identifier,
        startDate: currentWeekInfo.start,
        endDate: currentWeekInfo.end,
        entryCount: currentWeekEntries.length,
        accomplishmentCount: (data.accomplishments || []).length,
        taskCount: (data.unfinishedItems || []).length,
        upcomingEventCount: (data.upcomingEvents || []).length,
        patternCount: (data.patterns || []).length,
        createdAt: new Date().toISOString(),
        reflection: data.reflection || {},
        patterns: data.patterns || [],
        moodOverview: data.moodOverview || null,
        accomplishments: data.accomplishments || [],
        unfinishedItems: data.unfinishedItems || [],
        upcomingEvents: data.upcomingEvents || [],
        comparison: data.comparison,
        oneParagraphSummary: data.oneParagraphSummary || "",
      };

      // Persist in Firestore
      await persistAnalysisDoc(userProfile.uid, result.id, {
        ...result,
        type: "week",
        targetId: currentWeekInfo.identifier,
      });

      setWeeklyAnalysis(result);
    } catch (err: any) {
      console.error("Weekly analysis error:", err);
      setWeekError(err?.message || "Failed to analyze week.");
    } finally {
      setIsAnalyzingWeek(false);
    }
  };

  // -------------------------------------------------------------
  // Analyze My Month Action
  // -------------------------------------------------------------
  const handleAnalyzeMonth = async () => {
    if (currentMonthEntries.length === 0) {
      setMonthError("No journal entries found in this month to analyze.");
      return;
    }

    setIsAnalyzingMonth(true);
    setMonthError(null);

    try {
      const response = await fetch("/api/gemini/analyze-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodType: "month",
          periodLabel: currentMonthInfo.monthName,
          referenceDate: "2026-09-04",
          entries: currentMonthEntries.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            mood: e.mood,
            moodScore: e.moodScore,
            tags: e.tags,
            text: e.messages?.filter((m) => m.role === "user").map((m) => m.content).join("\n") || "",
          })),
          previousPeriodEntries: previousMonthEntries.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            mood: e.mood,
            text: e.messages?.filter((m) => m.role === "user").map((m) => m.content).join("\n") || "",
          })),
          options: {
            allowEmotionalAnalysis: settings.allowEmotionalAnalysis,
            allowCalendarSuggestions: settings.allowCalendarSuggestions,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze month.");
      }

      const result: MonthlyAnalysisResult = {
        id: `month_${currentMonthInfo.identifier}_${Date.now()}`,
        userId: userProfile.uid,
        monthIdentifier: currentMonthInfo.identifier,
        monthName: currentMonthInfo.monthName,
        startDate: currentMonthInfo.start,
        endDate: currentMonthInfo.end,
        entryCount: currentMonthEntries.length,
        majorEventCount: (data.reflection?.majorEvents || []).length,
        accomplishmentCount: (data.reflection?.majorAccomplishments || []).length,
        unfinishedTaskCount: (data.unfinishedItems || []).length,
        upcomingEventCount: (data.upcomingEvents || []).length,
        recurringThemeCount: (data.personalPatterns || []).length,
        createdAt: new Date().toISOString(),
        monthInReview: data.reflection || {},
        personalPatterns: data.personalPatterns || [],
        progressTracking: data.progressTracking || [],
        importantDates: data.upcomingEvents || [],
        reflectionQuestions: data.reflectionQuestions || [],
        comparison: data.comparison,
        oneParagraphSummary: data.oneParagraphSummary || "",
      };

      // Persist in Firestore
      await persistAnalysisDoc(userProfile.uid, result.id, {
        ...result,
        type: "month",
        targetId: currentMonthInfo.identifier,
      });

      setMonthlyAnalysis(result);
    } catch (err: any) {
      console.error("Monthly analysis error:", err);
      setMonthError(err?.message || "Failed to analyze month.");
    } finally {
      setIsAnalyzingMonth(false);
    }
  };

  // Open calendar review modal from weekly or monthly upcoming items
  const handleOpenCalendarReview = (items: DetectedCalendarItem[], title: string) => {
    setModalItems(items);
    setModalSourceTitle(title);
    setIsCalendarModalOpen(true);
  };

  // Export all saved calendar items as .ics
  const handleExportAllIcs = () => {
    if (savedCalendarEvents.length === 0) return;
    let lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ReflectAI//Journal Calendar Assistant//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const item of savedCalendarEvents) {
      const uid = `reflectai-${item.id}@reflectai.app`;
      const cleanDate = item.date.replace(/-/g, "");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${item.title.replace(/[,;\n]/g, " ")}`);
      if (item.time) {
        const [h, m] = item.time.split(":");
        lines.push(`DTSTART:${cleanDate}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${cleanDate}`);
      }
      lines.push(`DESCRIPTION:${(item.description || "Added from ReflectAI").replace(/\n/g, "\\n")}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    const content = lines.join("\r\n");

    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reflectai-all-events-${new Date().toISOString().slice(0, 10)}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteCalendarItem = async (itemId: string) => {
    try {
      await deleteCalendarItemDoc(userProfile.uid, itemId);
      setSavedCalendarEvents((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      console.warn("Delete calendar item error:", err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in font-['Newsreader'] text-stone-900">
      
      {/* ------------------------------------------------------------- */}
      {/* HEADER: Title & Primary Tabs                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans uppercase font-bold tracking-wider text-amber-800">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>AI-Powered Reflection & Calendar Intelligence</span>
          </div>
          <h2 className="text-3xl font-serif font-bold text-stone-900 tracking-tight mt-1">
            Periodic Insights & Calendar Assistant
          </h2>
          <p className="text-sm text-stone-600 font-sans mt-0.5">
            Reflect on experiences, discover patterns, identify upcoming commitments, and manage your calendar.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-200/80 rounded-xl font-sans text-xs font-semibold">
          <button
            id="tab-analyze-week"
            onClick={() => setActiveTab("week")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "week"
                ? "bg-amber-800 text-amber-50 shadow-sm"
                : "text-stone-700 hover:text-stone-950 hover:bg-stone-300/60"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>📊 Analyze My Week</span>
          </button>
          
          <button
            id="tab-analyze-month"
            onClick={() => setActiveTab("month")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "month"
                ? "bg-amber-800 text-amber-50 shadow-sm"
                : "text-stone-700 hover:text-stone-950 hover:bg-stone-300/60"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📚 Analyze My Month</span>
          </button>

          <button
            id="tab-calendar-assistant"
            onClick={() => setActiveTab("calendar_hub")}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === "calendar_hub"
                ? "bg-amber-800 text-amber-50 shadow-sm"
                : "text-stone-700 hover:text-stone-950 hover:bg-stone-300/60"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>📅 Calendar Assistant</span>
            {savedCalendarEvents.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[10px] flex items-center justify-center font-bold">
                {savedCalendarEvents.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: 📊 ANALYZE MY WEEK                                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "week" && (
        <div className="space-y-6">
          
          {/* Week Selector Bar & Action */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedWeekOffset((prev) => prev + 1)}
                className="p-2 rounded-lg text-stone-600 hover:bg-amber-200/60 transition-colors"
                title="Previous Week"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              
              <div>
                <span className="text-[11px] font-sans uppercase font-bold text-amber-900 tracking-wider">
                  {selectedWeekOffset === 0 ? "Current Week" : `${selectedWeekOffset} Week(s) Ago`}
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  {currentWeekInfo.label}
                </h3>
              </div>

              {selectedWeekOffset > 0 && (
                <button
                  onClick={() => setSelectedWeekOffset((prev) => Math.max(0, prev - 1))}
                  className="p-2 rounded-lg text-stone-600 hover:bg-amber-200/60 transition-colors"
                  title="Next Week"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Metrics & CTA */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs font-sans text-stone-600 px-3 py-1.5 rounded-lg bg-white/80 border border-amber-200">
                <span className="font-bold text-stone-900">{currentWeekEntries.length}</span> entries logged
              </div>

              <button
                id="btn-run-weekly-analysis"
                onClick={handleAnalyzeWeek}
                disabled={isAnalyzingWeek || currentWeekEntries.length === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-amber-50 font-sans text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                {isAnalyzingWeek ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Week...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>📊 Analyze This Week</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {weekError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{weekError}</span>
            </div>
          )}

          {/* Quick Metrics Row if analysis exists */}
          {weeklyAnalysis && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-sans">
              <div className="p-3.5 rounded-xl bg-white/90 border border-stone-200 text-center shadow-xs">
                <span className="text-[11px] text-stone-500 uppercase font-semibold">Entries</span>
                <p className="text-2xl font-serif font-bold text-stone-900">{weeklyAnalysis.entryCount}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/90 border border-stone-200 text-center shadow-xs">
                <span className="text-[11px] text-stone-500 uppercase font-semibold">Accomplishments</span>
                <p className="text-2xl font-serif font-bold text-emerald-700">{weeklyAnalysis.accomplishmentCount}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/90 border border-stone-200 text-center shadow-xs">
                <span className="text-[11px] text-stone-500 uppercase font-semibold">Pending Tasks</span>
                <p className="text-2xl font-serif font-bold text-blue-700">{weeklyAnalysis.taskCount}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/90 border border-stone-200 text-center shadow-xs">
                <span className="text-[11px] text-stone-500 uppercase font-semibold">Upcoming Events</span>
                <p className="text-2xl font-serif font-bold text-amber-700">{weeklyAnalysis.upcomingEventCount}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-white/90 border border-stone-200 text-center shadow-xs">
                <span className="text-[11px] text-stone-500 uppercase font-semibold">Patterns</span>
                <p className="text-2xl font-serif font-bold text-stone-800">{weeklyAnalysis.patternCount}</p>
              </div>
            </div>
          )}

          {/* Detailed Weekly Sections */}
          {weeklyAnalysis ? (
            <div className="space-y-6 animate-fade-in">
              
              {/* 💬 YOUR WEEK IN ONE PARAGRAPH */}
              {weeklyAnalysis.oneParagraphSummary && (
                <div className="p-6 rounded-2xl bg-amber-100/50 border border-amber-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-amber-900">
                    Your Week in One Paragraph
                  </span>
                  <p className="text-lg font-serif italic text-stone-800 leading-relaxed">
                    "{weeklyAnalysis.oneParagraphSummary}"
                  </p>
                </div>
              )}

              {/* 📝 WEEKLY REFLECTION STRUCTURE */}
              <div className="p-6 rounded-2xl bg-white/90 border border-stone-200 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <span className="text-xl">📝</span>
                  <h4 className="text-xl font-serif font-bold text-stone-900">
                    Weekly Reflection
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-sans text-xs">
                  {/* Major Events & Experiences */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-stone-800 uppercase tracking-wider text-[11px]">
                      Major Events & Experiences
                    </h5>
                    <ul className="space-y-1 text-stone-600 list-disc list-inside">
                      {weeklyAnalysis.reflection?.majorEvents?.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                      {weeklyAnalysis.reflection?.importantExperiences?.map((item, i) => (
                        <li key={`exp-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Challenges & Changes */}
                  <div className="space-y-2">
                    <h5 className="font-semibold text-stone-800 uppercase tracking-wider text-[11px]">
                      Challenges & Significant Changes
                    </h5>
                    <ul className="space-y-1 text-stone-600 list-disc list-inside">
                      {weeklyAnalysis.reflection?.challenges?.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                      {weeklyAnalysis.reflection?.significantChanges?.map((item, i) => (
                        <li key={`chg-${i}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 📈 MEANINGFUL PATTERNS */}
              {weeklyAnalysis.patterns?.length > 0 && (
                <div className="p-6 rounded-2xl bg-white/90 border border-stone-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                    <TrendingUp className="w-5 h-5 text-amber-700" />
                    <h4 className="text-xl font-serif font-bold text-stone-900">
                      Meaningful Patterns
                    </h4>
                  </div>
                  <p className="text-xs font-sans text-stone-500">
                    Recurring observations and energy rhythms across your week, phrased as patterns rather than diagnoses.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {weeklyAnalysis.patterns.map((p, i) => (
                      <div key={i} className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-serif font-bold text-stone-900 text-sm">{p.title}</h5>
                          {p.category && (
                            <span className="text-[10px] uppercase font-sans font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                              {p.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-sans text-stone-700 leading-relaxed">{p.observation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 😊 MOOD & EMOTION OVERVIEW */}
              {weeklyAnalysis.moodOverview && (
                <div className="p-5 rounded-2xl bg-white/90 border border-stone-200 shadow-xs flex items-start gap-3">
                  <Smile className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="font-serif font-bold text-stone-900 text-base">
                      Mood & Emotion Overview
                    </h5>
                    <p className="text-sm font-sans text-stone-700 leading-relaxed">
                      {weeklyAnalysis.moodOverview}
                    </p>
                  </div>
                </div>
              )}

              {/* ✅ ACCOMPLISHMENTS & ⏳ UNFINISHED ITEMS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Accomplishments */}
                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-xs space-y-3 font-sans text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <h5 className="font-serif font-bold text-emerald-950 text-base">Accomplishments</h5>
                  </div>
                  <ul className="space-y-1.5 text-stone-700 list-disc list-inside">
                    {weeklyAnalysis.accomplishments?.map((acc, i) => (
                      <li key={i}>{acc}</li>
                    ))}
                  </ul>
                </div>

                {/* Unfinished Items */}
                <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-xs space-y-3 font-sans text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <h5 className="font-serif font-bold text-blue-950 text-base">Unfinished Items</h5>
                  </div>
                  <ul className="space-y-1.5 text-stone-700 list-disc list-inside">
                    {weeklyAnalysis.unfinishedItems?.map((unf, i) => (
                      <li key={i}>{unf}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 📅 UPCOMING EVENTS & CALENDAR OPPORTUNITIES */}
              {weeklyAnalysis.upcomingEvents?.length > 0 && (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-100 to-amber-200/80 border border-amber-300 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Bell className="w-5 h-5 text-amber-800" />
                      <div>
                        <h4 className="font-serif font-bold text-stone-900 text-lg">
                          🔔 I found {weeklyAnalysis.upcomingEvents.length} calendar opportunities for next week.
                        </h4>
                        <p className="text-xs font-sans text-stone-700">
                          Review each detected date, time, and reminder setting before authorizing addition.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenCalendarReview(weeklyAnalysis.upcomingEvents, "Weekly Commitments")}
                      className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 font-sans text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
                    >
                      Review & Add to Calendar
                    </button>
                  </div>

                  {/* List preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans text-xs">
                    {weeklyAnalysis.upcomingEvents.map((ev) => (
                      <div key={ev.id} className="p-3 rounded-lg bg-white/80 border border-amber-200 flex items-center justify-between">
                        <span className="font-medium text-stone-800 truncate pr-2">{ev.title}</span>
                        <span className="text-stone-500 font-mono whitespace-nowrap">{ev.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🔄 COMPARE WITH PREVIOUS WEEK */}
              {weeklyAnalysis.comparison && (
                <div className="p-5 rounded-2xl bg-stone-100/80 border border-stone-200 shadow-xs space-y-2 font-sans text-xs">
                  <span className="text-[11px] uppercase font-bold text-stone-600 tracking-wider">
                    Comparison with Previous Week
                  </span>
                  {weeklyAnalysis.comparison.hasComparisonData ? (
                    <ul className="space-y-1 text-stone-700 list-disc list-inside">
                      {weeklyAnalysis.comparison.summaryPoints?.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-stone-500 italic">
                      Previous week has limited entries; no comparative statistics were fabricated.
                    </p>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* Empty State */
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/50 space-y-3">
              <BarChart2 className="w-10 h-10 text-stone-400 mx-auto" />
              <h4 className="text-xl font-serif font-bold text-stone-800">
                Ready to analyze your week?
              </h4>
              <p className="text-xs font-sans text-stone-500 max-w-md mx-auto">
                ReflectAI will examine your {currentWeekEntries.length} reflections from {currentWeekInfo.label} to extract major experiences, recurring patterns, and future commitments.
              </p>
              {currentWeekEntries.length > 0 ? (
                <button
                  onClick={handleAnalyzeWeek}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-amber-50 font-sans text-xs font-semibold shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze My Week</span>
                </button>
              ) : (
                <button
                  onClick={onNavigateToHistory}
                  className="px-5 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-sans text-xs font-semibold transition-all"
                >
                  Browse Past Entries
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: 📚 ANALYZE MY MONTH                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "month" && (
        <div className="space-y-6">
          
          {/* Month Selector Bar & Action */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedMonthOffset((prev) => prev + 1)}
                className="p-2 rounded-lg text-stone-600 hover:bg-amber-200/60 transition-colors"
                title="Previous Month"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              
              <div>
                <span className="text-[11px] font-sans uppercase font-bold text-amber-900 tracking-wider">
                  {selectedMonthOffset === 0 ? "Current Month" : `${selectedMonthOffset} Month(s) Ago`}
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  {currentMonthInfo.monthName}
                </h3>
              </div>

              {selectedMonthOffset > 0 && (
                <button
                  onClick={() => setSelectedMonthOffset((prev) => Math.max(0, prev - 1))}
                  className="p-2 rounded-lg text-stone-600 hover:bg-amber-200/60 transition-colors"
                  title="Next Month"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs font-sans text-stone-600 px-3 py-1.5 rounded-lg bg-white/80 border border-amber-200">
                <span className="font-bold text-stone-900">{currentMonthEntries.length}</span> entries logged
              </div>

              <button
                id="btn-run-monthly-analysis"
                onClick={handleAnalyzeMonth}
                disabled={isAnalyzingMonth || currentMonthEntries.length === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-amber-50 font-sans text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                {isAnalyzingMonth ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Month...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>📚 Analyze This Month</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {monthError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{monthError}</span>
            </div>
          )}

          {/* Month Analysis Render */}
          {monthlyAnalysis ? (
            <div className="space-y-6 animate-fade-in">
              
              {/* 💬 YOUR MONTH IN ONE PARAGRAPH */}
              {monthlyAnalysis.oneParagraphSummary && (
                <div className="p-6 rounded-2xl bg-amber-100/50 border border-amber-200 shadow-xs space-y-2">
                  <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-amber-900">
                    Your Month in One Paragraph
                  </span>
                  <p className="text-lg font-serif italic text-stone-800 leading-relaxed">
                    "{monthlyAnalysis.oneParagraphSummary}"
                  </p>
                </div>
              )}

              {/* 🌟 MONTH IN REVIEW */}
              <div className="p-6 rounded-2xl bg-white/90 border border-stone-200 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <span className="text-xl">🌟</span>
                  <h4 className="text-xl font-serif font-bold text-stone-900">
                    Month in Review
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs">
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                    <h5 className="font-bold text-stone-900 text-[11px] uppercase">
                      Major Events & Moments
                    </h5>
                    <ul className="space-y-1 text-stone-600 list-disc list-inside">
                      {monthlyAnalysis.monthInReview?.majorEvents?.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                      {monthlyAnalysis.monthInReview?.memorableMoments?.map((m, i) => (
                        <li key={`mem-${i}`}>{m}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                    <h5 className="font-bold text-stone-900 text-[11px] uppercase">
                      Accomplishments & Decisions
                    </h5>
                    <ul className="space-y-1 text-stone-600 list-disc list-inside">
                      {monthlyAnalysis.monthInReview?.majorAccomplishments?.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                      {monthlyAnalysis.monthInReview?.importantDecisions?.map((m, i) => (
                        <li key={`dec-${i}`}>{m}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                    <h5 className="font-bold text-stone-900 text-[11px] uppercase">
                      Goals Achieved & In Progress
                    </h5>
                    <ul className="space-y-1 text-stone-600 list-disc list-inside">
                      {monthlyAnalysis.monthInReview?.goalsAchieved?.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                      {monthlyAnalysis.monthInReview?.goalsInProgress?.map((m, i) => (
                        <li key={`prog-${i}`}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 📈 PROGRESS TRACKING */}
              {monthlyAnalysis.progressTracking?.length > 0 && (
                <div className="p-6 rounded-2xl bg-white/90 border border-stone-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-700" />
                    <h4 className="text-xl font-serif font-bold text-stone-900">
                      Goal Progress Tracking
                    </h4>
                  </div>
                  <p className="text-xs font-sans text-stone-500">
                    Compares goals mentioned earlier in the month with progress demonstrated in later entries.
                  </p>

                  <div className="space-y-3 font-sans text-xs">
                    {monthlyAnalysis.progressTracking.map((prog, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-emerald-950 text-sm">{prog.goal}</span>
                          <p className="text-stone-600 text-xs mt-0.5">{prog.details}</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-200/80 text-emerald-900 font-semibold font-mono text-[11px] shrink-0">
                          {prog.progressStage}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 💭 THOUGHTFUL REFLECTION QUESTIONS */}
              {monthlyAnalysis.reflectionQuestions?.length > 0 && (
                <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-amber-200 pb-3">
                    <HelpCircle className="w-5 h-5 text-amber-700" />
                    <h4 className="text-xl font-serif font-bold text-stone-900">
                      Thoughtful Reflection Questions
                    </h4>
                  </div>
                  <p className="text-xs font-sans text-stone-600">
                    Inspired by your month's themes. Answer any question directly as a new journal entry:
                  </p>

                  <div className="space-y-3">
                    {monthlyAnalysis.reflectionQuestions.map((q, i) => (
                      <div key={i} className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div>
                          <h5 className="font-serif font-bold text-stone-900 text-base">{q.question}</h5>
                          {q.contextPrompt && (
                            <p className="text-xs font-sans text-stone-500 mt-0.5">{q.contextPrompt}</p>
                          )}
                        </div>
                        <button
                          onClick={() => onStartNewJournalWithPrompt(`Reflection Prompt: ${q.question}\n\n`)}
                          className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 font-sans text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Answer in Journal</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🗓️ IMPORTANT DATES & CALENDAR OPPORTUNITIES */}
              {monthlyAnalysis.importantDates?.length > 0 && (
                <div className="p-6 rounded-2xl bg-amber-100/70 border border-amber-300 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-amber-800" />
                      <div>
                        <h4 className="font-serif font-bold text-stone-900 text-lg">
                          🔔 Found {monthlyAnalysis.importantDates.length} upcoming commitments for this month.
                        </h4>
                        <p className="text-xs font-sans text-stone-700">
                          Deadlines, birthdays, exams, travel plans and meetings.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenCalendarReview(monthlyAnalysis.importantDates, "Monthly Commitments")}
                      className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 font-sans text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
                    >
                      Review & Add to Calendar
                    </button>
                  </div>
                </div>
              )}

              {/* 🔄 COMPARE WITH PREVIOUS MONTH */}
              {monthlyAnalysis.comparison && (
                <div className="p-5 rounded-2xl bg-stone-100/80 border border-stone-200 shadow-xs space-y-2 font-sans text-xs">
                  <span className="text-[11px] uppercase font-bold text-stone-600 tracking-wider">
                    Comparison with Previous Month
                  </span>
                  {monthlyAnalysis.comparison.hasComparisonData ? (
                    <ul className="space-y-1 text-stone-700 list-disc list-inside">
                      {monthlyAnalysis.comparison.summaryPoints?.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-stone-500 italic">
                      Prior month has limited entries; no comparative statistics were fabricated.
                    </p>
                  )}
                </div>
              )}

            </div>
          ) : (
            /* Empty Month State */
            <div className="p-12 text-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/50 space-y-3">
              <BookOpen className="w-10 h-10 text-stone-400 mx-auto" />
              <h4 className="text-xl font-serif font-bold text-stone-800">
                Ready to review your month?
              </h4>
              <p className="text-xs font-sans text-stone-500 max-w-md mx-auto">
                Synthesize accomplishments, personal patterns, goal progressions, and upcoming deadlines across {currentMonthInfo.monthName}.
              </p>
              {currentMonthEntries.length > 0 ? (
                <button
                  onClick={handleAnalyzeMonth}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-amber-50 font-sans text-xs font-semibold shadow-md transition-all active:scale-95 inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze My Month</span>
                </button>
              ) : (
                <button
                  onClick={onNavigateToHistory}
                  className="px-5 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-sans text-xs font-semibold transition-all"
                >
                  Browse Past Entries
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: 📅 CALENDAR ASSISTANT & SYNC HUB                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "calendar_hub" && (
        <div className="space-y-6">
          
          {/* Top Actions & Sync Banner */}
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-sans uppercase font-bold text-amber-900 tracking-wider">
                <Shield className="w-4 h-4 text-amber-700" />
                <span>Authorized Calendar Schedule</span>
              </div>
              <h3 className="text-2xl font-serif font-bold text-stone-900 mt-1">
                Calendar Assistant & History
              </h3>
              <p className="text-xs font-sans text-stone-600 mt-0.5">
                Every event or reminder here was explicitly reviewed and confirmed by you.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap font-sans">
              <button
                onClick={handleExportAllIcs}
                disabled={savedCalendarEvents.length === 0}
                className="px-4 py-2 rounded-xl bg-white border border-stone-300 text-stone-800 hover:bg-stone-100 disabled:opacity-50 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download All (.ics)</span>
              </button>

              <button
                onClick={loadSavedCalendarItems}
                disabled={isLoadingCalendar}
                className="p-2 rounded-xl border border-stone-300 bg-white text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                title="Refresh Calendar Items"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCalendar ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Privacy & Assistant Controls */}
          <div className="p-5 rounded-2xl bg-white/90 border border-stone-200 shadow-xs space-y-3 font-sans">
            <h4 className="font-serif font-bold text-stone-900 text-base">
              Privacy & Intelligence Preferences
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 bg-stone-50/50 cursor-pointer hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={settings.allowAIJournalAnalysis}
                  onChange={(e) => setSettings({ ...settings, allowAIJournalAnalysis: e.target.checked })}
                  className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-stone-900 block">Allow AI Journal Analysis</span>
                  <span className="text-[11px] text-stone-500">Analyze reflections for personal insights</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 bg-stone-50/50 cursor-pointer hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={settings.allowCalendarSuggestions}
                  onChange={(e) => setSettings({ ...settings, allowCalendarSuggestions: e.target.checked })}
                  className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-stone-900 block">Allow Calendar Suggestions</span>
                  <span className="text-[11px] text-stone-500">Detect commitments & propose calendar items</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 bg-stone-50/50 cursor-pointer hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={settings.allowEmotionalAnalysis}
                  onChange={(e) => setSettings({ ...settings, allowEmotionalAnalysis: e.target.checked })}
                  className="rounded text-amber-700 focus:ring-amber-500 w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-stone-900 block">Allow Mood/Emotion Overview</span>
                  <span className="text-[11px] text-stone-500">Summarize emotional arc across periods</span>
                </div>
              </label>
            </div>
          </div>

          {/* List of Saved Calendar Items */}
          <div className="space-y-3">
            <h4 className="font-serif font-bold text-stone-900 text-lg">
              Saved Calendar Events & Tasks ({savedCalendarEvents.length})
            </h4>

            {savedCalendarEvents.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-stone-200 bg-white/70 font-sans text-xs text-stone-500 space-y-1">
                <CalendarIcon className="w-8 h-8 text-stone-300 mx-auto" />
                <p>No calendar items have been saved yet.</p>
                <p className="text-stone-400">
                  Analyze individual entries or your week/month to discover calendar opportunities!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                {savedCalendarEvents.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-stone-200 bg-white shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            item.type === "event"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {item.type}
                        </span>
                        <h5 className="font-semibold text-stone-900 text-sm truncate">
                          {item.title}
                        </h5>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-stone-600 font-mono">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5 text-stone-400" />
                          {item.date}
                        </span>
                        {item.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            {item.time}
                          </span>
                        )}
                        {item.reminderMinutesBefore && (
                          <span className="flex items-center gap-1 font-sans text-[11px] text-amber-800">
                            <Bell className="w-3.5 h-3.5" />
                            {item.reminderMinutesBefore >= 1440
                              ? `${item.reminderMinutesBefore / 1440}d before`
                              : `${item.reminderMinutesBefore}m before`}
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-stone-500 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteCalendarItem(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete from Assistant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Calendar Assistant Review Modal */}
      <CalendarAssistantModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        userId={userProfile.uid}
        items={modalItems}
        sourceTitle={modalSourceTitle}
        onItemsAdded={(count) => {
          loadSavedCalendarItems();
        }}
      />
    </div>
  );
};
