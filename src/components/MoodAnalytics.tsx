import React from "react";
import { ReflectionDoc, UserProfile, MoodType } from "../types";
import { MOODS, STREAK_MILESTONES } from "../lib/constants";
import { 
  Flame, 
  Smile, 
  Award, 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  Lock, 
  Sparkles,
  BarChart2
} from "lucide-react";

interface MoodAnalyticsProps {
  reflections: ReflectionDoc[];
  userProfile: UserProfile;
}

export const MoodAnalytics: React.FC<MoodAnalyticsProps> = ({
  reflections,
  userProfile,
}) => {
  // Compute mood distribution
  const moodCounts: Record<MoodType, number> = {
    radiant: 0,
    joyful: 0,
    calm: 0,
    reflective: 0,
    anxious: 0,
    down: 0,
    frustrated: 0,
  };

  let totalScore = 0;
  let scoreCount = 0;

  reflections.forEach((r) => {
    if (r.mood && moodCounts[r.mood] !== undefined) {
      moodCounts[r.mood] += 1;
    }
    if (r.moodScore) {
      totalScore += r.moodScore;
      scoreCount += 1;
    }
  });

  const totalEntries = reflections.length;
  const avgMoodScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : "N/A";

  // Compute tag breakdown
  const tagCounts: Record<string, number> = {};
  reflections.forEach((r) => {
    (r.tags || []).forEach((t) => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Compute 30-day streak timeline
  const last30Days: { dateStr: string; dayNum: number; active: boolean; mood?: MoodType }[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayNum = d.getDate();
    const matchingDoc = reflections.find((r) => r.date === dateStr);

    last30Days.push({
      dateStr,
      dayNum,
      active: Boolean(matchingDoc),
      mood: matchingDoc?.mood,
    });
  }

  // Next milestone calculation
  const currentStreak = userProfile.currentStreak || 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m.days > currentStreak) || null;
  const prevMilestoneDays = STREAK_MILESTONES.filter((m) => m.days <= currentStreak).pop()?.days || 0;
  
  const milestoneProgress = nextMilestone
    ? Math.min(
        100,
        Math.round(
          ((currentStreak - prevMilestoneDays) / (nextMilestone.days - prevMilestoneDays)) * 100
        )
      )
    : 100;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Emotional Trends & Streak Milestones
        </div>
        <h2 className="text-3xl font-bold text-stone-900 font-['Newsreader'] italic">
          Your Mindful Journaling Insights
        </h2>
        <p className="text-sm text-stone-600 font-['Plus_Jakarta_Sans']">
          Understand your emotional rhythms, celebrate consistency, and cultivate self-awareness.
        </p>
      </div>

      {/* Top Stat Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Stat 1: Current Streak */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 text-stone-950 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-950/80">
              Current Streak
            </span>
            <Flame className="w-6 h-6 fill-stone-950 text-stone-950 animate-pulse" />
          </div>
          <div className="text-4xl font-black font-['Plus_Jakarta_Sans']">
            {userProfile.currentStreak || 0} <span className="text-lg font-bold">Days</span>
          </div>
          <p className="text-xs font-medium text-amber-950/90 mt-2">
            Personal Best: <strong>{userProfile.longestStreak || 0} consecutive days</strong>
          </p>
        </div>

        {/* Stat 2: Total Reflections */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Total Reflections
            </span>
            <Calendar className="w-6 h-6 text-stone-400" />
          </div>
          <div className="text-4xl font-black text-stone-900 font-['Plus_Jakarta_Sans']">
            {totalEntries}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Persisted securely in Firestore
          </p>
        </div>

        {/* Stat 3: Average Emotional Vitality */}
        <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Emotional Vitality
            </span>
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="text-4xl font-black text-stone-900 font-['Plus_Jakarta_Sans']">
            {avgMoodScore} <span className="text-lg text-stone-400 font-normal">/ 5.0</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Weighted across recorded journal entries
          </p>
        </div>

      </div>

      {/* Next Milestone Tracker */}
      <div className="p-6 rounded-3xl bg-stone-900 text-stone-100 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Streak Milestone Progression
            </span>
            <h3 className="text-xl font-bold font-['Plus_Jakarta_Sans'] mt-0.5">
              {nextMilestone ? `Target: ${nextMilestone.title} (${nextMilestone.days} Days)` : "All Milestones Achieved!"}
            </h3>
          </div>
          <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-stone-800 border border-stone-700 text-amber-300">
            {nextMilestone ? `${nextMilestone.days - currentStreak} days remaining` : "Master Badge Unlocked 👑"}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-stone-800 rounded-full h-3.5 p-0.5 overflow-hidden border border-stone-700">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-700"
            style={{ width: `${milestoneProgress}%` }}
          />
        </div>
      </div>

      {/* 30-Day Activity Heatmap */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            30-Day Reflection Consistency Map
          </h3>
          <span className="text-xs text-stone-500 font-medium">Last 30 Days</span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 gap-2 pt-2">
          {last30Days.map((item, idx) => {
            const moodMeta = item.mood ? MOODS[item.mood] : null;
            return (
              <div
                key={idx}
                title={`${item.dateStr}: ${item.active ? `Journaled (${moodMeta?.label || "Reflected"})` : "No reflection"}`}
                className={`h-10 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 cursor-pointer border ${
                  item.active
                    ? `${moodMeta?.bgClass || "bg-amber-100 text-amber-950"} border-amber-300 shadow-2xs`
                    : "bg-stone-100 text-stone-400 border-stone-200"
                }`}
              >
                <span>{item.dayNum}</span>
                {item.active && <span className="text-[10px]">{moodMeta?.emoji || "✨"}</span>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 text-xs text-stone-500 border-t border-stone-100">
          <span>Older</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-stone-100 border border-stone-200 inline-block"></span>
              <span>Inactive</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
              <span>Reflected</span>
            </div>
          </div>
          <span>Today</span>
        </div>
      </div>

      {/* Mood Distribution & Tag Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Mood Distribution */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <Smile className="w-5 h-5 text-amber-600" />
            Emotional Spectrum Distribution
          </h3>

          {totalEntries === 0 ? (
            <p className="text-xs text-stone-400 py-6 text-center">
              No entries recorded yet. Create your first reflection to see emotional trends!
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              {(Object.keys(MOODS) as MoodType[]).map((moodKey) => {
                const mood = MOODS[moodKey];
                const count = moodCounts[moodKey];
                const percentage = totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0;

                return (
                  <div key={moodKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                      <span className="flex items-center gap-1.5">
                        <span>{mood.emoji}</span>
                        <span>{mood.label}</span>
                      </span>
                      <span className="text-stone-500">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: mood.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thematic Life Tags Breakdown */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            Top Reflection Focus Areas
          </h3>

          {sortedTags.length === 0 ? (
            <p className="text-xs text-stone-400 py-6 text-center">
              Add theme tags (Gratitude, Personal Growth, etc.) to your reflections to track focus areas.
            </p>
          ) : (
            <div className="space-y-4 pt-2">
              {sortedTags.map(([tag, count], idx) => {
                const maxCount = sortedTags[0][1] || 1;
                const widthPercent = Math.round((count / maxCount) * 100);
                return (
                  <div key={tag} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-800">
                      <span>{tag}</span>
                      <span className="text-stone-500">{count} entries</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Milestone Badges Gallery */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
        <div>
          <h3 className="text-xl font-bold text-stone-900 font-['Plus_Jakarta_Sans'] flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            Milestone Badges & Trophies
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Build a consistent daily journaling ritual to unlock all milestone achievements.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STREAK_MILESTONES.map((badge) => {
            const isUnlocked = currentStreak >= badge.days || (userProfile.longestStreak || 0) >= badge.days;
            return (
              <div
                key={badge.days}
                className={`p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                  isUnlocked
                    ? "bg-stone-50 border-amber-300 shadow-sm"
                    : "bg-stone-50/50 border-stone-200 opacity-60"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm ${
                    isUnlocked
                      ? `bg-gradient-to-tr ${badge.badgeColor} text-white`
                      : "bg-stone-200 text-stone-400"
                  }`}
                >
                  {badge.icon}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
                      {badge.title}
                    </h4>
                    {isUnlocked ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {badge.days} Days
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
