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
  | "grid_graph"
  | "kraft_paper"
  | "soft_rose"
  | "vintage_parchment"
  | "midnight_journal"
  | "sage_meadow"
  | "stained_aged"
  | "watercolor_blush"
  | "retro_film";

export type JournalFontFamily =
  | "Newsreader"
  | "Kalam"
  | "Caveat"
  | "Courier Prime"
  | "Plus Jakarta Sans"
  | "Playfair Display";

export type ScrapbookElementType = "text" | "image" | "sticker" | "tape" | "ai_card" | "stamp" | "quote_card" | "badge";

export interface ScrapbookElement {
  id: string;
  type: ScrapbookElementType;
  x: number;             // X position (px or % of canvas)
  y: number;             // Y position (px or % of canvas)
  width: number;          // width in px
  height: number;         // height in px
  rotation: number;       // degrees (-180 to 180)
  zIndex: number;         // layer
  locked?: boolean;       // prevent accidental drags
  // Content
  content?: string;       // Text content or sticker symbol
  imageUrl?: string;      // Image data URL or source
  caption?: string;       // Polaroid caption
  // Stamp specific
  stampText?: string;
  stampColor?: string;
  stampVariant?: "circle" | "rect" | "badge";
  // Card specific
  cardVariant?: "sticky" | "quote" | "torn" | "pinned" | "highlight";
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
  style?: Record<string, any>;
}

export interface AIDesignSuggestion {
  templateId: string;
  themeName: string;
  paperStyle: PaperStyle;
  primaryFont: JournalFontFamily;
  suggestedMood: MoodType;
  accentColor: string;
  designRationale: string;
  stickers: string[];
  washiTapeBg: string;
}

