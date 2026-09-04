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
  // Creative Scrapbook / Journal Page Layout
  scrapbook?: ScrapbookLayout;
}

export type PaperStyle = 
  | "cream_linen"
  | "ruled_notebook"
  | "dot_grid"
  | "kraft_paper"
  | "soft_rose"
  | "vintage_parchment"
  | "midnight_journal"
  | "sage_meadow";

export type JournalFontFamily =
  | "Newsreader"
  | "Kalam"
  | "Caveat"
  | "Courier Prime"
  | "Plus Jakarta Sans"
  | "Playfair Display";

export type ScrapbookElementType = "text" | "image" | "sticker" | "tape" | "ai_card";

export interface ScrapbookElement {
  id: string;
  type: ScrapbookElementType;
  x: number;             // X position (px or % of canvas)
  y: number;             // Y position (px or % of canvas)
  width: number;          // width in px
  height: number;         // height in px
  rotation: number;       // degrees (-180 to 180)
  zIndex: number;         // layer
  // Content
  content?: string;       // Text content or sticker symbol
  imageUrl?: string;      // Image data URL or source
  caption?: string;       // Polaroid caption
  // Typography & Styling
  fontFamily?: JournalFontFamily;
  fontSize?: number;      // px
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  textAlign?: "left" | "center" | "right";
  color?: string;         // Text color
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  photoStyle?: "polaroid" | "tape" | "pin" | "border" | "clean";
  tapeColor?: string;
  opacity?: number;
}

export interface ScrapbookLayout {
  templateId?: string;
  paperStyle: PaperStyle;
  paperColor?: string;
  elements: ScrapbookElement[];
  canvasWidth: number;
  canvasHeight: number;
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

export type AppView = "dashboard" | "new_journal" | "history" | "analytics" | "insights";

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

export type CalendarItemType = "event" | "task" | "reminder";
export type CalendarItemCategory = 
  | "event" 
  | "task" 
  | "deadline" 
  | "appointment" 
  | "meeting" 
  | "exam" 
  | "birthday" 
  | "anniversary" 
  | "travel" 
  | "goal" 
  | "follow_up";

export interface DetectedCalendarItem {
  id: string;
  title: string;
  type: CalendarItemType;
  category: CalendarItemCategory;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm or null
  description?: string;
  relativeDateText?: string;
  isAmbiguousDate?: boolean;
  clarificationPrompt?: string;
  suggestedReminder?: string;
  reminderMinutesBefore?: number; // e.g. 30, 1440 (1 day), 2880 (2 days)
  sourceReflectionId?: string;
  sourceReflectionTitle?: string;
  selected?: boolean;
  status?: "suggested" | "confirmed" | "cancelled";
  createdAt?: string;
}

export interface EntryAnalysisResult {
  id: string;
  reflectionId: string;
  userId: string;
  createdAt: string;
  detectedEvents: DetectedCalendarItem[];
  detectedTasks: DetectedCalendarItem[];
  detectedDates: Array<{ label: string; date: string; context: string }>;
  suggestedReminders: Array<{ reminder: string; targetDate?: string; targetItemTitle?: string }>;
  insightsSummary?: string;
}

export interface WeeklyReflectionStructure {
  majorEvents: string[];
  importantExperiences: string[];
  accomplishments: string[];
  challenges: string[];
  unfinishedTasks: string[];
  upcomingCommitments: string[];
  goalsMentioned: string[];
  significantChanges: string[];
}

export interface PeriodPattern {
  title: string;
  observation: string;
  category?: string;
}

export interface WeeklyAnalysisResult {
  id: string;
  userId: string;
  weekIdentifier: string; // e.g. "2026-W36"
  startDate: string;
  endDate: string;
  entryCount: number;
  accomplishmentCount: number;
  taskCount: number;
  upcomingEventCount: number;
  patternCount: number;
  createdAt: string;
  reflection: WeeklyReflectionStructure;
  patterns: PeriodPattern[];
  moodOverview?: string | null;
  accomplishments: string[];
  unfinishedItems: string[];
  upcomingEvents: DetectedCalendarItem[];
  comparison?: {
    hasComparisonData: boolean;
    summaryPoints: string[];
  };
  oneParagraphSummary: string;
}

export interface MonthInReviewStructure {
  majorEvents: string[];
  majorAccomplishments: string[];
  challenges: string[];
  importantDecisions: string[];
  memorableMoments: string[];
  goalsAchieved: string[];
  goalsInProgress: string[];
}

export interface MonthlyProgressItem {
  goal: string;
  progressStage: string;
  details: string;
}

export interface MonthlyAnalysisResult {
  id: string;
  userId: string;
  monthIdentifier: string; // e.g. "2026-09"
  monthName: string; // e.g. "September 2026"
  startDate: string;
  endDate: string;
  entryCount: number;
  majorEventCount: number;
  accomplishmentCount: number;
  unfinishedTaskCount: number;
  upcomingEventCount: number;
  recurringThemeCount: number;
  createdAt: string;
  monthInReview: MonthInReviewStructure;
  personalPatterns: Array<{ theme: string; details: string }>;
  progressTracking: MonthlyProgressItem[];
  importantDates: DetectedCalendarItem[];
  reflectionQuestions: Array<{ question: string; contextPrompt: string }>;
  comparison?: {
    hasComparisonData: boolean;
    summaryPoints: string[];
  };
  oneParagraphSummary: string;
}

export interface CalendarAssistantSettings {
  allowAIJournalAnalysis: boolean;
  allowCalendarSuggestions: boolean;
  allowEmotionalAnalysis: boolean;
}

export interface SavedCalendarEvent {
  id: string;
  userId: string;
  title: string;
  type: CalendarItemType;
  date: string;
  time?: string;
  description?: string;
  reminderMinutesBefore?: number;
  sourceReflectionId?: string;
  status: "confirmed" | "synced";
  createdAt: string;
}

