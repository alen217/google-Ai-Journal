import React, { useState, useEffect, useRef } from "react";
import {
  ScrapbookDoc,
  ScrapbookElement,
  ScrapbookTemplateId,
  MemoryCategory,
  ReflectionDoc,
  UserProfile,
  PaperStyle,
  JournalFontFamily,
} from "../types";
import {
  SCRAPBOOK_TEMPLATES,
  STICKER_LIBRARY,
  WASHI_TAPES,
  STOCK_MEMORY_PHOTOS,
  buildLayoutForTemplate,
  generateAIScrapbook,
  createFallbackScrapbook,
  getReflectionText,
} from "../lib/scrapbookService";
import {
  saveScrapbookDoc,
  fetchUserScrapbooks,
  deleteScrapbookDoc,
} from "../lib/firebase";
import { validateAndReadImageFile, sanitizeImageUrl } from "../lib/fileSecurity";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import {
  Sparkles,
  Image as ImageIcon,
  Type,
  Sticker,
  Bookmark,
  Share2,
  Trash2,
  Copy,
  RotateCw,
  Plus,
  ArrowLeft,
  Eye,
  Edit3,
  Download,
  Save,
  Palette,
  Check,
  MapPin,
  Calendar,
  Lock,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkle,
  X,
  Compass,
  Smile,
  BookOpen,
} from "lucide-react";

interface ScrapbookViewProps {
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  initialReflection?: ReflectionDoc | null;
  onNavigateToGraph?: (entityName?: string) => void;
  onNavigateBack: () => void;
  onOpenReflection?: (doc: ReflectionDoc) => void;
}

