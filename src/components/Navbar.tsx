import React from "react";
import { AppView, UserProfile } from "../types";
import { 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  Lock, 
  BookOpen, 
  BarChart3, 
  PlusCircle, 
  LogOut, 
  User as UserIcon,
  CheckCircle2,
  SlidersHorizontal,
  Palette,
  Share2
} from "lucide-react";

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  userProfile: UserProfile | null;
  onSignOut: () => void;
  onOpenEncryptionSettings: () => void;
  onOpenPrivacySettings?: () => void;
  isEncryptedUnlocked: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  userProfile,
  onSignOut,
  onOpenEncryptionSettings,
  onOpenPrivacySettings,
  isEncryptedUnlocked,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-900 text-stone-100 border-b border-stone-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-6">
          <button
            id="nav-brand-btn"
            onClick={() => setCurrentView("dashboard")}
            className="flex items-center gap-2.5 group text-left focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-stone-950 shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-stone-50 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                ReflectAI
                <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Gemini Flash
                </span>
              </span>
            </div>
          </button>

          {/* Primary View Navigation */}
          <nav className="hidden md:flex items-center gap-1.5 ml-2">
            <button
              id="nav-dashboard-tab"
              onClick={() => setCurrentView("dashboard")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "dashboard"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Dashboard
            </button>
            <button
              id="nav-history-tab"
              onClick={() => setCurrentView("history")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "history"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Past Entries
            </button>
            <button
              id="nav-scrapbook-tab"
              onClick={() => setCurrentView("scrapbook")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "scrapbook"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <Palette className="w-4 h-4 text-amber-400" />
              Scrapbook
            </button>
            <button
              id="nav-lifegraph-tab"
              onClick={() => setCurrentView("lifegraph")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "lifegraph"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              Life Graph
            </button>
            <button
              id="nav-analytics-tab"
              onClick={() => setCurrentView("analytics")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "analytics"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Mood & Streaks
            </button>
            <button
              id="nav-insights-tab"
              onClick={() => setCurrentView("insights")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "insights"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              AI Insights & Calendar
            </button>
            <button
              id="nav-unfinished-tab"
              onClick={() => setCurrentView("unfinished")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === "unfinished"
                  ? "bg-stone-800 text-amber-300 shadow-inner"
                  : "text-stone-300 hover:text-stone-100 hover:bg-stone-800/60"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              Unfinished
            </button>
          </nav>
        </div>

        {/* Right Action Area */}
        <div className="flex items-center gap-3">
          
          {/* New Reflection Button */}
          <button
            id="nav-new-reflection-btn"
            onClick={() => setCurrentView("new_journal")}
            className="px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Reflection</span>
            <span className="sm:hidden">Write</span>
          </button>

          {/* Daily Streak Pill */}
          <div 
            id="nav-streak-pill"
            title={`${userProfile?.currentStreak || 0} Day Journaling Streak!`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-amber-400 text-xs font-semibold"
          >
            <Flame className={`w-4 h-4 ${userProfile?.currentStreak ? "fill-amber-400 text-amber-500 animate-pulse" : "text-stone-500"}`} />
            <span>{userProfile?.currentStreak || 0}</span>
            <span className="text-stone-400 text-[11px] hidden sm:inline">days</span>
          </div>

          {/* Privacy & AI Controls Button */}
          {onOpenPrivacySettings && (
            <button
              id="nav-privacy-settings-btn"
              onClick={onOpenPrivacySettings}
              title="Privacy & AI Controls"
              className="p-1.5 rounded-lg border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="hidden xl:inline text-[11px]">Privacy & AI</span>
            </button>
          )}

          {/* E2EE Security Status Button */}
          <button
            id="nav-e2ee-toggle-btn"
            onClick={onOpenEncryptionSettings}
            title={
              userProfile?.e2eeEnabled
                ? isEncryptedUnlocked
                  ? "End-to-End Encryption Active (Unlocked)"
                  : "End-to-End Encryption Active (Locked)"
                : "Setup End-to-End Encryption"
            }
            className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors ${
              userProfile?.e2eeEnabled
                ? isEncryptedUnlocked
                  ? "bg-emerald-950/60 border-emerald-600 text-emerald-300"
                  : "bg-amber-950/60 border-amber-600 text-amber-300"
                : "bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200"
            }`}
          >
            {userProfile?.e2eeEnabled ? (
              isEncryptedUnlocked ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="hidden lg:inline text-[11px]">E2EE Unlocked</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="hidden lg:inline text-[11px]">E2EE Locked</span>
                </>
              )
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span className="hidden lg:inline text-[11px]">E2EE Off</span>
              </>
            )}
          </button>

          {/* User Menu & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-stone-800">
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-7 h-7 rounded-full border border-amber-400/40 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-stone-300 text-xs">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
            <span className="text-xs font-medium text-stone-300 max-w-[90px] truncate hidden md:inline">
              {userProfile?.displayName}
            </span>
            <button
              id="nav-logout-btn"
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-stone-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Mobile Subnav */}
      <div className="md:hidden flex border-t border-stone-800 bg-stone-900/95 px-2 py-1.5 justify-around text-xs overflow-x-auto gap-1">
        <button
          onClick={() => setCurrentView("dashboard")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "dashboard" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setCurrentView("history")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "history" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Entries
        </button>
        <button
          onClick={() => setCurrentView("scrapbook")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "scrapbook" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Scrapbook
        </button>
        <button
          onClick={() => setCurrentView("lifegraph")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "lifegraph" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => setCurrentView("analytics")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "analytics" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Mood
        </button>
        <button
          onClick={() => setCurrentView("insights")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "insights" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Insights
        </button>
        <button
          onClick={() => setCurrentView("unfinished")}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
            currentView === "unfinished" ? "text-amber-300 bg-stone-800" : "text-stone-400"
          }`}
        >
          Unfinished
        </button>
      </div>
    </header>
  );
};
