export type MoodType =
  | "radiant"
  | "joyful"
  | "calm"
  | "reflective"
  | "anxious"
  | "down"
  | "frustrated";

export interface MoodMeta {
  type: MoodType;
  label: string;
  emoji: string;
  color: string;
  bgClass: string;
  borderClass: string;
  score: number;
}

export type AIServiceMode = "reflect" | "summarize" | "brainstorm" | "coaching";

export interface JournalMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export interface ReflectionDoc {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  mood: MoodType;
  moodScore: number;
  tags: string[];
  isEncrypted: boolean;
  encryptedData?: string;
  iv?: string;
  // Decrypted fields in memory
  messages: JournalMessage[];
  summary?: string;
  actionItems?: string[];
  keyEmotions?: string[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  currentStreak: number;
  longestStreak: number;
  lastJournalDate?: string; // YYYY-MM-DD
  totalEntries: number;
  e2eeEnabled: boolean;
  salt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreakMilestone {
  days: number;
  title: string;
  description: string;
  icon: string;
  badgeColor: string;
  unlocked: boolean;
}

export type AppView = "dashboard" | "new_journal" | "history" | "analytics";

export type TextRefineMode = "auto_correct" | "fix_grammar_spelling" | "polish_flow" | "punctuate_speech";

export interface RefineCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface RefineResult {
  refinedText: string;
  corrections: RefineCorrection[];
  changeSummary: string;
  originalText: string;
  modelUsed?: string;
}