export const ScrapbookView: React.FC<ScrapbookViewProps> = ({
  userProfile,
  reflections,
  initialReflection,
  onNavigateToGraph,
  onNavigateBack,
  onOpenReflection,
}) => {
  // Saved scrapbooks gallery state
  const [scrapbooks, setScrapbooks] = useState<ScrapbookDoc[]>([]);
  const [activeScrapbook, setActiveScrapbook] = useState<ScrapbookDoc | null>(null);
  const [selectedReflectionForNew, setSelectedReflectionForNew] = useState<ReflectionDoc | null>(
    initialReflection || reflections[0] || null
  );

  // Editor states
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modals & Drawers
  const [activeTab, setActiveTab] = useState<"editor" | "gallery">("editor");
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showOriginalDocModal, setShowOriginalDocModal] = useState(false);
  const [activePhotoCategory, setActivePhotoCategory] = useState<MemoryCategory>("travel");
  const [customPhotoUrl, setCustomPhotoUrl] = useState("");

  // Canvas container ref for interaction
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrapbookToDelete, setScrapbookToDelete] = useState<ScrapbookDoc | null>(null);
  const [isDeletingScrapbook, setIsDeletingScrapbook] = useState(false);

  // Load existing scrapbooks on mount
  useEffect(() => {
    let isMounted = true;
    async function loadScrapbooks() {
      try {
        const list = await fetchUserScrapbooks(userProfile.uid);
        if (isMounted) {
          setScrapbooks(list);
          if (initialReflection) {
            // Find existing scrapbook for this reflection or auto-generate
            const existing = list.find((s) => s.sourceReflectionId === initialReflection.id);
            if (existing) {
              setActiveScrapbook(existing);
            } else {
              handleCreateAIScrapbook(initialReflection);
            }
          } else if (list.length > 0) {
            setActiveScrapbook(list[0]);
          } else if (reflections.length > 0) {
            handleCreateAIScrapbook(reflections[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch scrapbooks:", err);
      }
    }
    loadScrapbooks();
    return () => {
      isMounted = false;
    };
  }, [userProfile.uid, initialReflection]);

  // Create an AI Scrapbook from a reflection
  const handleCreateAIScrapbook = async (reflection: ReflectionDoc, templateId?: ScrapbookTemplateId) => {
    setIsGeneratingAI(true);
    setSaveError(null);
    try {
      let doc: ScrapbookDoc;
      if (userProfile.privacyAISettings?.aiAnalysisEnabled !== false) {
        doc = await generateAIScrapbook(reflection, templateId);
      } else {
        doc = createFallbackScrapbook(reflection, templateId);
      }

      setActiveScrapbook(doc);
      setActiveTab("editor");
      // Auto save newly generated scrapbook
      await saveScrapbookDoc(userProfile.uid, doc);
      setScrapbooks((prev) => [doc, ...prev.filter((s) => s.id !== doc.id)]);
    } catch (err: any) {
      console.error("Failed to generate AI scrapbook:", err);
      setSaveError("Failed to generate AI Scrapbook. Created local draft instead.");
      const fallback = createFallbackScrapbook(reflection, templateId);
      setActiveScrapbook(fallback);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Switch template for current scrapbook
  const handleSwitchTemplate = (newTemplateId: ScrapbookTemplateId) => {
    if (!activeScrapbook) return;
    const sourceRef = reflections.find((r) => r.id === activeScrapbook.sourceReflectionId);
    const text = sourceRef ? getReflectionText(sourceRef) : activeScrapbook.metadata.mainEvent || "";

    // Keep user's custom images if any
    const existingPhotos = activeScrapbook.elements
      .filter((e) => e.type === "image" && e.imageUrl)
      .map((e) => e.imageUrl as string);

    const { elements, paperStyle } = buildLayoutForTemplate(
      newTemplateId,
      activeScrapbook.title,
      activeScrapbook.date,
      text,
      activeScrapbook.metadata,
      existingPhotos
    );

    const updated: ScrapbookDoc = {
      ...activeScrapbook,
      template: newTemplateId,
      paperStyle,
      elements,
      updatedAt: new Date().toISOString(),
    };

    setActiveScrapbook(updated);
    setShowTemplateModal(false);
  };

  // Save current scrapbook
  const handleSave = async () => {
    if (!activeScrapbook) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveScrapbookDoc(userProfile.uid, activeScrapbook);
      setSaveSuccess(true);
      setScrapbooks((prev) => [
        activeScrapbook,
        ...prev.filter((s) => s.id !== activeScrapbook.id),
      ]);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error("Failed to save scrapbook:", err);
      setSaveError(err.message || "Failed to save scrapbook");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete scrapbook with confirmation modal
  const handleOpenDeleteScrapbook = (scrapbook: ScrapbookDoc, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScrapbookToDelete(scrapbook);
  };

  const handleConfirmDeleteScrapbook = async () => {
    if (!scrapbookToDelete) return;
    setIsDeletingScrapbook(true);
    try {
      await deleteScrapbookDoc(userProfile.uid, scrapbookToDelete.id);
      const remaining = scrapbooks.filter((s) => s.id !== scrapbookToDelete.id);
      setScrapbooks(remaining);
      if (activeScrapbook?.id === scrapbookToDelete.id) {
        setActiveScrapbook(remaining.length > 0 ? remaining[0] : null);
      }
      setScrapbookToDelete(null);
    } catch (err) {
      console.error("Failed to delete scrapbook:", err);
    } finally {
      setIsDeletingScrapbook(false);
    }
  };

  // Element manipulations
  const updateElement = (id: string, updates: Partial<ScrapbookElement>) => {
    if (!activeScrapbook) return;
    const nextElements = activeScrapbook.elements.map((el) => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    });
    setActiveScrapbook({ ...activeScrapbook, elements: nextElements });
  };

  const removeElement = (id: string) => {
    if (!activeScrapbook) return;
    const nextElements = activeScrapbook.elements.filter((el) => el.id !== id);
    setActiveScrapbook({ ...activeScrapbook, elements: nextElements });
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const duplicateElement = (id: string) => {
    if (!activeScrapbook) return;
    const target = activeScrapbook.elements.find((el) => el.id === id);
    if (!target) return;
    const newEl: ScrapbookElement = {
      ...target,
      id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      x: target.x + 24,
      y: target.y + 24,
      zIndex: activeScrapbook.elements.length + 1,
    };
    setActiveScrapbook({
      ...activeScrapbook,
      elements: [...activeScrapbook.elements, newEl],
    });
    setSelectedElementId(newEl.id);
  };

  const bringToFront = (id: string) => {
    if (!activeScrapbook) return;
    const maxZ = Math.max(...activeScrapbook.elements.map((e) => e.zIndex || 1), 1);
    updateElement(id, { zIndex: maxZ + 1 });
  };

  const sendToBack = (id: string) => {
    if (!activeScrapbook) return;
    const minZ = Math.min(...activeScrapbook.elements.map((e) => e.zIndex || 1), 1);
    updateElement(id, { zIndex: Math.max(0, minZ - 1) });
  };

  // Add new elements
  const handleAddText = () => {
    if (!activeScrapbook) return;
    const newId = `elem_text_${Date.now()}`;
    const newElement: ScrapbookElement = {
      id: newId,
      type: "text",
      x: 100,
      y: 150,
      width: 300,
      height: 120,
      rotation: -1,
      zIndex: (activeScrapbook.elements.length || 0) + 1,
      content: "Type your heartfelt thought here...",
      fontFamily: "Kalam",
      fontSize: 18,
      color: "#292524",
    };
    setActiveScrapbook({
      ...activeScrapbook,
      elements: [...activeScrapbook.elements, newElement],
    });
    setSelectedElementId(newId);
  };

  const handleAddQuoteCard = () => {
    if (!activeScrapbook) return;
    const newId = `elem_quote_${Date.now()}`;
    const newElement: ScrapbookElement = {
      id: newId,
      type: "quote_card",
      x: 120,
      y: 180,
      width: 320,
      height: 140,
      rotation: 2,
      zIndex: (activeScrapbook.elements.length || 0) + 1,
      content: '"A quiet moment that stayed in my heart forever."',
      cardVariant: "highlight",
      style: {
        fontFamily: "Newsreader",
        fontStyle: "italic",
        fontSize: 16,
        color: "#451a03",
        backgroundColor: "#fef3c7",
        borderColor: "#fde68a",
        borderWidth: 1,
        borderRadius: 12,
      },
    };
    setActiveScrapbook({
      ...activeScrapbook,
      elements: [...activeScrapbook.elements, newElement],
    });
    setSelectedElementId(newId);
  };

  const handleAddSticker = (emoji: string) => {
    if (!activeScrapbook) return;
    const newId = `elem_sticker_${Date.now()}`;
    const newElement: ScrapbookElement = {
      id: newId,
      type: "sticker",
      x: 200 + Math.random() * 80,
      y: 200 + Math.random() * 80,
      width: 52,
      height: 52,
      rotation: Math.floor(Math.random() * 30) - 15,
      zIndex: (activeScrapbook.elements.length || 0) + 1,
      content: emoji,
    };
    setActiveScrapbook({
      ...activeScrapbook,
      elements: [...activeScrapbook.elements, newElement],
    });
    setSelectedElementId(newId);
    setShowStickerPicker(false);
  };

  const handleAddWashiTape = (tapeColor: string) => {
    if (!activeScrapbook) return;
    const newId = `elem_tape_${Date.now()}`;
    const newElement: ScrapbookElement = {
      id: newId,
      type: "tape",
      x: 180,
      y: 140,
      width: 140,
      height: 28,
      rotation: Math.floor(Math.random() * 8) - 4,
      zIndex: (activeScrapbook.elements.length || 0) + 1,
      tapeColor,
    };
    setActiveScrapbook({
      ...activeScrapbook,
      elements: [...activeScrapbook.elements, newElement],
    });
    setSelectedElementId(newId);
  };

  const handleAddPhoto = (url: string, caption?: string) => {
    if (!activeScrapbook) return;
    const sanitized = sanitizeImageUrl(url);
    if (!sanitized.ok || !sanitized.safeUrl) {
      alert(sanitized.error || "Invalid or unsafe image URL.");
      return;
    }
    const newId = `elem_photo_${Date.now()}`;
    const newElement: ScrapbookElement = {
      id: newId,
      type: "image",
      x: 140,
      y: 160,
      width: 320,
      height: 280,
      rotation: Math.floor(Math.random() * 6) - 3,
      zIndex: (activeScrapbook.elements.length || 0) + 1,
      imageUrl: sanitized.safeUrl,
      caption: caption || "Captured Memory",
      photoStyle: "polaroid",
    };
    setActiveScrapbook({
      ...activeScrapbook,
      elements: [...activeScrapbook.elements, newElement],
    });
    setSelectedElementId(newId);
    setShowPhotoPicker(false);
    setCustomPhotoUrl("");
  };

  // Native file upload for photo with security validation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = await validateAndReadImageFile(file);
      if (!validation.ok || !validation.dataUrl) {
        alert(validation.error || "Invalid image file. Please upload JPEG, PNG, WebP, or GIF under 5MB.");
        e.target.value = "";
        return;
      }
      handleAddPhoto(validation.dataUrl, validation.sanitizedName || file.name.replace(/\.[^/.]+$/, ""));
      e.target.value = "";
    }
  };

  // Apply an AI suggestion
  const handleApplySuggestion = (sugId: string) => {
    if (!activeScrapbook) return;
    const sug = activeScrapbook.aiSuggestions.find((s) => s.id === sugId);
    if (!sug) return;

    if (sug.type === "connect_graph" && onNavigateToGraph) {
      onNavigateToGraph(activeScrapbook.metadata.location || activeScrapbook.metadata.peopleMentioned?.[0] || activeScrapbook.title);
      return;
    }

    if (sug.type === "add_moment") {
      handleAddQuoteCard();
    } else if (sug.type === "collage") {
      handleAddPhoto(STOCK_MEMORY_PHOTOS.travel[0], "Collage photo 1");
      handleAddPhoto(STOCK_MEMORY_PHOTOS.travel[1], "Collage photo 2");
    } else if (sug.type === "add_location") {
      const newEl: ScrapbookElement = {
        id: `loc_${Date.now()}`,
        type: "badge",
        x: 48,
        y: 110,
        width: 220,
        height: 40,
        rotation: 0,
        zIndex: 10,
        content: `📍 ${activeScrapbook.metadata.location || "Exploration"}`,
        stampVariant: "badge",
        style: {
          backgroundColor: "#ecfdf5",
          color: "#047857",
          borderColor: "#a7f3d0",
          borderWidth: 1,
          borderRadius: 20,
          fontWeight: "bold",
          fontSize: 13,
        },
      };
      setActiveScrapbook({
        ...activeScrapbook,
        elements: [...activeScrapbook.elements, newEl],
      });
    }

    // Mark as applied
    const nextSugs = activeScrapbook.aiSuggestions.map((s) =>
      s.id === sugId ? { ...s, applied: true } : s
    );
    setActiveScrapbook({ ...activeScrapbook, aiSuggestions: nextSugs });
  };

  // Canvas Mouse / Touch drag handlers
  const handleElementMouseDown = (e: React.MouseEvent, element: ScrapbookElement) => {
    e.stopPropagation();
    setSelectedElementId(element.id);
    setDraggingId(element.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current || !activeScrapbook) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.min(canvasRect.width - 100, e.clientX - canvasRect.left - dragOffset.x));
    const newY = Math.max(10, Math.min(canvasRect.height - 80, e.clientY - canvasRect.top - dragOffset.y));

    updateElement(draggingId, { x: Math.round(newX), y: Math.round(newY) });
  };

  const handleCanvasMouseUp = () => {
    setDraggingId(null);
  };

  // Background Paper Texture classes
  const getPaperBgStyle = (style: PaperStyle): string => {
    switch (style) {
      case "kraft_paper":
        return "bg-[#d7be9b] text-stone-900 border-[#bfa27a] shadow-inner";
      case "dot_grid":
        return "bg-[#fcfaf7] bg-[radial-gradient(#d6d3d1_1px,transparent_1px)] [background-size:16px_16px] text-stone-900 border-stone-200";
      case "ruled_notebook":
        return "bg-[#faf9f5] bg-[linear-gradient(transparent_27px,#e5e5e5_28px)] [background-size:100%_28px] text-stone-900 border-stone-200";
      case "grid_graph":
        return "bg-[#f8fafc] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] text-stone-900 border-slate-200";
      case "watercolor_blush":
        return "bg-gradient-to-br from-rose-50 via-amber-50 to-pink-50 text-stone-900 border-rose-200";
      case "vintage_parchment":
        return "bg-[#f5ecd7] text-stone-900 border-[#decbb0]";
      case "cream_linen":
      default:
        return "bg-[#fbf9f4] text-stone-900 border-stone-200 shadow-sm";
    }
  };

  const selectedElement = activeScrapbook?.elements.find((e) => e.id === selectedElementId);
  const sourceReflection = reflections.find((r) => r.id === activeScrapbook?.sourceReflectionId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="p-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 shadow-xs transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h1 className="text-2xl font-bold font-['Playfair_Display'] text-stone-900">
                AI Memory Scrapbook
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                Visual Studio
              </span>
            </div>
            <p className="text-xs text-stone-500 font-['Plus_Jakarta_Sans']">
              Transform your reflections into beautiful, editable visual scrapbook pages.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-stone-200/80 p-1 rounded-xl border border-stone-300/60 shadow-xs">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "editor"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Canvas Editor</span>
            </button>
            <button
              onClick={() => setActiveTab("gallery")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "gallery"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Scrapbook Album ({scrapbooks.length})</span>
            </button>
          </div>

          {/* New Scrapbook from Journal Dropdown */}
          <button
            onClick={() => {
              if (selectedReflectionForNew) {
                handleCreateAIScrapbook(selectedReflectionForNew);
              }
            }}
            disabled={isGeneratingAI || !selectedReflectionForNew}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
          >
            <Sparkles className={`w-4 h-4 text-amber-200 ${isGeneratingAI ? "animate-spin" : ""}`} />
            <span>{isGeneratingAI ? "Crafting Memory..." : "✨ Create AI Scrapbook"}</span>
          </button>

          {/* Save & Delete Buttons */}
          {activeScrapbook && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleOpenDeleteScrapbook(activeScrapbook)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-stone-200 hover:border-rose-200 transition-all flex items-center gap-1.5 active:scale-95"
                title="Delete this scrapbook page"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Delete Page</span>
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 ${
                  saveSuccess
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-900 hover:bg-stone-800 text-stone-50"
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>{isSaving ? "Saving..." : "Save Page"}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GALLERY TAB */}
      {activeTab === "gallery" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-stone-900">Your Scrapbook Collection</h2>
              <p className="text-xs text-stone-500">Visual memory stories crafted from your journal.</p>
            </div>
            <span className="text-xs font-medium text-stone-500">
              {scrapbooks.length} saved {scrapbooks.length === 1 ? "page" : "pages"}
            </span>
          </div>

          {scrapbooks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                📖
              </div>
              <h3 className="text-lg font-bold text-stone-800">No Scrapbook Pages Yet</h3>
              <p className="text-sm text-stone-500 max-w-md mx-auto">
                Pick an existing journal reflection to generate your first visual memory page with photos, quotes, and washi tapes.
              </p>
              {reflections.length > 0 && (
                <button
                  onClick={() => handleCreateAIScrapbook(reflections[0])}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-xs transition-all inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create from "{reflections[0].title || "Recent Entry"}"</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scrapbooks.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => {
                    setActiveScrapbook(sc);
                    setActiveTab("editor");
                  }}
                  className="group bg-white rounded-2xl border border-stone-200 hover:border-amber-400 p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Preview Thumbnail */}
                    <div className="w-full h-44 rounded-xl overflow-hidden mb-3 bg-stone-100 border border-stone-200 relative flex items-center justify-center">
                      {sc.elements.find((e) => e.type === "image" && e.imageUrl)?.imageUrl ? (
                        <img
                          src={sc.elements.find((e) => e.type === "image" && e.imageUrl)?.imageUrl}
                          alt={sc.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-center p-4 text-stone-400">
                          <Palette className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          <span className="text-xs">Artistic Journal Layout</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                        {sc.template.toUpperCase()}
                      </span>
                    </div>

                    <h3 className="font-bold text-stone-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                      {sc.title}
                    </h3>
                    <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>{sc.date}</span>
                      {sc.metadata.location && (
                        <>
                          <span className="mx-1">•</span>
                          <MapPin className="w-3 h-3 text-emerald-500" />
                          <span className="line-clamp-1">{sc.metadata.location}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-stone-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleOpenDeleteScrapbook(sc, e)}
                        className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete scrapbook page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span>{sc.elements.length} items</span>
                    </div>
                    <span className="text-amber-700 group-hover:translate-x-0.5 transition-transform">
                      Open Canvas →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* CANVAS EDITOR TAB */
        <div className="space-y-4">
          {/* Scrapbook Meta & Switcher Bar */}
          <div className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Template selector pill */}
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                <span>Template: {activeScrapbook?.template ? activeScrapbook.template.replace("_", " ").toUpperCase() : "CLASSIC"}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* View Original Entry */}
              {sourceReflection && (
                <button
                  onClick={() => setShowOriginalDocModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium border border-stone-200 flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-stone-500" />
                  <span>View Original Journal Entry</span>
                </button>
              )}

              {/* Connect to Life Graph button */}
              {onNavigateToGraph && (
                <button
                  onClick={() =>
                    onNavigateToGraph(
                      activeScrapbook?.metadata.location ||
                        activeScrapbook?.metadata.peopleMentioned?.[0] ||
                        activeScrapbook?.title
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 flex items-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Explore in Life Graph</span>
                </button>
              )}
            </div>

            {/* Paper Texture Selector */}
            <div className="flex items-center gap-1.5 text-xs text-stone-600">
              <span className="font-semibold hidden sm:inline">Paper:</span>
              {(["cream_linen", "kraft_paper", "dot_grid", "ruled_notebook", "watercolor_blush"] as PaperStyle[]).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => {
                      if (activeScrapbook) {
                        setActiveScrapbook({ ...activeScrapbook, paperStyle: p });
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      activeScrapbook?.paperStyle === p
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {p.replace("_", " ")}
                  </button>
                )
              )}
            </div>
          </div>

          {/* AI Suggestions Chips (if any) */}
          {activeScrapbook && activeScrapbook.aiSuggestions && activeScrapbook.aiSuggestions.length > 0 && (
            <div className="bg-amber-50/70 rounded-2xl border border-amber-200/80 p-3 shadow-2xs flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                AI Enhancements:
              </span>
              {activeScrapbook.aiSuggestions.map((sug) => (
                <button
                  key={sug.id}
                  onClick={() => handleApplySuggestion(sug.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                    sug.applied
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-white text-stone-800 border border-amber-300 hover:bg-amber-100 active:scale-95 shadow-2xs"
                  }`}
                >
                  <span>{sug.applied ? "✓" : "+"}</span>
                  <span>{sug.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* FLOATING CANVAS TOOLBAR */}
          <div className="sticky top-20 z-30 bg-stone-900/95 text-stone-100 backdrop-blur-md rounded-2xl p-2 shadow-lg border border-stone-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1">
              {/* Add Photo */}
              <button
                onClick={() => setShowPhotoPicker(true)}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Photo</span>
              </button>

              {/* Add Note/Text */}
              <button
                onClick={handleAddText}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Type className="w-3.5 h-3.5 text-blue-400" />
                <span>+ Note</span>
              </button>

              {/* Add Quote Card */}
              <button
                onClick={handleAddQuoteCard}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5 text-rose-400" />
                <span>+ Quote Card</span>
              </button>

              {/* Add Sticker */}
              <div className="relative">
                <button
                  onClick={() => setShowStickerPicker((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Sticker className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Sticker</span>
                </button>

                {/* Sticker Popover */}
                {showStickerPicker && (
                  <div className="absolute top-12 left-0 z-50 bg-white text-stone-900 rounded-2xl p-3 shadow-2xl border border-stone-200 w-64 grid grid-cols-6 gap-2">
                    {STICKER_LIBRARY.map((stk) => (
                      <button
                        key={stk.id}
                        onClick={() => handleAddSticker(stk.emoji)}
                        className="w-8 h-8 rounded-lg hover:bg-amber-100 flex items-center justify-center text-lg transition-transform hover:scale-125"
                        title={stk.label}
                      >
                        {stk.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Washi Tape Quick Adder */}
              <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-stone-700">
                <span className="text-[11px] text-stone-400">Tape:</span>
                {WASHI_TAPES.slice(0, 4).map((tape) => (
                  <button
                    key={tape.id}
                    onClick={() => handleAddWashiTape(tape.color)}
                    style={{ backgroundColor: tape.color }}
                    className="w-5 h-4 rounded-xs border border-stone-500/40 hover:scale-110 transition-transform"
                    title={`Add ${tape.label} Washi Tape`}
                  />
                ))}
              </div>
            </div>

            {/* Selected Element Controls */}
            {selectedElement && (
              <div className="flex items-center gap-1 pl-2 border-l border-stone-700">
                <span className="text-[11px] text-amber-400 font-semibold hidden md:inline">
                  {selectedElement.type.toUpperCase()}:
                </span>

                {/* Rotate */}
                <button
                  onClick={() =>
                    updateElement(selectedElement.id, {
                      rotation: ((selectedElement.rotation || 0) + 15) % 360,
                    })
                  }
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200"
                  title="Rotate +15°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                {/* Bring Front */}
                <button
                  onClick={() => bringToFront(selectedElement.id)}
                  className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px]"
                  title="Bring to Front"
                >
                  Front
                </button>

                {/* Send Back */}
                <button
                  onClick={() => sendToBack(selectedElement.id)}
                  className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px]"
                  title="Send to Back"
                >
                  Back
                </button>

                {/* Duplicate */}
                <button
                  onClick={() => duplicateElement(selectedElement.id)}
                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200"
                  title="Duplicate Element"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => removeElement(selectedElement.id)}
                  className="p-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200"
                  title="Delete Element"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* MAIN INTERACTIVE CANVAS */}
          <div
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={() => setSelectedElementId(null)}
            className={`w-full min-h-[680px] rounded-3xl border-2 p-8 relative overflow-hidden transition-all select-none shadow-md ${
              activeScrapbook
                ? getPaperBgStyle(activeScrapbook.paperStyle)
                : "bg-stone-50 border-stone-200"
            }`}
          >
            {/* Visual Tape on Page Top Corners */}
            <div
              style={{ backgroundColor: "rgba(254, 243, 199, 0.85)" }}
              className="absolute -top-3 -left-4 w-28 h-7 -rotate-45 shadow-xs pointer-events-none"
            />
            <div
              style={{ backgroundColor: "rgba(254, 243, 199, 0.85)" }}
              className="absolute -top-3 -right-4 w-28 h-7 rotate-45 shadow-xs pointer-events-none"
            />

            {/* Elements Layer */}
            {activeScrapbook?.elements.map((elem) => {
              const isSelected = selectedElementId === elem.id;

              return (
                <div
                  key={elem.id}
                  onMouseDown={(e) => handleElementMouseDown(e, elem)}
                  style={{
                    position: "absolute",
                    left: `${elem.x}px`,
                    top: `${elem.y}px`,
                    width: elem.width ? `${elem.width}px` : "auto",
                    zIndex: elem.zIndex || 1,
                    transform: `rotate(${elem.rotation || 0}deg)`,
                  }}
                  className={`cursor-grab active:cursor-grabbing transition-shadow group ${
                    isSelected ? "ring-2 ring-amber-500 ring-offset-2 shadow-xl" : ""
                  }`}
                >
                  {/* TEXT ELEMENT */}
                  {elem.type === "text" && (
                    <div
                      style={{
                        fontFamily: elem.style?.fontFamily || elem.fontFamily || "Newsreader",
                        fontSize: `${elem.style?.fontSize || elem.fontSize || 16}px`,
                        fontWeight: elem.style?.fontWeight || elem.fontWeight || "normal",
                        color: elem.style?.color || elem.color || "#292524",
                        backgroundColor: elem.style?.backgroundColor || "transparent",
                        padding: elem.style?.backgroundColor ? "8px 12px" : "4px",
                        borderRadius: elem.style?.borderRadius || 8,
                        borderColor: elem.style?.borderColor || "transparent",
                        borderWidth: elem.style?.borderWidth || 0,
                      }}
                      className="whitespace-pre-wrap leading-relaxed outline-none"
                    >
                      {elem.content}
                    </div>
                  )}

                  {/* IMAGE / POLAROID ELEMENT */}
                  {elem.type === "image" && (
                    <div className="bg-white p-3 pb-5 rounded-lg shadow-md border border-stone-200 flex flex-col items-center">
                      <div className="w-full h-56 overflow-hidden rounded bg-stone-100">
                        <img
                          src={elem.imageUrl}
                          alt={elem.caption || "Scrapbook Memory"}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                      {elem.caption && (
                        <span className="font-['Kalam'] text-sm text-stone-800 mt-2 text-center tracking-wide">
                          {elem.caption}
                        </span>
                      )}
                    </div>
                  )}

                  {/* QUOTE / HIGHLIGHT CARD */}
                  {elem.type === "quote_card" && (
                    <div
                      style={{
                        fontFamily: elem.style?.fontFamily || "Newsreader",
                        fontSize: `${elem.style?.fontSize || 15}px`,
                        fontStyle: elem.style?.fontStyle || "normal",
                        color: elem.style?.color || "#1c1917",
                        backgroundColor: elem.style?.backgroundColor || "#fffbeb",
                        borderColor: elem.style?.borderColor || "#fde68a",
                        borderWidth: elem.style?.borderWidth || 1,
                        borderRadius: elem.style?.borderRadius || 12,
                        padding: "16px",
                      }}
                      className="shadow-sm relative whitespace-pre-wrap"
                    >
                      {/* Decorative Pin */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-xs" />
                      {elem.content}
                    </div>
                  )}

                  {/* STICKER */}
                  {elem.type === "sticker" && (
                    <div className="text-4xl filter drop-shadow-sm hover:scale-110 transition-transform">
                      {elem.content}
                    </div>
                  )}

                  {/* WASHI TAPE */}
                  {elem.type === "tape" && (
                    <div
                      style={{
                        backgroundColor: elem.tapeColor || "rgba(254, 243, 199, 0.85)",
                        width: `${elem.width || 120}px`,
                        height: `${elem.height || 26}px`,
                      }}
                      className="shadow-xs border-y border-white/40"
                    />
                  )}

                  {/* BADGE / STAMP */}
                  {elem.type === "badge" && (
                    <div
                      style={{
                        backgroundColor: elem.style?.backgroundColor || "#ecfdf5",
                        color: elem.style?.color || "#065f46",
                        borderColor: elem.style?.borderColor || "#a7f3d0",
                        borderWidth: elem.style?.borderWidth || 1,
                        borderRadius: elem.style?.borderRadius || 20,
                        padding: "6px 14px",
                        fontSize: elem.style?.fontSize || 13,
                        fontWeight: elem.style?.fontWeight || "bold",
                        fontFamily: elem.style?.fontFamily || "Plus Jakarta Sans",
                      }}
                      className="shadow-xs tracking-wide"
                    >
                      {elem.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TEMPLATE PICKER MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Intelligent Scrapbook Templates</h3>
                <p className="text-xs text-stone-500">
                  Switch the canvas aesthetic while preserving your memories and photos.
                </p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SCRAPBOOK_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSwitchTemplate(tmpl.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    activeScrapbook?.template === tmpl.id
                      ? "bg-amber-50/70 border-amber-500 ring-2 ring-amber-400 shadow-sm"
                      : "bg-stone-50/50 hover:bg-stone-100/70 border-stone-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{tmpl.emoji}</span>
                    <span className="font-bold text-sm text-stone-900">{tmpl.name}</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{tmpl.description}</p>
                  <span className="mt-2 inline-block text-[10px] uppercase font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                    {tmpl.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PICKER MODAL */}
      {showPhotoPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Add Memory Photograph</h3>
                <p className="text-xs text-stone-500">Upload your own photo or choose from curated presets.</p>
              </div>
              <button
                onClick={() => setShowPhotoPicker(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload your own */}
            <div className="mb-6 p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
              <label className="block text-xs font-bold text-amber-900 mb-2">Upload from device:</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
              />
            </div>

            {/* Custom URL */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-stone-700 mb-1">Or paste Image URL:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPhotoUrl}
                  onChange={(e) => setCustomPhotoUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={() => customPhotoUrl && handleAddPhoto(customPhotoUrl, "Photo Memory")}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Curated Presets by Theme */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {(["travel", "achievement", "personal", "celebration"] as MemoryCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActivePhotoCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all ${
                      activePhotoCategory === cat
                        ? "bg-amber-600 text-white"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(STOCK_MEMORY_PHOTOS[activePhotoCategory] || []).map((imgUrl, i) => (
                  <div
                    key={i}
                    onClick={() => handleAddPhoto(imgUrl, `${activePhotoCategory} moment`)}
                    className="h-28 rounded-xl overflow-hidden border border-stone-200 cursor-pointer hover:opacity-90 hover:scale-105 transition-all shadow-2xs"
                  >
                    <img src={imgUrl} alt="Preset" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ORIGINAL JOURNAL ENTRY MODAL */}
      {showOriginalDocModal && sourceReflection && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Original Journal Entry</span>
                <h3 className="text-xl font-bold text-stone-900 font-['Playfair_Display']">
                  {sourceReflection.title || "Untitled Reflection"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">Written on {sourceReflection.date}</p>
              </div>
              <button
                onClick={() => setShowOriginalDocModal(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-sm text-stone-800 font-['Newsreader'] whitespace-pre-wrap leading-relaxed mb-4">
              {getReflectionText(sourceReflection)}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500">
                🔒 Protected by ReflectAI — Original entry remains unchanged.
              </span>
              {onOpenReflection && (
                <button
                  onClick={() => {
                    setShowOriginalDocModal(false);
                    onOpenReflection(sourceReflection);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
                >
                  Edit Reflection in Journal
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Delete Scrapbook Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(scrapbookToDelete)}
        onClose={() => setScrapbookToDelete(null)}
        onConfirm={handleConfirmDeleteScrapbook}
        title="Delete this scrapbook page?"
        itemTitle={scrapbookToDelete?.title}
        message="This will permanently remove this visual scrapbook page. Your original journal entry will not be affected."
        isDeleting={isDeletingScrapbook}
      />
    </div>
  );
};
