import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  auth, 
  signInWithGoogle, 
  signOut, 
  getOrCreateUserProfile, 
  fetchUserReflections 
} from "./lib/firebase";
import { 
  getSessionPasskey, 
  deriveKeyFromPassphrase 
} from "./lib/encryption";
import { STREAK_MILESTONES } from "./lib/constants";
import { 
  AppView, 
  UserProfile, 
  ReflectionDoc, 
  StreakMilestone, 
  MoodType 
} from "./types";
import { Navbar } from "./components/Navbar";
import { AuthLanding } from "./components/AuthLanding";
import { Dashboard } from "./components/Dashboard";
import { JournalEditor } from "./components/JournalEditor";
import { HistoryView } from "./components/HistoryView";
import { MoodAnalytics } from "./components/MoodAnalytics";
import { InsightsDashboard } from "./components/InsightsDashboard";
import { EncryptionModal } from "./components/EncryptionModal";
import { MilestoneModal } from "./components/MilestoneModal";

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // App navigation state
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [activeEditingDoc, setActiveEditingDoc] = useState<ReflectionDoc | null>(null);
  const [preloadedPrompt, setPreloadedPrompt] = useState<string | null>(null);

  // Data state
  const [reflections, setReflections] = useState<ReflectionDoc[]>([]);
  const [isLoadingReflections, setIsLoadingReflections] = useState(false);

  // Encryption state
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isEncryptionModalOpen, setIsEncryptionModalOpen] = useState(false);

  // Celebration modal state
  const [unlockedMilestone, setUnlockedMilestone] = useState<StreakMilestone | null>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(true);
      setCurrentUser(user);

      if (user) {
        try {
          // Load or initialize user profile from Firestore
          const profile = await getOrCreateUserProfile(user);
          setUserProfile(profile);

          // Auto-derive key if passkey is in session
          const sessionPass = getSessionPasskey();
          if (profile.e2eeEnabled && profile.salt && sessionPass) {
            try {
              const derived = await deriveKeyFromPassphrase(sessionPass, profile.salt);
              setEncryptionKey(derived);
            } catch (err) {
              console.warn("Session passkey derivation notice:", err);
            }
          }

          // Load user's reflections
          await loadReflections(user.uid);
        } catch (err: any) {
          console.error("Profile load error:", err);
          setAuthError(err?.message || "Failed to load user profile.");
        }
      } else {
        setUserProfile(null);
        setReflections([]);
        setEncryptionKey(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch reflections from Firestore
  const loadReflections = async (uid: string) => {
    setIsLoadingReflections(true);
    try {
      const list = await fetchUserReflections(uid);
      setReflections(list);
    } catch (err) {
      console.error("Reflections fetch error:", err);
    } finally {
      setIsLoadingReflections(false);
    }
  };

  // Google Sign-In Handler
  const handleSignIn = async () => {
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign-in error:", err);
      // Friendly message for popup closed or blocked
      if (err?.code === "auth/popup-closed-by-user") {
        setAuthError("Sign-in popup closed before completion. Please try again.");
      } else if (err?.code === "auth/cancelled-popup-request") {
        setAuthError("Authentication request cancelled.");
      } else {
        setAuthError(err?.message || "Failed to sign in with Google.");
      }
      setIsAuthLoading(false);
    }
  };

  // Sign-Out Handler
  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentView("dashboard");
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  // Start a new reflection
  const handleStartNewReflection = (starterPrompt?: string, mood?: MoodType) => {
    if (starterPrompt || mood) {
      setActiveEditingDoc({
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userProfile?.uid || "",
        title: "",
        date: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mood: mood || "reflective",
        moodScore: 3.5,
        tags: ["Personal Growth"],
        isEncrypted: Boolean(userProfile?.e2eeEnabled),
        messages: starterPrompt
          ? [
              {
                id: `msg_init_${Date.now()}`,
                role: "user",
                content: starterPrompt,
                timestamp: new Date().toISOString(),
              },
            ]
          : [],
      });
    } else {
      setActiveEditingDoc(null);
    }
    setCurrentView("new_journal");
  };

  // Open existing reflection in editor
  const handleOpenReflection = (doc: ReflectionDoc) => {
    setActiveEditingDoc(doc);
    setCurrentView("new_journal");
  };

  // Reflection saved callback
  const handleReflectionSaved = (
    savedDoc: ReflectionDoc,
    updatedProfile: UserProfile,
    streakIncremented: boolean
  ) => {
    setUserProfile(updatedProfile);

    // Update local reflections list
    setReflections((prev) => {
      const idx = prev.findIndex((r) => r.id === savedDoc.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedDoc;
        return next;
      }
      return [savedDoc, ...prev];
    });

    // Check if streak reached a milestone
    if (streakIncremented && updatedProfile.currentStreak) {
      const milestone = STREAK_MILESTONES.find(
        (m) => m.days === updatedProfile.currentStreak
      );
      if (milestone) {
        setUnlockedMilestone(milestone);
      }
    }
  };

  // Reflection deleted callback
  const handleDeleteReflection = (id: string) => {
    setReflections((prev) => prev.filter((r) => r.id !== id));
  };

  // Encryption key unlocked callback
  const handleKeyUnlocked = (key: CryptoKey) => {
    setEncryptionKey(key);
  };

  // Show loading indicator while resolving auth
  if (isAuthLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-md animate-pulse">
          <span className="text-xl">✨</span>
        </div>
        <p className="text-sm font-semibold text-stone-600 font-['Plus_Jakarta_Sans']">
          Connecting to ReflectAI secure session...
        </p>
      </div>
    );
  }

  // Not authenticated: render Landing View
  if (!currentUser || !userProfile) {
    return (
      <AuthLanding
        onSignIn={handleSignIn}
        isLoading={isAuthLoading}
        errorMessage={authError}
      />
    );
  }

  // Authenticated: Render Main App
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col selection:bg-amber-200">
      
      {/* Top Header */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        userProfile={userProfile}
        onSignOut={handleSignOut}
        onOpenEncryptionSettings={() => setIsEncryptionModalOpen(true)}
        isEncryptedUnlocked={Boolean(encryptionKey)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentView === "dashboard" && (
          <Dashboard
            userProfile={userProfile}
            reflections={reflections}
            onStartNewReflection={handleStartNewReflection}
            onOpenReflection={handleOpenReflection}
            onNavigate={setCurrentView}
            onOpenEncryptionSettings={() => setIsEncryptionModalOpen(true)}
            isEncryptedUnlocked={Boolean(encryptionKey)}
            onReflectionSaved={handleReflectionSaved}
            encryptionKey={encryptionKey}
          />
        )}

        {currentView === "new_journal" && (
          <JournalEditor
            initialDoc={activeEditingDoc}
            userProfile={userProfile}
            encryptionKey={encryptionKey}
            onBack={() => setCurrentView("dashboard")}
            onSaved={handleReflectionSaved}
            onOpenEncryptionSettings={() => setIsEncryptionModalOpen(true)}
          />
        )}

        {currentView === "history" && (
          <HistoryView
            reflections={reflections}
            userProfile={userProfile}
            encryptionKey={encryptionKey}
            onOpenReflection={handleOpenReflection}
            onDeleteReflection={handleDeleteReflection}
            onOpenEncryptionSettings={() => setIsEncryptionModalOpen(true)}
          />
        )}

        {currentView === "analytics" && (
          <MoodAnalytics
            reflections={reflections}
            userProfile={userProfile}
          />
        )}

        {currentView === "insights" && (
          <InsightsDashboard
            userProfile={userProfile}
            reflections={reflections}
            onStartNewJournalWithPrompt={(promptText) => {
              handleStartNewReflection(promptText);
              setCurrentView("new_journal");
            }}
            onNavigateToHistory={() => setCurrentView("history")}
          />
        )}
      </main>

      {/* Encryption Settings & Unlock Modal */}
      <EncryptionModal
        isOpen={isEncryptionModalOpen}
        onClose={() => setIsEncryptionModalOpen(false)}
        userProfile={userProfile}
        onKeyUnlocked={handleKeyUnlocked}
        onProfileUpdated={setUserProfile}
        isUnlocked={Boolean(encryptionKey)}
      />

      {/* Streak Milestone Celebration Modal */}
      <MilestoneModal
        milestone={unlockedMilestone}
        onClose={() => setUnlockedMilestone(null)}
      />

    </div>
  );
}
