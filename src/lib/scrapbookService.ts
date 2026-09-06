import {
  ScrapbookDoc,
  ScrapbookElement,
  ScrapbookTemplateId,
  MemoryCategory,
  ReflectionDoc,
  ScrapbookMemoryMetadata,
  ScrapbookSuggestion,
  PaperStyle,
} from "../types";

// Available templates metadata
export interface TemplateInfo {
  id: ScrapbookTemplateId;
  name: string;
  emoji: string;
  description: string;
  category: MemoryCategory;
  defaultPaper: PaperStyle;
}

export const SCRAPBOOK_TEMPLATES: TemplateInfo[] = [
  {
    id: "classic",
    name: "Classic Journal",
    emoji: "📖",
    description: "Refined, timeless aesthetic with elegant serif typography and gentle parchment texture.",
    category: "general",
    defaultPaper: "cream_linen",
  },
  {
    id: "photo_story",
    name: "Photo Story",
    emoji: "📸",
    description: "Visual mosaic highlighting polaroid frames, stamps, and vivid captions.",
    category: "general",
    defaultPaper: "dot_grid",
  },
  {
    id: "travel",
    name: "Travel Memory",
    emoji: "✈️",
    description: "Large hero photo, location badge, route notes, and favorite highlights.",
    category: "travel",
    defaultPaper: "kraft_paper",
  },
  {
    id: "achievement",
    name: "Achievement",
    emoji: "🏆",
    description: "Bold accomplishment title, progress indicator, lessons learned, and milestone badge.",
    category: "achievement",
    defaultPaper: "ruled_notebook",
  },
  {
    id: "personal",
    name: "Personal Moment",
    emoji: "❤️",
    description: "Intimate polaroid portraits, handwritten reflections, and delicate quotes.",
    category: "personal",
    defaultPaper: "watercolor_blush",
  },
  {
    id: "celebration",
    name: "Celebration",
    emoji: "🎉",
    description: "Joyful collage with festive tapes, attendee lists, confetti, and party badges.",
    category: "celebration",
    defaultPaper: "dot_grid",
  },
  {
    id: "idea_board",
    name: "Idea Board",
    emoji: "💡",
    description: "Pinboard arrangement of concepts, brainstorm sticky cards, and creative spark tags.",
    category: "general",
    defaultPaper: "grid_graph",
  },
  {
    id: "project_diary",
    name: "Project Diary",
    emoji: "📚",
    description: "Structured roadmap entries, architecture notes, and progress logs.",
    category: "achievement",
    defaultPaper: "vintage_parchment",
  },
];

// Curated stock photos for memories without uploaded photos
export const STOCK_MEMORY_PHOTOS: Record<MemoryCategory, string[]> = {
  travel: [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
  ],
  achievement: [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
  ],
  personal: [
    "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80",
  ],
  celebration: [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80",
  ],
  general: [
    "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=800&q=80",
  ],
};

// Sticker catalogue
export const STICKER_LIBRARY = [
  { id: "star_gold", emoji: "⭐", label: "Gold Star" },
  { id: "heart_red", emoji: "❤️", label: "Heart" },
  { id: "sparkles", emoji: "✨", label: "Sparkles" },
  { id: "trophy", emoji: "🏆", label: "Trophy" },
  { id: "pin_red", emoji: "📍", label: "Map Pin" },
  { id: "camera", emoji: "📷", label: "Camera" },
  { id: "airplane", emoji: "✈️", label: "Flight" },
  { id: "coffee", emoji: "☕", label: "Warm Cup" },
  { id: "leaf", emoji: "🌿", label: "Botanical" },
  { id: "sun", emoji: "☀️", label: "Sunshine" },
  { id: "party", emoji: "🎉", label: "Confetti" },
  { id: "lightbulb", emoji: "💡", label: "Idea" },
  { id: "fire", emoji: "🔥", label: "Energy" },
  { id: "music", emoji: "🎵", label: "Melody" },
  { id: "gem", emoji: "💎", label: "Gem" },
  { id: "rocket", emoji: "🚀", label: "Launch" },
  { id: "ticket", emoji: "🎟️", label: "Ticket" },
  { id: "flower", emoji: "🌸", label: "Cherry Blossom" },
];