export interface ScrapbookLayout {
  templateId?: string;
  paperStyle: PaperStyle;
  paperColor?: string;
  elements: ScrapbookElement[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface PrivacyAISettings {
  aiAnalysisEnabled: boolean;       // Master toggle: Analyze my journal with AI
  smartTaskDetection: boolean;      // Smart task detection
  aiSummaries: boolean;             // AI summaries
  weeklyInsights: boolean;          // Weekly insights
  journalSearch: boolean;           // Journal search
  moodSentimentInsights: boolean;   // Mood/sentiment insights
  futureSelfSuggestions: boolean;   // Future Self suggestions
  lifeGraphEnabled: boolean;        // Interconnected knowledge graph
  aiScrapbookEnabled: boolean;      // Visual memory scrapbook generation
}

export const DEFAULT_PRIVACY_AI_SETTINGS: PrivacyAISettings = {
  aiAnalysisEnabled: true,
  smartTaskDetection: true,
  aiSummaries: true,
  weeklyInsights: true,
  journalSearch: true,
  moodSentimentInsights: true,
  futureSelfSuggestions: true,
  lifeGraphEnabled: true,
  aiScrapbookEnabled: true,
};

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
  privacyAISettings?: PrivacyAISettings;
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

export type AppView =
  | "dashboard"
  | "new_journal"
  | "history"
  | "analytics"
  | "insights"
  | "unfinished"
  | "privacy"
  | "scrapbook"
  | "lifegraph";

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

export type ObjectivePriority = "low" | "medium" | "high";
export type ObjectiveStatus = "not_started" | "in_progress" | "completed";

export interface ObjectiveReminder {
  date?: string;
  time?: string;
  enabled: boolean;
  notes?: string;
}

export interface ObjectiveItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  deadline?: string; // YYYY-MM-DD
  priority: ObjectivePriority;
  progress: number; // 0 to 100
  status: ObjectiveStatus;
  reminder?: ObjectiveReminder;
  sourceReflectionId?: string;
  sourceReflectionTitle?: string;
  sourceSentence?: string; // Snippet to highlight in original journal entry
  isWaiting?: boolean; // Waiting on external person or action
  waitingOn?: string; // Who or what it is waiting for
  snoozedUntil?: string; // ISO date YYYY-MM-DD if snoozed
  createdAt: string;
  updatedAt: string;
}

export interface ReminderItem {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  status: "pending" | "completed" | "dismissed";
  sourceReflectionId?: string;
  sourceReflectionTitle?: string;
  sourceObjectiveId?: string;
  sourceSentence?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActionCategory =
  | "task"
  | "deadline"
  | "commitment"
  | "meeting"
  | "appointment"
  | "event"
  | "goal"
  | "submission"
  | "follow_up"
  | "waiting";

export interface DetectedActionItem {
  id: string;
  title: string;
  category: ActionCategory;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  relativeDateText?: string; // e.g. "tomorrow", "Monday"
  isAmbiguousDate?: boolean;
  clarificationPrompt?: string;
  suggestedType: "reminder" | "calendar" | "objective";
  suggestedReminder?: string;
  confidenceReason?: string;
  priority?: ObjectivePriority;
  sourceSentence?: string;
  isWaiting?: boolean;
  waitingOn?: string;
  dismissed?: boolean;
  isDuplicate?: boolean;
  savedAsObjectiveId?: string;
  savedAsReminderId?: string;
  savedAsCalendarId?: string;
}

export interface FutureNote {
  id: string;
  userId: string;
  message: string;
  targetDate?: string; // YYYY-MM-DD or empty for someday
  sourceReflectionId?: string;
  sourceReflectionTitle?: string;
  sourceSentence?: string;
  status: "pending" | "delivered" | "read" | "archived";
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItemExtractionResult {
  detectedItems: DetectedActionItem[];
  rationale: string;
  modelUsed?: string;
}

// -------------------------------------------------------------
// 1. AI SCRAPBOOK TYPES & DATA MODELS
// -------------------------------------------------------------

export type ScrapbookTemplateId =
  | "classic"
  | "photo_story"
  | "travel"
  | "achievement"
  | "personal"
  | "celebration"
  | "idea_board"
  | "project_diary";

export type MemoryCategory = "travel" | "achievement" | "personal" | "celebration" | "general";

export interface ScrapbookMemoryMetadata {
  mainEvent?: string;
  date?: string;
  location?: string;
  peopleMentioned?: string[];
  importantMoments?: string[];
  mood?: string;
  keyQuotes?: string[];
  photos?: string[];
  activities?: string[];
  highlights?: string[];
  whatILearned?: string;
  progressPercent?: number;
  favoriteMoment?: string;
  relatedReflectionIds?: string[];
}

export interface ScrapbookSuggestion {
  id: string;
  type: "add_moment" | "collage" | "add_location" | "add_quote" | "connect_graph";
  label: string;
  description: string;
  applied: boolean;
  element?: Partial<ScrapbookElement>;
}

export interface ScrapbookDoc {
  id: string;
  userId: string;
  sourceReflectionId: string;
  sourceReflectionTitle?: string;
  title: string;
  date: string;
  template: ScrapbookTemplateId;
  memoryType: MemoryCategory;
  paperStyle: PaperStyle;
  paperColor?: string;
  elements: ScrapbookElement[];
  metadata: ScrapbookMemoryMetadata;
  lifeGraphNodeIds: string[];
  aiSuggestions: ScrapbookSuggestion[];
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// 2. LIFE GRAPH TYPES & DATA MODELS
// -------------------------------------------------------------

export type LifeGraphEntityType =
  | "project"
  | "person"
  | "place"
  | "goal"
  | "objective"
  | "event"
  | "topic"
  | "hobby"
  | "idea"
  | "achievement"
  | "memory";

export interface EvolutionMilestone {
  date: string;
  monthLabel?: string;
  stage: string;
  note: string;
  event?: string;
  reflectionId?: string;
  reflectionTitle?: string;
}

export interface LifeGraphEntity {
  id: string;
  userId: string;
  name: string;
  type: LifeGraphEntityType;
  description?: string;
  firstMentionedDate: string;
  lastMentionedDate: string;
  reflectionIds: string[];
  objectiveIds?: string[];
  relatedPeople?: string[];
  relatedTopics?: string[];
  evolutionTimeline?: EvolutionMilestone[];
  stats: {
    entryCount: number;
    totalOccurrences?: number;
    objectiveCount?: number;
    completedObjectives?: number;
    peopleCount?: number;
  };
  color?: string;
  userEdited?: boolean;
  isUserHidden?: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LifeGraphRelationship {
  id: string;
  userId: string;
  sourceEntityId: string;
  targetEntityId: string;
  label: string;
  type: "inferred" | "verified";
  strength: number; // 1 to 5
  reflectionIds: string[];
  createdAt: string;
}

export interface DiscoveredConnection {
  id: string;
  title: string;
  description: string;
  entityIds: string[];
  entityNames: string[];
  reflectionIds: string[];
  insightType: "pattern" | "journey" | "frequency" | "collaboration";
  date: string;
}

export interface LifeGraphSearchResult {
  query: string;
  answer: string;
  matchingEntityIds: string[];
  matchingReflectionIds: string[];
  citations: { reflectionId: string; title: string; excerpt: string }[];
  suggestedNodes: string[];
}

export type LifeGraphQueryResult = LifeGraphSearchResult;

