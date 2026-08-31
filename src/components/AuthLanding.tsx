import React from "react";
import { Sparkles, Shield, Lock, Brain, Flame, CheckCircle, Database } from "lucide-react";

interface AuthLandingProps {
  onSignIn: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const AuthLanding: React.FC<AuthLandingProps> = ({
  onSignIn,
  isLoading,
  errorMessage,
}) => {
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between selection:bg-amber-200">
      
      {/* Top Header */}
      <header className="border-b border-stone-200/80 bg-stone-50/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-stone-950 font-bold shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-stone-900 font-['Plus_Jakarta_Sans']">
              ReflectAI
            </span>
          </div>

          <button
            id="landing-signin-nav-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-100 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-amber-400 border-t-transparent"></span>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            Sign In with Google
          </button>
        </div>
      </header>

      {/* Main Hero & Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Powered by Gemini 3.6 Flash & Cloud Firestore
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 max-w-3xl leading-[1.15] font-['Newsreader'] italic">
          A deeply private space for your authentic thoughts, guided by AI.
        </h1>

        <p className="mt-5 text-lg sm:text-xl text-stone-600 max-w-2xl font-['Plus_Jakarta_Sans'] leading-relaxed">
          Reflect on your day, explore challenges with multi-turn AI reflections, track emotional trends, and keep every word strictly private with isolated Cloud Firestore storage and optional client-side encryption.
        </p>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm max-w-md text-left flex items-start gap-3">
            <Shield className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Authentication notice</p>
              <p className="text-xs mt-1 text-rose-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Primary CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="hero-signin-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-4 text-base font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-stone-950 border-t-transparent"></span>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google Sign-In</span>
          </button>
        </div>

        <p className="mt-3 text-xs text-stone-500 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          Zero password storage &bull; Federated Auth &bull; 100% User-Isolated Data
        </p>

        {/* Feature Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-sm hover:border-amber-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-4">
              <Brain className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
              Multi-Turn Gemini AI Reflections
            </h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Have dynamic conversations with Gemini 3.6 Flash. Brainstorm solutions, generate structured takeaways, and gain empathetic perspectives on your personal thoughts.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-sm hover:border-emerald-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
              Isolated Firestore & E2EE
            </h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Every journal entry is strictly scoped under your personal user ID (<code className="text-xs bg-stone-100 px-1 py-0.5 rounded">/users/&#123;uid&#125;</code>) with optional AES-GCM 256-bit client-side encryption.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-sm hover:border-indigo-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center mb-4">
              <Flame className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 font-['Plus_Jakarta_Sans']">
              Mood Trends & Daily Streaks
            </h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Track emotional health over time with visual mood distribution charts, keep daily journaling streaks, and unlock rewarding milestone badges.
            </p>
          </div>

        </div>

        {/* Security Checklist */}
        <div className="mt-12 p-6 rounded-2xl bg-stone-200/40 border border-stone-200 max-w-2xl w-full text-left">
          <h2 className="text-sm font-semibold text-stone-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            Security & Privacy Architecture
          </h2>
          <ul className="space-y-2 text-xs text-stone-700">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Owner-Bound Security Rules:</strong> No user can read or query entries belonging to another account.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Zero Hardcoded Credentials:</strong> Gemini API keys are processed server-side with fallback resilience.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Client-Side Web Crypto API:</strong> Optional passkey derives 256-bit AES-GCM keys directly in your browser.</span>
            </li>
          </ul>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500 bg-stone-50">
        <p>ReflectAI &bull; Cloud Run & Firestore Deployment &bull; Built with Google AI Studio</p>
      </footer>
    </div>
  );
};