export const WASHI_TAPES = [
  { id: "tape_cream", color: "rgba(245, 235, 215, 0.85)", label: "Cream Linen" },
  { id: "tape_blush", color: "rgba(254, 215, 215, 0.85)", label: "Blush Rose" },
  { id: "tape_sage", color: "rgba(220, 240, 225, 0.85)", label: "Sage Meadow" },
  { id: "tape_amber", color: "rgba(254, 243, 199, 0.85)", label: "Warm Ochre" },
  { id: "tape_lavender", color: "rgba(233, 213, 255, 0.85)", label: "Soft Lavender" },
  { id: "tape_slate", color: "rgba(226, 232, 240, 0.85)", label: "Minimal Slate" },
];

// Format reflection text into readable paragraphs
export function getReflectionText(reflection: ReflectionDoc): string {
  if (reflection.messages && reflection.messages.length > 0) {
    return reflection.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");
  }
  return reflection.summary || reflection.title || "";
}

// Generate an intelligent layout for a specific template & metadata
export function buildLayoutForTemplate(
  templateId: ScrapbookTemplateId,
  title: string,
  date: string,
  text: string,
  metadata: ScrapbookMemoryMetadata,
  existingPhotos: string[] = []
): { elements: ScrapbookElement[]; paperStyle: PaperStyle } {
  const template = SCRAPBOOK_TEMPLATES.find((t) => t.id === templateId) || SCRAPBOOK_TEMPLATES[0];
  const elements: ScrapbookElement[] = [];
  let zIndex = 1;

  const photoPool =
    existingPhotos.length > 0
      ? existingPhotos
      : STOCK_MEMORY_PHOTOS[template.category] || STOCK_MEMORY_PHOTOS.general;

  // Short snippet from text
  const shortSnippet = text
    ? text.slice(0, 280) + (text.length > 280 ? "..." : "")
    : "Every memory holds a quiet story waiting to be remembered.";

  if (templateId === "travel") {
    // TRAVEL LAYOUT:
    // 1. Location badge
    elements.push({
      id: "travel_loc_badge",
      type: "badge",
      x: 48,
      y: 36,
      width: 220,
      height: 44,
      rotation: -1,
      zIndex: zIndex++,
      content: `📍 ${metadata.location || "Kochi, Kerala"}`,
      stampVariant: "badge",
      stampColor: "#047857",
      style: {
        fontFamily: "Plus Jakarta Sans",
        fontSize: 14,
        fontWeight: "bold",
        color: "#065f46",
        backgroundColor: "#ecfdf5",
        borderColor: "#a7f3d0",
        borderWidth: 1,
        borderRadius: 20,
      },
    });

    // 2. Date marker
    elements.push({
      id: "travel_date",
      type: "text",
      x: 520,
      y: 42,
      width: 230,
      height: 36,
      rotation: 0,
      zIndex: zIndex++,
      content: `📅 ${date}`,
      style: {
        fontFamily: "Courier Prime",
        fontSize: 13,
        color: "#78716c",
      },
    });

    // 3. Large Title
    elements.push({
      id: "travel_title",
      type: "text",
      x: 48,
      y: 92,
      width: 700,
      height: 60,
      rotation: 0,
      zIndex: zIndex++,
      content: title || "A Peaceful Weekend Away",
      style: {
        fontFamily: "Playfair Display",
        fontSize: 32,
        fontWeight: "bold",
        color: "#1c1917",
      },
    });

    // 4. Large Hero Photo (Polaroid)
    elements.push({
      id: "travel_hero_photo",
      type: "image",
      x: 48,
      y: 165,
      width: 360,
      height: 300,
      rotation: -2,
      zIndex: zIndex++,
      imageUrl: photoPool[0],
      caption: metadata.location ? `Wandering around ${metadata.location}` : "Golden hour moments",
      photoStyle: "polaroid",
      style: {
        borderRadius: 8,
      },
    });

    // 5. Washi Tape on hero photo
    elements.push({
      id: "travel_tape_1",
      type: "tape",
      x: 170,
      y: 155,
      width: 120,
      height: 28,
      rotation: 3,
      zIndex: zIndex++,
      tapeColor: "rgba(254, 243, 199, 0.85)",
    });

    // 6. Short Story / Reflection Card
    elements.push({
      id: "travel_story",
      type: "quote_card",
      x: 435,
      y: 175,
      width: 330,
      height: 180,
      rotation: 1,
      zIndex: zIndex++,
      content: shortSnippet,
      cardVariant: "pinned",
      style: {
        fontFamily: "Newsreader",
        fontSize: 15,
        color: "#292524",
        backgroundColor: "#fffbeb",
        borderColor: "#fde68a",
        borderWidth: 1,
        borderRadius: 12,
      },
    });

    // 7. Supporting Photos Collage
    if (photoPool[1]) {
      elements.push({
        id: "travel_photo_2",
        type: "image",
        x: 435,
        y: 375,
        width: 160,
        height: 150,
        rotation: 2,
        zIndex: zIndex++,
        imageUrl: photoPool[1],
        photoStyle: "border",
        style: { borderRadius: 8 },
      });
    }

    if (photoPool[2]) {
      elements.push({
        id: "travel_photo_3",
        type: "image",
        x: 610,
        y: 375,
        width: 160,
        height: 150,
        rotation: -3,
        zIndex: zIndex++,
        imageUrl: photoPool[2],
        photoStyle: "border",
        style: { borderRadius: 8 },
      });
    }

    // 8. Favorite Moment Pill
    elements.push({
      id: "travel_fav_moment",
      type: "text",
      x: 48,
      y: 480,
      width: 360,
      height: 60,
      rotation: 0,
      zIndex: zIndex++,
      content: `⭐ Favorite Moment: "${metadata.favoriteMoment || metadata.keyQuotes?.[0] || "Watching the sunset quiet the harbor."}"`,
      style: {
        fontFamily: "Kalam",
        fontSize: 15,
        color: "#92400e",
        backgroundColor: "#fef3c7",
        borderRadius: 10,
        borderColor: "#fde68a",
        borderWidth: 1,
      },
    });

    // 9. Decorative sticker
    elements.push({
      id: "travel_sticker_1",
      type: "sticker",
      x: 375,
      y: 430,
      width: 48,
      height: 48,
      rotation: 8,
      zIndex: zIndex++,
      content: "✈️",
    });
  } else if (templateId === "achievement") {
    // ACHIEVEMENT LAYOUT:
    // 1. Badge
    elements.push({
      id: "achieve_badge",
      type: "badge",
      x: 48,
      y: 40,
      width: 240,
      height: 44,
      rotation: 0,
      zIndex: zIndex++,
      content: "🏆 PROJECT COMPLETED",
      stampVariant: "badge",
      stampColor: "#b45309",
      style: {
        fontFamily: "Plus Jakarta Sans",
        fontSize: 13,
        fontWeight: "bold",
        color: "#92400e",
        backgroundColor: "#fef3c7",
        borderColor: "#fde68a",
        borderWidth: 1,
        borderRadius: 20,
      },
    });

    // 2. Title
    elements.push({
      id: "achieve_title",
      type: "text",
      x: 48,
      y: 98,
      width: 700,
      height: 65,
      rotation: 0,
      zIndex: zIndex++,
      content: title || "ReflectAI Milestone Reached",
      style: {
        fontFamily: "Playfair Display",
        fontSize: 34,
        fontWeight: "bold",
        color: "#1c1917",
      },
    });

    // 3. Progress indicator card
    elements.push({
      id: "achieve_progress",
      type: "cardVariant" as any,
      x: 48,
      y: 175,
      width: 320,
      height: 120,
      rotation: -1,
      zIndex: zIndex++,
      content: `🎯 Milestone: ${metadata.progressPercent || 100}% Complete\n\n"What started as an idea finally became a working application."`,
      cardVariant: "highlight",
      style: {
        fontFamily: "Plus Jakarta Sans",
        fontSize: 14,
        color: "#15803d",
        backgroundColor: "#f0fdf4",
        borderColor: "#bbf7d0",
        borderWidth: 1,
        borderRadius: 12,
      },
    });

    // 4. Hero Photo
    elements.push({
      id: "achieve_photo",
      type: "image",
      x: 400,
      y: 170,
      width: 360,
      height: 240,
      rotation: 2,
      zIndex: zIndex++,
      imageUrl: photoPool[0],
      caption: "Proof of progress & dedication",
      photoStyle: "polaroid",
      style: { borderRadius: 8 },
    });

    // 5. Tape
    elements.push({
      id: "achieve_tape",
      type: "tape",
      x: 520,
      y: 160,
      width: 130,
      height: 28,
      rotation: -3,
      zIndex: zIndex++,
      tapeColor: "rgba(220, 240, 225, 0.85)",
    });

    // 6. Reflection & "What I Learned"
    elements.push({
      id: "achieve_learned",
      type: "quote_card",
      x: 48,
      y: 315,
      width: 330,
      height: 180,
      rotation: 0,
      zIndex: zIndex++,
      content: `💡 What I Learned:\n${metadata.whatILearned || shortSnippet}`,
      cardVariant: "sticky",
      style: {
        fontFamily: "Newsreader",
        fontSize: 15,
        color: "#292524",
        backgroundColor: "#fdfbf7",
        borderColor: "#e7e5e4",
        borderWidth: 1,
        borderRadius: 12,
      },
    });

    // 7. Sticker
    elements.push({
      id: "achieve_sticker",
      type: "sticker",
      x: 700,
      y: 380,
      width: 52,
      height: 52,
      rotation: 12,
      zIndex: zIndex++,
      content: "🚀",
    });
  } else if (templateId === "celebration") {
    // CELEBRATION LAYOUT:
    elements.push({
      id: "celeb_badge",
      type: "badge",
      x: 48,
      y: 36,
      width: 220,
      height: 44,
      rotation: -2,
      zIndex: zIndex++,
      content: "🎉 SPECIAL CELEBRATION",
      stampVariant: "badge",
      stampColor: "#db2777",
      style: {
        fontFamily: "Plus Jakarta Sans",
        fontSize: 13,
        fontWeight: "bold",
        color: "#be185d",
        backgroundColor: "#fdf2f8",
        borderColor: "#fbcfe8",
        borderWidth: 1,
        borderRadius: 20,
      },
    });

    elements.push({
      id: "celeb_title",
      type: "text",
      x: 48,
      y: 92,
      width: 700,
      height: 60,
      rotation: 0,
      zIndex: zIndex++,
      content: title || "A Night to Remember",
      style: {
        fontFamily: "Playfair Display",
        fontSize: 34,
        fontWeight: "bold",
        color: "#1c1917",
      },
    });

    // 2 Photos in collage
    elements.push({
      id: "celeb_photo_1",
      type: "image",
      x: 48,
      y: 165,
      width: 250,
      height: 250,
      rotation: -4,
      zIndex: zIndex++,
      imageUrl: photoPool[0],
      caption: metadata.peopleMentioned?.length ? `With ${metadata.peopleMentioned.join(", ")}` : "Together",
      photoStyle: "polaroid",
    });

    elements.push({
      id: "celeb_photo_2",
      type: "image",
      x: 295,
      y: 175,
      width: 240,
      height: 240,
      rotation: 3,
      zIndex: zIndex++,
      imageUrl: photoPool[1] || photoPool[0],
      caption: "Laughter & memories",
      photoStyle: "polaroid",
    });

    elements.push({
      id: "celeb_story",
      type: "quote_card",
      x: 550,
      y: 165,
      width: 225,
      height: 270,
      rotation: 1,
      zIndex: zIndex++,
      content: `👥 People:\n${metadata.peopleMentioned?.join(", ") || "Cherished friends"}\n\n✨ Highlights:\n${shortSnippet}`,
      cardVariant: "torn",
      style: {
        fontFamily: "Kalam",
        fontSize: 15,
        color: "#374151",
        backgroundColor: "#fef2f2",
        borderColor: "#fecaca",
        borderWidth: 1,
        borderRadius: 12,
      },
    });

    // Stickers
    elements.push({
      id: "celeb_sticker_1",
      type: "sticker",
      x: 240,
      y: 140,
      width: 48,
      height: 48,
      rotation: 10,
      zIndex: zIndex++,
      content: "🎊",
    });

    elements.push({
      id: "celeb_sticker_2",
      type: "sticker",
      x: 510,
      y: 400,
      width: 48,
      height: 48,
      rotation: -12,
      zIndex: zIndex++,
      content: "❤️",
    });
  } else if (templateId === "personal") {
    // PERSONAL MOMENT LAYOUT:
    elements.push({
      id: "personal_title",
      type: "text",
      x: 48,
      y: 50,
      width: 700,
      height: 55,
      rotation: 0,
      zIndex: zIndex++,
      content: title || "Quiet Reflections",
      style: {
        fontFamily: "Playfair Display",
        fontSize: 32,
        fontWeight: "bold",
        color: "#292524",
      },
    });

    elements.push({
      id: "personal_quote",
      type: "quote_card",
      x: 48,
      y: 120,
      width: 380,
      height: 180,
      rotation: -1,
      zIndex: zIndex++,
      content: `"${metadata.keyQuotes?.[0] || shortSnippet}"`,
      cardVariant: "quote",
      style: {
        fontFamily: "Newsreader",
        fontStyle: "italic",
        fontSize: 17,
        color: "#1c1917",
        backgroundColor: "#fff7ed",
        borderColor: "#fed7aa",
        borderWidth: 1,
        borderRadius: 14,
      },
    });

    elements.push({
      id: "personal_photo",
      type: "image",
      x: 460,
      y: 110,
      width: 300,
      height: 290,
      rotation: 3,
      zIndex: zIndex++,
      imageUrl: photoPool[0],
      caption: `Captured on ${date}`,
      photoStyle: "polaroid",
    });

    elements.push({
      id: "personal_tape",
      type: "tape",
      x: 550,
      y: 100,
      width: 120,
      height: 26,
      rotation: -2,
      zIndex: zIndex++,
      tapeColor: "rgba(254, 215, 215, 0.85)",
    });

    elements.push({
      id: "personal_notes",
      type: "text",
      x: 48,
      y: 320,
      width: 400,
      height: 160,
      rotation: 0,
      zIndex: zIndex++,
      content: text ? text.slice(0, 320) : "Some moments remain etched into our quietest memories.",
      style: {
        fontFamily: "Caveat",
        fontSize: 19,
        color: "#44403c",
      },
    });

    elements.push({
      id: "personal_sticker",
      type: "sticker",
      x: 700,
      y: 380,
      width: 46,
      height: 46,
      rotation: 5,
      zIndex: zIndex++,
      content: "🌸",
    });
  } else {
    // CLASSIC / GENERAL LAYOUT:
    elements.push({
      id: "classic_title",
      type: "text",
      x: 48,
      y: 50,
      width: 700,
      height: 55,
      rotation: 0,
      zIndex: zIndex++,
      content: title || "Journal Reflection",
      style: {
        fontFamily: "Playfair Display",
        fontSize: 32,
        fontWeight: "bold",
        color: "#1c1917",
      },
    });

    elements.push({
      id: "classic_date",
      type: "text",
      x: 550,
      y: 55,
      width: 200,
      height: 35,
      rotation: 0,
      zIndex: zIndex++,
      content: `📅 ${date}`,
      style: {
        fontFamily: "Courier Prime",
        fontSize: 13,
        color: "#78716c",
      },
    });

    elements.push({
      id: "classic_photo",
      type: "image",
      x: 48,
      y: 125,
      width: 320,
      height: 260,
      rotation: -1,
      zIndex: zIndex++,
      imageUrl: photoPool[0],
      caption: metadata.location || "A moment in time",
      photoStyle: "polaroid",
    });

    elements.push({
      id: "classic_tape",
      type: "tape",
      x: 140,
      y: 115,
      width: 120,
      height: 26,
      rotation: 2,
      zIndex: zIndex++,
      tapeColor: "rgba(245, 235, 215, 0.85)",
    });

    elements.push({
      id: "classic_body",
      type: "text",
      x: 400,
      y: 125,
      width: 360,
      height: 260,
      rotation: 0,
      zIndex: zIndex++,
      content: text ? text.slice(0, 450) : shortSnippet,
      style: {
        fontFamily: "Newsreader",
        fontSize: 16,
        color: "#292524",
      },
    });

    if (metadata.keyQuotes?.[0]) {
      elements.push({
        id: "classic_quote",
        type: "quote_card",
        x: 48,
        y: 410,
        width: 710,
        height: 80,
        rotation: 0,
        zIndex: zIndex++,
        content: `"${metadata.keyQuotes[0]}"`,
        cardVariant: "highlight",
        style: {
          fontFamily: "Newsreader",
          fontStyle: "italic",
          fontSize: 16,
          color: "#451a03",
          backgroundColor: "#fffbeb",
          borderColor: "#fde68a",
          borderWidth: 1,
          borderRadius: 8,
        },
      });
    }
  }

  return { elements, paperStyle: template.defaultPaper };
}

