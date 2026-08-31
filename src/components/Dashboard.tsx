import React from "react";
import { ReflectionDoc, UserProfile, MoodType, AppView } from "../types";
import { MOODS, STREAK_MILESTONES, JOURNALING_PROMPTS } from "../lib/constants";
import { 
  Sparkles, 
  Flame, 
  PlusCircle, 
  BookOpen, 
  Smile, 
  ShieldCheck, 
  Lock, 
  Compass, 
  ArrowRight, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react";

interface DashboardProps {
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  onStartNewReflection: (starterPrompt?: string, mood?: MoodType) => void;
  onOpenReflection: (doc: ReflectionDoc) => void;
  onNavigate: (view: AppView) => void;
  onOpenEncryptionSettings: () => void;
  isEncryptedUnlocked: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  userProfile,
  reflections,
  onStartNewReflection,
  onOpenReflection,
  onNavigate,
  onOpenEncryptionSettings,
  isEncryptedUnlocked,
}) => {
  const currentStreak = userProfile.currentStreak || 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m.days > currentStreak) || null;
  const recentEntries = reflections.slice(0, 4);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Top Greeting & Streak Hero Card */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-6 sm:p-8 text-stone-100 shadow-lg border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Your Private Mindful Space
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold font-['Newsreader'] italic text-stone-50">
            {getGreeting()}, {userProfile.displayName.split(" ")[0]}.
          </h1>
          
          <p className="text-sm text-stone-300 font-['Plus_Jakarta_Sans'] leading-relaxed">
            Take a gentle breath. Check in with your inner state and converse with Gemini 3.6 Flash.
          </p>
        </div>

        {/* Streak & Write CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Streak Counter Pill */}
          <div 
            onClick={() => onNavigate("analytics")}
            className="p-4 rounded-2xl bg-stone-800/90 border border-stone-700/80 flex items-center gap-3 cursor-pointer hover:border-amber-400/50 transition-colors shadow-inner"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Flame className={`w-6 h-6 ${currentStreak ? "fill-amber-400 text-amber-500 animate-pulse" : "text-stone-500"}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-stone-100 font-['Plus_Jakarta_Sans'] leading-tight">
                {currentStreak} {currentStreak === 1 ? "Day" : "Days"}
              </div>
              <div className="text-[11px] text-stone-400 font-medium">
                {nextMilestone ? `Next: ${nextMilestone.title} (${nextMilestone.days}d)` : "Streak Master"}
              </div>
            </div>
          </div>

          <button
            id="dashboard-write-entry-btn"
            onClick={() => onStartNewReflection()}
            className="px-6 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Write New Reflection</span>
          </button>
        </div>
      </div>

      {/* Quick Launch Inspiration Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-amber-600" />
          Guided Reflection Starters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Starter 1: Daily Gratitude */}
          <div
            onClick={() => onStartNewReflection("Today, I want to take a moment to express gratitude for...", "radiant")}
            className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-amber-400 shadow-xs hover:shadow-sm cursor-pointer transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              ✨
            </div>
            <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-amber-900">
              Daily Gratitude
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Capture 3 positive moments that brightened your day.
            </p>
          </div>

          {/* Starter 2: Evening Unwind */}
          <div
            onClick={() => onStartNewReflection("Reflecting on today, what went well and what felt draining was...", "calm")}
            className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-cyan-400 shadow-xs hover:shadow-sm cursor-pointer transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              🌿
            </div>
            <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-cyan-900">
              Evening Unwind
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Release tension, process conversations, and settle in.
            </p>
          </div>

          {/* Starter 3: Brainstorm Solutions */}
          <div
            onClick={() => onStartNewReflection("I am facing a challenge with: ", "reflective")}
            className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-indigo-400 shadow-xs hover:shadow-sm cursor-pointer transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              💡
            </div>
            <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-indigo-900">
              Challenge Solver
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Talk through a roadblock with Gemini's brainstorming mode.
            </p>
          </div>

          {/* Starter 4: Mindful Self-Compassion */}
          <div
            onClick={() => onStartNewReflection("If I spoke to myself with unconditional kindness right now, I would acknowledge...", "joyful")}
            className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-emerald-400 shadow-xs hover:shadow-sm cursor-pointer transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              🌱
            </div>
            <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] group-hover:text-emerald-900">
              Kind Self-Talk
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Practice self-compassion when things feel heavy.
            </p>
          </div>

        </div>
      </div>

      {/* Main Grid: Recent Reflections & Mood Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Recent Journal Entries */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              Recent Journal Reflections
            </h2>
            <button
              onClick={() => onNavigate("history")}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              View All Archive ({reflections.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-stone-200 text-center space-y-3 shadow-sm">
              <Compass className="w-10 h-10 text-stone-300 mx-auto" />
              <h3 className="text-base font-bold text-stone-800 font-['Newsreader'] italic">
                Your journal is a clean slate.
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Begin your very first reflection today to start your journaling streak and receive Gemini insights.
              </p>
              <button
                onClick={() => onStartNewReflection()}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-xs"
              >
                Pen First Entry
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((doc) => {
                const moodMeta = MOODS[doc.mood] || MOODS.reflective;
                return (
                  <div
                    key={doc.id}
                    onClick={() => onOpenReflection(doc)}
                    className="p-5 rounded-2xl bg-white border border-stone-200/90 hover:border-amber-400 shadow-xs hover:shadow-sm cursor-pointer transition-all text-left flex items-start justify-between gap-4 group"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{moodMeta.emoji}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${moodMeta.bgClass}`}>
                          {moodMeta.label}
                        </span>
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {doc.date}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-stone-900 font-['Newsreader'] italic group-hover:text-amber-900 transition-colors">
                        {doc.title || "Reflective Entry"}
                      </h4>

                      {doc.summary && !doc.isEncrypted && (
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                          {doc.summary}
                        </p>
                      )}

                      {doc.isEncrypted && (
                        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          End-to-End Encrypted Reflection
                        </p>
                      )}
                    </div>

                    <div className="self-center p-2 rounded-xl bg-stone-50 text-stone-400 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Privacy & Security Box + Mood Quick Glance */}
        <div className="space-y-6">
          
          {/* Security & Isolation Status Widget */}
          <div className="p-6 rounded-3xl bg-stone-900 text-stone-100 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Data Isolation
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                Active & Enforced
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold font-['Plus_Jakarta_Sans']">
                Isolated Firestore Storage
              </h3>
              <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                Your entries live strictly at <code className="bg-stone-800 text-amber-300 px-1 py-0.5 rounded text-[11px]">/users/{userProfile.uid.slice(0, 8)}...</code>. Firestore Security Rules prevent other users from accessing your records.
              </p>
            </div>

            <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
              <div className="text-xs text-stone-400 flex items-center gap-1.5">
                {userProfile.e2eeEnabled ? (
                  isEncryptedUnlocked ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> E2EE Unlocked
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> E2EE Vault Locked
                    </span>
                  )
                ) : (
                  <span>Optional AES-256 Vault</span>
                )}
              </div>

              <button
                onClick={onOpenEncryptionSettings}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                {userProfile.e2eeEnabled ? "Vault Settings" : "Enable E2EE"}
              </button>
            </div>
          </div>

          {/* Quick Streak Info */}
          <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans'] flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-600" />
                Journaling Consistency
              </h3>
              <button
                onClick={() => onNavigate("analytics")}
                className="text-xs text-stone-500 hover:text-stone-800 font-medium"
              >
                View Stats &rarr;
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-3xl font-black text-amber-600 font-['Plus_Jakarta_Sans']">
                {currentStreak}
              </div>
              <div className="text-xs text-stone-600">
                <p className="font-semibold text-stone-900">Consecutive Reflection Days</p>
                <p className="text-stone-400">Journal daily to build emotional clarity.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
