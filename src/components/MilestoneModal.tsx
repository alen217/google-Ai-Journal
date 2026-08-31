import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { StreakMilestone } from "../types";
import { Award, Sparkles, X, Check } from "lucide-react";

interface MilestoneModalProps {
  milestone: StreakMilestone | null;
  onClose: () => void;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  milestone,
  onClose,
}) => {
  useEffect(() => {
    if (milestone) {
      // Fire confetti bursts!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
          });
        }, 250);
      } catch (e) {
        console.warn("Confetti effect note:", e);
      }
    }
  }, [milestone]);

  if (!milestone) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-200 text-center">
        
        {/* Close Button */}
        <button
          id="milestone-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Milestone Badge Graphic */}
        <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 animate-ping opacity-25" />
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-tr ${milestone.badgeColor} flex items-center justify-center text-4xl shadow-lg border-2 border-white`}>
            {milestone.icon}
          </div>
        </div>

        {/* Header */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Milestone Unlocked!
        </div>

        <h3 className="text-2xl font-bold text-stone-900 font-['Newsreader'] italic">
          {milestone.title}
        </h3>

        <p className="mt-1 text-sm font-semibold text-amber-700">
          {milestone.days}-Day Journaling Streak Achieved
        </p>

        <p className="mt-3 text-sm text-stone-600 leading-relaxed font-['Plus_Jakarta_Sans']">
          {milestone.description}
        </p>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-stone-100 flex justify-center">
          <button
            id="milestone-continue-btn"
            onClick={onClose}
            className="w-full py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Keep the Momentum Going
          </button>
        </div>

      </div>
    </div>
  );
};
