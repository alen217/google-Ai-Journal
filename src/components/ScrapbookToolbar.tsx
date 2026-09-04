import React, { useState, useRef } from "react";
import { 
  ScrapbookLayout, 
  ScrapbookElement, 
  PaperStyle, 
  JournalFontFamily 
} from "../types";
import { 
  PAPER_STYLES, 
  JOURNAL_FONTS, 
  WASHI_TAPE_COLORS, 
  STICKER_PACKS, 
  JOURNAL_TEMPLATES,
  JournalTemplate
} from "../lib/scrapbookConstants";
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
  HelpCircle
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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
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
          caption: "Cherished snapshot ✨",
          photoStyle: "polaroid",
        };
        onChangeLayout({
          ...layout,
          elements: [...layout.elements, newPhoto],
        });
        onSelectElement(newPhoto.id);
      };
      reader.readAsDataURL(file);
    }
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

          {/* Templates Presets Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" />
            <span>Journal Presets</span>
          </button>

        </div>

        {/* Paper Style Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-stone-600 flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-amber-600" />
            Paper:
          </label>
          <select
            value={layout.paperStyle}
            onChange={(e) => handlePaperStyleChange(e.target.value as PaperStyle)}
            className="px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            {PAPER_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.icon} {style.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Selected Element Property Inspector (Contextual) */}
      {selectedElement ? (
        <div className="p-3.5 rounded-xl bg-stone-50/90 border border-amber-200/80 space-y-3 animate-fade-in">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                {selectedElement.type === "text" && "📝 Text Block Styling"}
                {selectedElement.type === "image" && "📷 Photo & Polaroid Frame"}
                {selectedElement.type === "sticker" && "⭐ Sticker Stamp"}
                {selectedElement.type === "tape" && "🏷️ Washi Tape Strip"}
                {selectedElement.type === "ai_card" && "✨ Gemini Reflection Card"}
              </span>
              <span className="text-[11px] text-stone-400">
                Layer: {selectedElement.zIndex || 10}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSelectElement(null)}
              className="text-xs text-stone-400 hover:text-stone-700"
            >
              Deselect
            </button>
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

    </div>
  );
};
