import React, { useState, useRef } from "react";
import { 
  ScrapbookLayout, 
  ScrapbookElement, 
  PaperStyle, 
  JournalFontFamily,
  AIDesignSuggestion
} from "../types";
import { 
  PAPER_STYLES, 
  JOURNAL_FONTS, 
  WASHI_TAPE_COLORS, 
  STICKER_PACKS, 
  JOURNAL_TEMPLATES,
  STAMP_OPTIONS,
  COLOR_PALETTES,
  JournalTemplate
} from "../lib/scrapbookConstants";
import { validateAndReadImageFile } from "../lib/fileSecurity";
import { 
  Type, 
  Image as ImageIcon, 
  Smile, 
  Layers, 
  Sparkles, 
  RotateCw, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Palette, 
  LayoutTemplate, 
  Sliders, 
  Upload, 
  Plus, 
  X, 
  Check, 
  Camera, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Bold, 
  Italic, 
  Underline,
  HelpCircle,
  Quote,
  Stamp,
  Wand2,
  Lock,
  Unlock,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface ScrapbookToolbarProps {
  layout: ScrapbookLayout;
  onChangeLayout: (newLayout: ScrapbookLayout) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  entryTitle: string;
  entryDate: string;
  entryText: string;
  aiSummary?: string;
  onApplyTemplate: (template: JournalTemplate) => void;
}

export const ScrapbookToolbar: React.FC<ScrapbookToolbarProps> = ({
  layout,
  onChangeLayout,
  selectedElementId,
  onSelectElement,
  entryTitle,
  entryDate,
  entryText,
  aiSummary,
  onApplyTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<"add" | "paper" | "templates" | "inspector">(
    selectedElementId ? "inspector" : "add"
  );
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showTapePicker, setShowTapePicker] = useState(false);
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showPaletteDropdown, setShowPaletteDropdown] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAiDesignModal, setShowAiDesignModal] = useState(false);
  
  // Custom element inputs
  const [customStampText, setCustomStampText] = useState("");
  const [customStampColor, setCustomStampColor] = useState("#b91c1c");
  const [quoteTextInput, setQuoteTextInput] = useState("");
  const [quoteAuthorInput, setQuoteAuthorInput] = useState("");
  const [quoteTheme, setQuoteTheme] = useState<"parchment" | "sage" | "rose" | "indigo">("parchment");

  // AI Design Suggestion state
  const [isAiDesigning, setIsAiDesigning] = useState(false);
  const [aiDesignSuggestion, setAiDesignSuggestion] = useState<AIDesignSuggestion | null>(null);
  const [aiDesignError, setAiDesignError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedElement = layout.elements.find((el) => el.id === selectedElementId) || null;

  // -------------------------------------------------------------
  // Add Elements
  // -------------------------------------------------------------
  const handleAddTextBlock = (font: JournalFontFamily = "Newsreader", initialText = "New journal thought...") => {
    const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
    const newEl: ScrapbookElement = {
      id: `text_${Date.now()}`,
      type: "text",
      x: 100,
      y: 200,
      width: 380,
      height: 120,
      rotation: 0,
      zIndex: nextZ,
      content: initialText,
      fontFamily: font,
      fontSize: 18,
      fontWeight: "normal",
      textAlign: "left",
    };
    onChangeLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    onSelectElement(newEl.id);
  };

  const handleAddSticker = (sticker: string) => {
    const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
    const newEl: ScrapbookElement = {
      id: `sticker_${Date.now()}`,
      type: "sticker",
      x: 350,
      y: 200,
      width: 50,
      height: 50,
      rotation: Math.floor(Math.random() * 20) - 10,
      zIndex: nextZ,
      content: sticker,
      fontSize: 34,
    };
    onChangeLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    onSelectElement(newEl.id);
    setShowStickerPicker(false);
  };

  const handleAddTape = (tapeBgClass: string) => {
    const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
    const newEl: ScrapbookElement = {
      id: `tape_${Date.now()}`,
      type: "tape",
      x: 300,
      y: 150,
      width: 140,
      height: 28,
      rotation: Math.floor(Math.random() * 8) - 4,
      zIndex: nextZ,
      tapeColor: tapeBgClass,
    };
    onChangeLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    onSelectElement(newEl.id);
    setShowTapePicker(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validation = await validateAndReadImageFile(file);
      if (!validation.ok || !validation.dataUrl) {
        alert(validation.error || "Failed to upload image. Please ensure it is a valid JPEG, PNG, WebP, or GIF under 5MB.");
        e.target.value = "";
        return;
      }
      const dataUrl = validation.dataUrl;
      const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
      const newPhoto: ScrapbookElement = {
        id: `photo_${Date.now()}`,
        type: "image",
        x: 220,
        y: 240,
        width: 280,
        height: 320,
        rotation: Math.floor(Math.random() * 6) - 3,
        zIndex: nextZ,
        imageUrl: dataUrl,
        caption: validation.sanitizedName || "Cherished snapshot ✨",
        photoStyle: "polaroid",
      };
      onChangeLayout({
        ...layout,
        elements: [...layout.elements, newPhoto],
      });
      onSelectElement(newPhoto.id);
      e.target.value = "";
    }
  };

  const handleAddStamp = (text: string, color = "#b91c1c", variant: "circle" | "rect" = "rect") => {
    const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
    const newEl: ScrapbookElement = {
      id: `stamp_${Date.now()}`,
      type: "stamp",
      x: 320,
      y: 220,
      width: variant === "circle" ? 96 : 148,
      height: variant === "circle" ? 96 : 60,
      rotation: Math.floor(Math.random() * 16) - 8,
      zIndex: nextZ,
      content: text,
      stampText: text,
      stampColor: color,
      stampVariant: variant,
    };
    onChangeLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    onSelectElement(newEl.id);
    setShowStampPicker(false);
  };

  const handleAddQuoteCard = () => {
    if (!quoteTextInput.trim()) return;
    const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
    
    let bg = "#fef9c3";
    let border = "#fde047";
    let textCol = "#78350f";

    if (quoteTheme === "sage") {
      bg = "#ecfdf5";
      border = "#a7f3d0";
      textCol = "#065f46";
    } else if (quoteTheme === "rose") {
      bg = "#fff1f2";
      border = "#fecdd3";
      textCol = "#9f1239";
    } else if (quoteTheme === "indigo") {
      bg = "#eef2ff";
      border = "#c7d2fe";
      textCol = "#3730a3";
    }

    const newEl: ScrapbookElement = {
      id: `quote_${Date.now()}`,
      type: "quote_card",
      x: 200,
      y: 260,
      width: 360,
      height: 130,
      rotation: Math.floor(Math.random() * 4) - 2,
      zIndex: nextZ,
      content: quoteTextInput.trim(),
      caption: quoteAuthorInput.trim() || "Daily Reflection",
      backgroundColor: bg,
      borderColor: border,
      color: textCol,
      fontFamily: "Newsreader",
    };
    onChangeLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    onSelectElement(newEl.id);
    setQuoteTextInput("");
    setQuoteAuthorInput("");
    setShowQuoteModal(false);
  };

  const handleTriggerAiDesign = async () => {
    setIsAiDesigning(true);
    setAiDesignError(null);
    try {
      const response = await fetch("/api/gemini/suggest-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: entryText || "A peaceful and reflective personal diary note.",
          title: entryTitle || "Journal Entry",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to receive AI design suggestions.");
      }
      setAiDesignSuggestion(data);
      setShowAiDesignModal(true);
    } catch (err: any) {
      console.error("AI design error:", err);
      setAiDesignError(err?.message || "Could not retrieve AI design suggestions.");
    } finally {
      setIsAiDesigning(false);
    }
  };

  const handleApplyAiDesign = () => {
    if (!aiDesignSuggestion) return;
    const meta = PAPER_STYLES.find((p) => p.id === aiDesignSuggestion.paperStyle);
    
    // Update layout paper style and color
    const nextLayout: ScrapbookLayout = {
      ...layout,
      paperStyle: aiDesignSuggestion.paperStyle || layout.paperStyle,
      paperColor: meta?.defaultBgColor || layout.paperColor,
    };

    // Add suggested stickers and a washi tape
    const maxZ = Math.max(...nextLayout.elements.map((el) => el.zIndex || 1), 10);
    const addedElements: ScrapbookElement[] = [];

    if (aiDesignSuggestion.stickers && aiDesignSuggestion.stickers.length > 0) {
      aiDesignSuggestion.stickers.slice(0, 2).forEach((stk, idx) => {
        addedElements.push({
          id: `stk_ai_${Date.now()}_${idx}`,
          type: "sticker",
          x: 140 + idx * 440,
          y: 180 + idx * 180,
          width: 48,
          height: 48,
          rotation: (idx % 2 === 0 ? -1 : 1) * 7,
          zIndex: maxZ + idx + 1,
          content: stk,
          fontSize: 32,
        });
      });
    }

    if (aiDesignSuggestion.washiTapeBg) {
      addedElements.push({
        id: `tape_ai_${Date.now()}`,
        type: "tape",
        x: 310,
        y: 85,
        width: 145,
        height: 26,
        rotation: 2,
        zIndex: maxZ + 4,
        tapeColor: aiDesignSuggestion.washiTapeBg,
      });
    }

    nextLayout.elements = [...nextLayout.elements, ...addedElements];
    onChangeLayout(nextLayout);
    setShowAiDesignModal(false);
  };

  // -------------------------------------------------------------
  // Modify Selected Element
  // -------------------------------------------------------------
  const updateSelected = (updates: Partial<ScrapbookElement>) => {
    if (!selectedElement) return;
    onChangeLayout({
      ...layout,
      elements: layout.elements.map((el) =>
        el.id === selectedElement.id ? { ...el, ...updates } : el
      ),
    });
  };

  const handlePaperStyleChange = (styleId: PaperStyle) => {
    const meta = PAPER_STYLES.find((p) => p.id === styleId);
    onChangeLayout({
      ...layout,
      paperStyle: styleId,
      paperColor: meta?.defaultBgColor || "#FAF7F2",
    });
  };

  const handleSelectPalette = (palette: (typeof COLOR_PALETTES)[0]) => {
    const meta = PAPER_STYLES.find((p) => p.id === palette.paperStyle);
    onChangeLayout({
      ...layout,
      paperStyle: palette.paperStyle,
      paperColor: meta?.defaultBgColor || "#FAF7F2",
    });
    setShowPaletteDropdown(false);
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 space-y-4">
      
      {/* Top Main Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-stone-200">
        
        {/* Creation Tools */}
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* Add Text */}
          <button
            type="button"
            onClick={() => handleAddTextBlock("Newsreader")}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <Type className="w-3.5 h-3.5 text-stone-600" />
            <span>Add Text</span>
          </button>

          {/* Add Photo / Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
            title="Upload photo or drag and drop onto journal paper"
          >
            <Camera className="w-3.5 h-3.5 text-amber-700" />
            <span>Add Photo</span>
          </button>

          {/* Stickers Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowStickerPicker(!showStickerPicker);
                setShowTapePicker(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <Smile className="w-3.5 h-3.5 text-stone-600" />
              <span>Stickers</span>
            </button>

            {showStickerPicker && (
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                  <span>Stamp a Sticker</span>
                  <button onClick={() => setShowStickerPicker(false)}>
                    <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
                  </button>
                </div>
                {STICKER_PACKS.map((pack) => (
                  <div key={pack.category} className="space-y-1">
                    <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                      {pack.category}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {pack.stickers.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleAddSticker(s)}
                          className="h-10 text-2xl rounded-xl hover:bg-stone-100 flex items-center justify-center transition-transform hover:scale-125"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Washi Tape Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTapePicker(!showTapePicker);
                setShowStickerPicker(false);
                setShowStampPicker(false);
                setShowPaletteDropdown(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <span className="w-3.5 h-2 rounded-xs bg-amber-400 border border-amber-500 inline-block" />
              <span>Washi Tape</span>
            </button>

            {showTapePicker && (
              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                  <span>Choose Washi Tape Color</span>
                  <button onClick={() => setShowTapePicker(false)}>
                    <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {WASHI_TAPE_COLORS.map((tape) => (
                    <button
                      key={tape.id}
                      type="button"
                      onClick={() => handleAddTape(tape.bg)}
                      className="p-2 rounded-xl border border-stone-200 hover:border-amber-400 flex items-center gap-2 text-left transition-colors"
                    >
                      <div className={`w-6 h-3 rounded-xs ${tape.bg} border`} />
                      <span className="text-[11px] font-medium text-stone-700 truncate">{tape.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stamps Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowStampPicker(!showStampPicker);
                setShowStickerPicker(false);
                setShowTapePicker(false);
                setShowPaletteDropdown(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
            >
              <Stamp className="w-3.5 h-3.5 text-rose-700" />
              <span>Stamps</span>
            </button>

            {showStampPicker && (
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                  <span>Postal & Journal Stamps</span>
                  <button onClick={() => setShowStampPicker(false)}>
                    <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {STAMP_OPTIONS.map((st) => (
                    <button
                      key={st.text}
                      type="button"
                      onClick={() => handleAddStamp(st.text, st.color, "rect")}
                      className="p-2 rounded-xl border border-stone-200 hover:border-stone-400 text-left transition-colors group"
                      style={{ color: st.color }}
                    >
                      <div className="text-[10px] font-mono font-bold tracking-wider uppercase border border-current rounded px-1.5 py-0.5 inline-block group-hover:scale-105 transition-transform">
                        {st.text}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Stamp Entry */}
                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider block">
                    Custom Stamp
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Custom Stamp Text..."
                      value={customStampText}
                      onChange={(e) => setCustomStampText(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs border border-stone-200 rounded-lg outline-none font-mono uppercase"
                    />
                    <input
                      type="color"
                      value={customStampColor}
                      onChange={(e) => setCustomStampColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!customStampText.trim()}
                      onClick={() => {
                        handleAddStamp(customStampText.trim().toUpperCase(), customStampColor, "rect");
                        setCustomStampText("");
                      }}
                      className="flex-1 py-1 rounded-lg bg-stone-900 text-white text-[11px] font-semibold disabled:opacity-40"
                    >
                      Add Rectangular
                    </button>
                    <button
                      type="button"
                      disabled={!customStampText.trim()}
                      onClick={() => {
                        handleAddStamp(customStampText.trim().toUpperCase(), customStampColor, "circle");
                        setCustomStampText("");
                      }}
                      className="flex-1 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold disabled:opacity-40"
                    >
                      Add Circular
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Quote Card Trigger */}
          <button
            type="button"
            onClick={() => setShowQuoteModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <Quote className="w-3.5 h-3.5 text-amber-700" />
            <span>Quote Card</span>
          </button>

          {/* AI Design Assistant Trigger */}
          <button
            type="button"
            onClick={handleTriggerAiDesign}
            disabled={isAiDesigning}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
            title="Let Gemini AI recommend colors, paper textures, and aesthetic decorations based on what you wrote"
          >
            {isAiDesigning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-amber-100" />
            )}
            <span>AI Design</span>
          </button>

          {/* Templates Presets Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
            <span>Presets</span>
          </button>

        </div>

        {/* Paper & Theme Palettes Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Color Palettes Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPaletteDropdown(!showPaletteDropdown);
                setShowStickerPicker(false);
                setShowTapePicker(false);
                setShowStampPicker(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
            >
              <Palette className="w-3.5 h-3.5 text-amber-600" />
              <span>Theme Palettes</span>
            </button>

            {showPaletteDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-stone-800 pb-1 border-b border-stone-100">
                  <span>Artisan Palettes</span>
                  <button onClick={() => setShowPaletteDropdown(false)}>
                    <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {COLOR_PALETTES.map((pal) => (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => handleSelectPalette(pal)}
                      className="w-full p-2 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-between text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{pal.badge}</span>
                        <div>
                          <div className="text-xs font-semibold text-stone-900 group-hover:text-amber-900">
                            {pal.name}
                          </div>
                          <div className="text-[10px] text-stone-500 line-clamp-1">{pal.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: pal.primaryColor }} />
                        <div className="w-3 h-3 rounded-full border border-stone-300" style={{ backgroundColor: pal.accentColor }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Paper Style Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-600">Paper:</span>
            <select
              value={layout.paperStyle}
              onChange={(e) => handlePaperStyleChange(e.target.value as PaperStyle)}
              className="px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {PAPER_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.icon} {style.label}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Selected Element Property Inspector (Contextual) */}
      {selectedElement ? (
        <div className="p-3.5 rounded-xl bg-stone-50/90 border border-amber-200/80 space-y-3 animate-fade-in">
          
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                {selectedElement.type === "text" && "📝 Text Block"}
                {selectedElement.type === "image" && "📷 Photo & Frame"}
                {selectedElement.type === "sticker" && "⭐ Sticker Stamp"}
                {selectedElement.type === "tape" && "🏷️ Washi Tape Strip"}
                {selectedElement.type === "stamp" && "📮 Postal Stamp"}
                {selectedElement.type === "quote_card" && "💬 Quote Card"}
                {selectedElement.type === "ai_card" && "✨ Reflection Card"}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 font-mono">
                Layer {selectedElement.zIndex || 10}
              </span>
              {selectedElement.locked && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Lock / Unlock Toggle */}
              <button
                type="button"
                onClick={() => updateSelected({ locked: !selectedElement.locked })}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                  selectedElement.locked
                    ? "bg-amber-100 border-amber-300 text-amber-900 font-semibold"
                    : "bg-white border-stone-200 text-stone-600 hover:text-stone-900"
                }`}
                title={selectedElement.locked ? "Unlock element" : "Lock element position"}
              >
                {selectedElement.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>

              {/* Duplicate */}
              <button
                type="button"
                onClick={() => {
                  const nextZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10) + 1;
                  const cloned: ScrapbookElement = {
                    ...selectedElement,
                    id: `${selectedElement.type}_${Date.now()}`,
                    x: selectedElement.x + 24,
                    y: selectedElement.y + 24,
                    zIndex: nextZ,
                  };
                  onChangeLayout({
                    ...layout,
                    elements: [...layout.elements, cloned],
                  });
                  onSelectElement(cloned.id);
                }}
                className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900"
                title="Duplicate (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {/* Layer Up */}
              <button
                type="button"
                onClick={() => updateSelected({ zIndex: (selectedElement.zIndex || 10) + 1 })}
                className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900"
                title="Bring Forward"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>

              {/* Layer Down */}
              <button
                type="button"
                onClick={() => updateSelected({ zIndex: Math.max(1, (selectedElement.zIndex || 10) - 1) })}
                className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900"
                title="Send Backward"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => {
                  onChangeLayout({
                    ...layout,
                    elements: layout.elements.filter((el) => el.id !== selectedElement.id),
                  });
                  onSelectElement(null);
                }}
                className="p-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700"
                title="Delete Element (Del)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Deselect */}
              <button
                type="button"
                onClick={() => onSelectElement(null)}
                className="text-xs text-stone-400 hover:text-stone-700 ml-1"
              >
                Done
              </button>
            </div>
          </div>

          {/* Typography Controls for Text */}
          {selectedElement.type === "text" && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Font Family */}
              <select
                value={selectedElement.fontFamily || "Newsreader"}
                onChange={(e) => updateSelected({ fontFamily: e.target.value as JournalFontFamily })}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-800 text-xs"
              >
                {JOURNAL_FONTS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </select>

              {/* Font Size */}
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-stone-200">
                <span className="text-stone-400 text-[10px]">Size:</span>
                <input
                  type="number"
                  min="12"
                  max="64"
                  value={selectedElement.fontSize || 18}
                  onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                  className="w-12 text-xs border-none outline-none font-semibold text-center"
                />
              </div>

              {/* Text Styles (Bold, Italic, Underline) */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200">
                <button
                  type="button"
                  onClick={() => updateSelected({ fontWeight: selectedElement.fontWeight === "bold" ? "normal" : "bold" })}
                  className={`p-1.5 rounded ${selectedElement.fontWeight === "bold" ? "bg-amber-100 text-amber-900 font-bold" : "text-stone-600"}`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic" })}
                  className={`p-1.5 rounded ${selectedElement.fontStyle === "italic" ? "bg-amber-100 text-amber-900 font-bold" : "text-stone-600"}`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ textDecoration: selectedElement.textDecoration === "underline" ? "none" : "underline" })}
                  className={`p-1.5 rounded ${selectedElement.textDecoration === "underline" ? "bg-amber-100 text-amber-900 font-bold" : "text-stone-600"}`}
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Alignment */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-stone-200">
                <button
                  type="button"
                  onClick={() => updateSelected({ textAlign: "left" })}
                  className={`p-1.5 rounded ${selectedElement.textAlign === "left" ? "bg-amber-100 text-amber-900" : "text-stone-600"}`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ textAlign: "center" })}
                  className={`p-1.5 rounded ${selectedElement.textAlign === "center" ? "bg-amber-100 text-amber-900" : "text-stone-600"}`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ textAlign: "right" })}
                  className={`p-1.5 rounded ${selectedElement.textAlign === "right" ? "bg-amber-100 text-amber-900" : "text-stone-600"}`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Text Color Picker */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-stone-200">
                <span className="text-stone-400 text-[10px]">Color:</span>
                <input
                  type="color"
                  value={selectedElement.color || "#1c1917"}
                  onChange={(e) => updateSelected({ color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
                />
              </div>

              {/* Highlight / Card Background */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-stone-200">
                <span className="text-stone-400 text-[10px]">Card:</span>
                <button
                  type="button"
                  onClick={() => updateSelected({ backgroundColor: undefined })}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ backgroundColor: "#fef9c3", borderColor: "#fef08a", borderWidth: 1 })}
                  className="w-4 h-4 rounded-full bg-yellow-200 border border-yellow-400"
                  title="Yellow Sticky"
                />
                <button
                  type="button"
                  onClick={() => updateSelected({ backgroundColor: "#fce7f3", borderColor: "#fbcfe8", borderWidth: 1 })}
                  className="w-4 h-4 rounded-full bg-pink-200 border border-pink-400"
                  title="Pink Sticky"
                />
                <button
                  type="button"
                  onClick={() => updateSelected({ backgroundColor: "#e0f2fe", borderColor: "#bae6fd", borderWidth: 1 })}
                  className="w-4 h-4 rounded-full bg-sky-200 border border-sky-400"
                  title="Blue Sticky"
                />
              </div>

            </div>
          )}

          {/* Photo Frame Controls for Images */}
          {selectedElement.type === "image" && (
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <span className="text-stone-500 font-medium">Photo Style:</span>
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-stone-200">
                  <button
                    type="button"
                    onClick={() => updateSelected({ photoStyle: "polaroid" })}
                    className={`px-2 py-1 rounded ${selectedElement.photoStyle === "polaroid" ? "bg-amber-100 text-amber-900 font-bold" : "text-stone-600"}`}
                  >
                    📸 Polaroid
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelected({ photoStyle: "tape" })}
                    className={`px-2 py-1 rounded ${selectedElement.photoStyle === "tape" ? "bg-amber-100 text-amber-900 font-bold" : "text-stone-600"}`}
                  >
                    🏷️ Taped Corners
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelected({ photoStyle: "border" })}
                    className={`px-2 py-1 rounded ${selectedElement.photoStyle === "border" ? "bg-amber-100 text-amber-900 font-bold" : "text-stone-600"}`}
                  >
                    🖼️ Bordered
                  </button>
                </div>
              </div>

              {/* Caption input */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={selectedElement.caption || ""}
                  onChange={(e) => updateSelected({ caption: e.target.value })}
                  placeholder="Handwritten caption for polaroid..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-['Caveat'] text-stone-800 placeholder:text-stone-400"
                />
              </div>
            </div>
          )}

          {/* Stamp Controls */}
          {selectedElement.type === "stamp" && (
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <span className="text-stone-500 font-medium">Text:</span>
                <input
                  type="text"
                  value={selectedElement.stampText || selectedElement.content || ""}
                  onChange={(e) =>
                    updateSelected({
                      stampText: e.target.value.toUpperCase(),
                      content: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Stamp text..."
                  className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs font-mono uppercase"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-stone-500 font-medium">Ink:</span>
                <input
                  type="color"
                  value={selectedElement.stampColor || "#b91c1c"}
                  onChange={(e) => updateSelected({ stampColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                />
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-stone-200">
                <button
                  type="button"
                  onClick={() => updateSelected({ stampVariant: "rect", width: 148, height: 60 })}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    selectedElement.stampVariant !== "circle"
                      ? "bg-amber-100 text-amber-900 font-bold"
                      : "text-stone-600"
                  }`}
                >
                  Rectangular
                </button>
                <button
                  type="button"
                  onClick={() => updateSelected({ stampVariant: "circle", width: 96, height: 96 })}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    selectedElement.stampVariant === "circle"
                      ? "bg-amber-100 text-amber-900 font-bold"
                      : "text-stone-600"
                  }`}
                >
                  Circular
                </button>
              </div>
            </div>
          )}

          {/* Quote Card Controls */}
          {selectedElement.type === "quote_card" && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-stone-500 font-medium w-14">Quote:</span>
                <input
                  type="text"
                  value={selectedElement.content || ""}
                  onChange={(e) => updateSelected({ content: e.target.value })}
                  placeholder="Inspirational reflection or quote..."
                  className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 font-medium w-14">Author:</span>
                <input
                  type="text"
                  value={selectedElement.caption || ""}
                  onChange={(e) => updateSelected({ caption: e.target.value })}
                  placeholder="Author or note source..."
                  className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 font-medium w-14">Theme:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateSelected({
                        backgroundColor: "#fef9c3",
                        borderColor: "#fde047",
                        color: "#78350f",
                      })
                    }
                    className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-medium"
                  >
                    Parchment
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelected({
                        backgroundColor: "#ecfdf5",
                        borderColor: "#a7f3d0",
                        color: "#065f46",
                      })
                    }
                    className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-medium"
                  >
                    Sage
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelected({
                        backgroundColor: "#fff1f2",
                        borderColor: "#fecdd3",
                        color: "#9f1239",
                      })
                    }
                    className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-900 text-[10px] font-medium"
                  >
                    Rose
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelected({
                        backgroundColor: "#eef2ff",
                        borderColor: "#c7d2fe",
                        color: "#3730a3",
                      })
                    }
                    className="px-2 py-0.5 rounded bg-indigo-100 border border-indigo-300 text-indigo-900 text-[10px] font-medium"
                  >
                    Indigo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sticker Size Controls */}
          {selectedElement.type === "sticker" && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-stone-500 font-medium">Sticker Size:</span>
              <input
                type="range"
                min="20"
                max="80"
                value={selectedElement.fontSize || 36}
                onChange={(e) =>
                  updateSelected({
                    fontSize: Number(e.target.value),
                    width: Number(e.target.value) + 12,
                    height: Number(e.target.value) + 12,
                  })
                }
                className="w-32 accent-amber-500 cursor-pointer"
              />
              <span className="text-stone-600 font-mono text-[11px]">
                {selectedElement.fontSize || 36}px
              </span>
            </div>
          )}

          {/* Tape Color Controls */}
          {selectedElement.type === "tape" && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-stone-500 font-medium">Tape Color:</span>
              <div className="flex items-center gap-1">
                {WASHI_TAPE_COLORS.map((tape) => (
                  <button
                    key={tape.id}
                    type="button"
                    onClick={() => updateSelected({ tapeColor: tape.bg })}
                    className={`w-5 h-4 rounded-xs border ${tape.bg} hover:scale-110 transition-transform`}
                    title={tape.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rotation and Angle Slider for all elements */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-stone-500 font-medium flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5" />
              Rotation:
            </span>
            <input
              type="range"
              min="-45"
              max="45"
              value={selectedElement.rotation || 0}
              onChange={(e) => updateSelected({ rotation: Number(e.target.value) })}
              className="w-36 accent-amber-500 cursor-pointer"
            />
            <span className="text-stone-600 font-mono w-10">
              {selectedElement.rotation || 0}&deg;
            </span>
            <button
              type="button"
              onClick={() => updateSelected({ rotation: 0 })}
              className="text-[10px] text-stone-500 underline"
            >
              Reset Angle
            </button>
          </div>

        </div>
      ) : (
        <div className="text-xs text-stone-400 italic flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
          <span>Click any element on the paper to adjust its rotation, font, colors, layer, or delete it.</span>
        </div>
      )}

      {/* Preset Templates Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-stone-200 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <h3 className="text-lg font-bold font-['Newsreader'] italic text-stone-900">
                  Select a Journal Preset Style
                </h3>
                <p className="text-xs text-stone-500">
                  Choose an initial aesthetic layout. You can still customize everything afterward!
                </p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {JOURNAL_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => {
                    onApplyTemplate(tpl);
                    setShowTemplateModal(false);
                  }}
                  className="p-4 rounded-2xl border border-stone-200 hover:border-amber-400 bg-stone-50/50 hover:bg-amber-50/50 cursor-pointer transition-all space-y-2 group text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{tpl.badge}</span>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-900 font-['Plus_Jakarta_Sans']">
                        {tpl.name}
                      </h4>
                      <span className="text-[10px] text-stone-400">
                        {tpl.paperStyle.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="text-right pt-2 border-t border-stone-100">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Quote Card Creation Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Quote className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold font-['Newsreader'] italic text-stone-900">
                  Add Inspirational Quote Card
                </h3>
              </div>
              <button
                onClick={() => setShowQuoteModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 block mb-1">
                  Quote Text
                </label>
                <textarea
                  rows={3}
                  value={quoteTextInput}
                  onChange={(e) => setQuoteTextInput(e.target.value)}
                  placeholder="&quot;Write your favorite affirmation, quote, or key memory...&quot;"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-800 outline-none focus:ring-2 focus:ring-amber-500 font-['Newsreader'] italic text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 block mb-1">
                  Author / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={quoteAuthorInput}
                  onChange={(e) => setQuoteAuthorInput(e.target.value)}
                  placeholder="e.g., Marcus Aurelius, or Grandma's advice"
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-800 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 block mb-1.5">
                  Card Theme
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuoteTheme("parchment")}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      quoteTheme === "parchment"
                        ? "border-amber-400 bg-amber-100/70 ring-2 ring-amber-400"
                        : "border-stone-200 bg-amber-50 text-stone-700"
                    }`}
                  >
                    <span className="text-xs font-medium text-amber-900 block">Parchment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteTheme("sage")}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      quoteTheme === "sage"
                        ? "border-emerald-400 bg-emerald-100/70 ring-2 ring-emerald-400"
                        : "border-stone-200 bg-emerald-50 text-stone-700"
                    }`}
                  >
                    <span className="text-xs font-medium text-emerald-900 block">Sage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteTheme("rose")}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      quoteTheme === "rose"
                        ? "border-rose-400 bg-rose-100/70 ring-2 ring-rose-400"
                        : "border-stone-200 bg-rose-50 text-stone-700"
                    }`}
                  >
                    <span className="text-xs font-medium text-rose-900 block">Rose</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteTheme("indigo")}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      quoteTheme === "indigo"
                        ? "border-indigo-400 bg-indigo-100/70 ring-2 ring-indigo-400"
                        : "border-stone-200 bg-indigo-50 text-stone-700"
                    }`}
                  >
                    <span className="text-xs font-medium text-indigo-900 block">Indigo</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!quoteTextInput.trim()}
                onClick={handleAddQuoteCard}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-40 transition-colors"
              >
                Place on Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Design Suggestion Modal */}
      {showAiDesignModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-['Newsreader'] italic text-stone-900">
                    Gemini AI Design Assistant
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Aesthetic recommendations tailored to your journal entry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAiDesignModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiDesignError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiDesignError}</span>
              </div>
            ) : aiDesignSuggestion ? (
              <div className="space-y-3">
                {/* Mood Tag */}
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      Recommended Aesthetic
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white font-semibold text-amber-800 border border-amber-200">
                      {aiDesignSuggestion.suggestedMood}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-stone-900 font-['Newsreader'] italic">
                    {aiDesignSuggestion.themeName}
                  </p>
                </div>

                {/* Recommendations Grid */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-500">Paper Texture:</span>
                    <span className="font-semibold text-stone-800">
                      {PAPER_STYLES.find((p) => p.id === aiDesignSuggestion.paperStyle)?.label ||
                        aiDesignSuggestion.paperStyle}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-500">Typography:</span>
                    <span className="font-semibold text-stone-800">
                      {aiDesignSuggestion.primaryFont}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-stone-100">
                    <span className="text-stone-500">Suggested Stickers:</span>
                    <div className="flex items-center gap-1.5 text-lg">
                      {aiDesignSuggestion.stickers?.map((stk, idx) => (
                        <span key={idx} className="hover:scale-125 transition-transform">
                          {stk}
                        </span>
                      ))}
                    </div>
                  </div>

                  {aiDesignSuggestion.accentColor && (
                    <div className="flex items-center justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Accent Color:</span>
                      <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-stone-300"
                          style={{ backgroundColor: aiDesignSuggestion.accentColor }}
                        />
                        <span className="font-mono text-[11px]">{aiDesignSuggestion.accentColor}</span>
                      </div>
                    </div>
                  )}

                  {aiDesignSuggestion.designRationale && (
                    <div className="pt-1">
                      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                        Design Rationale
                      </span>
                      <p className="text-[11px] text-stone-600 leading-relaxed mt-0.5">
                        {aiDesignSuggestion.designRationale}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowAiDesignModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
              >
                Close
              </button>
              {aiDesignSuggestion && (
                <button
                  type="button"
                  onClick={handleApplyAiDesign}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply Recommendations</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