// Client service to request AI Scrapbook generation from server
export async function generateAIScrapbook(
  reflection: ReflectionDoc,
  preferredTemplate?: ScrapbookTemplateId
): Promise<ScrapbookDoc> {
  const reflectionText = getReflectionText(reflection);

  try {
    const res = await fetch("/api/gemini/generate-scrapbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reflection,
        preferredTemplate,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.scrapbook) {
        return data.scrapbook as ScrapbookDoc;
      }
    }
  } catch (err) {
    console.warn("Server AI scrapbook generation unavailable, using local synthesis:", err);
  }

  // Resilient fallback generator
  return createFallbackScrapbook(reflection, preferredTemplate);
}

// Fallback generator when offline or API call unavailable
export function createFallbackScrapbook(
  reflection: ReflectionDoc,
  preferredTemplate?: ScrapbookTemplateId
): ScrapbookDoc {
  const text = getReflectionText(reflection);
  const textLower = text.toLowerCase();

  // Infer memory category
  let category: MemoryCategory = "general";
  if (
    textLower.includes("travel") ||
    textLower.includes("trip") ||
    textLower.includes("flight") ||
    textLower.includes("hotel") ||
    textLower.includes("beach") ||
    textLower.includes("kochi") ||
    textLower.includes("visit")
  ) {
    category = "travel";
  } else if (
    textLower.includes("completed") ||
    textLower.includes("launched") ||
    textLower.includes("project") ||
    textLower.includes("milestone") ||
    textLower.includes("won") ||
    textLower.includes("passed") ||
    textLower.includes("finish")
  ) {
    category = "achievement";
  } else if (
    textLower.includes("party") ||
    textLower.includes("birthday") ||
    textLower.includes("celebrat") ||
    textLower.includes("dinner") ||
    textLower.includes("friends")
  ) {
    category = "celebration";
  } else if (
    textLower.includes("felt") ||
    textLower.includes("quiet") ||
    textLower.includes("remember") ||
    textLower.includes("heart") ||
    textLower.includes("love")
  ) {
    category = "personal";
  }

  const templateId: ScrapbookTemplateId =
    preferredTemplate ||
    (category === "travel"
      ? "travel"
      : category === "achievement"
      ? "achievement"
      : category === "celebration"
      ? "celebration"
      : category === "personal"
      ? "personal"
      : "classic");

  // Extract simple quotes & people
  const metadata: ScrapbookMemoryMetadata = {
    mainEvent: reflection.title || "Cherished Journal Memory",
    date: reflection.date,
    mood: reflection.mood,
    location: category === "travel" ? "Kochi, Kerala" : undefined,
    peopleMentioned: ["Friends"],
    keyQuotes: [reflection.title || "Every day is a story in progress."],
    favoriteMoment: "The moment everything aligned perfectly.",
    highlights: ["Quiet reflection", "Creative progress"],
  };

  const { elements, paperStyle } = buildLayoutForTemplate(
    templateId,
    reflection.title || "Reflections",
    reflection.date,
    text,
    metadata
  );

  const aiSuggestions: ScrapbookSuggestion[] = [
    {
      id: "sug_moment",
      type: "add_moment",
      label: "Add Favorite Moment",
      description: "Feature your top highlight in an illuminated gold box.",
      applied: false,
    },
    {
      id: "sug_collage",
      type: "collage",
      label: "Create Photo Collage",
      description: "Arrange 3 polaroid frames with washi tape accents.",
      applied: false,
    },
    {
      id: "sug_location",
      type: "add_location",
      label: "Add Location Badge",
      description: "Pin the geographic coordinates to link with your travels.",
      applied: false,
    },
    {
      id: "sug_quote",
      type: "add_quote",
      label: "Add Highlight Quote",
      description: "Pull a meaningful sentence into a pull-quote callout.",
      applied: false,
    },
    {
      id: "sug_graph",
      type: "connect_graph",
      label: "Connect to Life Graph",
      description: "Link this memory with related projects, people, and places.",
      applied: false,
    },
  ];

  return {
    id: `scrapbook_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    userId: reflection.userId,
    sourceReflectionId: reflection.id,
    sourceReflectionTitle: reflection.title,
    title: reflection.title || "Visual Memory Page",
    date: reflection.date,
    template: templateId,
    memoryType: category,
    paperStyle,
    elements,
    metadata,
    lifeGraphNodeIds: [],
    aiSuggestions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
