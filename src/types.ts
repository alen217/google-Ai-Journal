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

