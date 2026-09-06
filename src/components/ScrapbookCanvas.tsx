import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  ScrapbookLayout, 
  ScrapbookElement, 
  PaperStyle, 
  JournalFontFamily, 
  ScrapbookElementType 
} from "../types";
import { 
  PAPER_STYLES, 
  JOURNAL_FONTS, 
  WASHI_TAPE_COLORS 
} from "../lib/scrapbookConstants";
import { 
  RotateCw, 
  Move, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Maximize2, 
  Type, 
  Image as ImageIcon, 
  Sparkles, 
  Check, 
  Edit3, 
  ZoomIn, 
  ZoomOut,
  Layers,
  ChevronDown,
  Lock,
  Unlock,
  Quote
} from "lucide-react";

interface ScrapbookCanvasProps {
  layout: ScrapbookLayout;
  onChangeLayout: (newLayout: ScrapbookLayout) => void;
  readOnly?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onImageDrop?: (file: File) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const ScrapbookCanvas: React.FC<ScrapbookCanvasProps> = ({
  layout,
  onChangeLayout,
  readOnly = false,
  selectedElementId: externalSelectedId,
  onSelectElement: externalOnSelect,
  onImageDrop,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    if (externalOnSelect) externalOnSelect(id);
    setInternalSelectedId(id);
  };

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Interaction tracking refs
  const dragRef = useRef<{
    isDragging: boolean;
    isResizing: boolean;
    isRotating: boolean;
    elementId: string | null;
    startX: number;
    startY: number;
    startElemX: number;
    startElemY: number;
    startElemW: number;
    startElemH: number;
    startRotation: number;
    aspectRatio: number;
    canvasRect: DOMRect | null;
  }>({
    isDragging: false,
    isResizing: false,
    isRotating: false,
    elementId: null,
    startX: 0,
    startY: 0,
    startElemX: 0,
    startElemY: 0,
    startElemW: 0,
    startElemH: 0,
    startRotation: 0,
    aspectRatio: 1,
    canvasRect: null,
  });

  const selectedElement = layout.elements.find((el) => el.id === selectedId) || null;
  const paperMeta = PAPER_STYLES.find((p) => p.id === layout.paperStyle) || PAPER_STYLES[0];

  // Keyboard shortcuts (Delete, Esc, Duplicate, Undo, Redo)
  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "textarea" || activeTag === "input") return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleDelete(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        handleDuplicate(selectedId);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          if (onRedo && canRedo) {
            e.preventDefault();
            onRedo();
          }
        } else {
          if (onUndo && canUndo) {
            e.preventDefault();
            onUndo();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, selectedId, canUndo, canRedo, onUndo, onRedo]);

  // -------------------------------------------------------------
  // Pointer & Touch Handlers
  // -------------------------------------------------------------
  const handlePointerDownElement = (
    e: React.PointerEvent,
    element: ScrapbookElement
  ) => {
    if (readOnly) return;
    if (editingTextId === element.id) return; // Don't drag while actively typing
    e.stopPropagation();

    // Select this element
    setSelectedId(element.id);

    if (element.locked) return; // Locked elements cannot be dragged

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    dragRef.current = {
      isDragging: true,
      isResizing: false,
      isRotating: false,
      elementId: element.id,
      startX: e.clientX,
      startY: e.clientY,
      startElemX: element.x,
      startElemY: element.y,
      startElemW: element.width,
      startElemH: element.height,
      startRotation: element.rotation || 0,
      aspectRatio: element.width / (element.height || 1),
      canvasRect,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDownResize = (
    e: React.PointerEvent,
    element: ScrapbookElement
  ) => {
    if (readOnly) return;
    if (element.locked) return;
    e.stopPropagation();

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    dragRef.current = {
      isDragging: false,
      isResizing: true,
      isRotating: false,
      elementId: element.id,
      startX: e.clientX,
      startY: e.clientY,
      startElemX: element.x,
      startElemY: element.y,
      startElemW: element.width,
      startElemH: element.height,
      startRotation: element.rotation || 0,
      aspectRatio: element.width / (element.height || 1),
      canvasRect,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDownRotate = (
    e: React.PointerEvent,
    element: ScrapbookElement
  ) => {
    if (readOnly) return;
    if (element.locked) return;
    e.stopPropagation();

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();

    dragRef.current = {
      isDragging: false,
      isResizing: false,
      isRotating: true,
      elementId: element.id,
      startX: e.clientX,
      startY: e.clientY,
      startElemX: element.x,
      startElemY: element.y,
      startElemW: element.width,
      startElemH: element.height,
      startRotation: element.rotation || 0,
      aspectRatio: 1,
      canvasRect,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragRef.current;
      if (!state.elementId || (!state.isDragging && !state.isResizing && !state.isRotating)) {
        return;
      }

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (state.isDragging) {
        const newX = Math.round(state.startElemX + dx);
        const newY = Math.round(state.startElemY + dy);

        // Keep within reasonable boundaries of canvas
        const boundedX = Math.max(-50, Math.min(layout.canvasWidth - 50, newX));
        const boundedY = Math.max(0, Math.min(layout.canvasHeight - 50, newY));

        onChangeLayout({
          ...layout,
          elements: layout.elements.map((el) =>
            el.id === state.elementId ? { ...el, x: boundedX, y: boundedY } : el
          ),
        });
      } else if (state.isResizing) {
        const currentElem = layout.elements.find((el) => el.id === state.elementId);
        const isImage = currentElem?.type === "image";

        let newW = Math.max(50, Math.round(state.startElemW + dx));
        let newH = Math.max(30, Math.round(state.startElemH + dy));

        // Preserve aspect ratio for images
        if (isImage) {
          newH = Math.round(newW / state.aspectRatio);
        }

        onChangeLayout({
          ...layout,
          elements: layout.elements.map((el) =>
            el.id === state.elementId ? { ...el, width: newW, height: newH } : el
          ),
        });
      } else if (state.isRotating) {
        // Calculate angle relative to center of element
        const currentElem = layout.elements.find((el) => el.id === state.elementId);
        if (currentElem && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const elemCenterX = rect.left + currentElem.x + currentElem.width / 2;
          const elemCenterY = rect.top + currentElem.y + currentElem.height / 2;

          const rad = Math.atan2(e.clientY - elemCenterY, e.clientX - elemCenterX);
          let deg = Math.round((rad * 180) / Math.PI) - 90; // Top is 0deg

          // Snap to 0, 90, 180, -90 if close
          if (Math.abs(deg) < 4) deg = 0;
          if (Math.abs(deg - 90) < 4) deg = 90;
          if (Math.abs(deg + 90) < 4) deg = -90;

          onChangeLayout({
            ...layout,
            elements: layout.elements.map((el) =>
              el.id === state.elementId ? { ...el, rotation: deg } : el
            ),
          });
        }
      }
    },
    [layout, onChangeLayout]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current.elementId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }
      dragRef.current = {
        isDragging: false,
        isResizing: false,
        isRotating: false,
        elementId: null,
        startX: 0,
        startY: 0,
        startElemX: 0,
        startElemY: 0,
        startElemW: 0,
        startElemH: 0,
        startRotation: 0,
        aspectRatio: 1,
        canvasRect: null,
      };
    }
  }, []);

  // -------------------------------------------------------------
  // Drag-and-Drop Image Files onto Canvas
  // -------------------------------------------------------------
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        if (onImageDrop) {
          onImageDrop(file);
        } else {
          // Default reader
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const resultUrl = uploadEvent.target?.result as string;
            const newPhoto: ScrapbookElement = {
              id: `photo_${Date.now()}`,
              type: "image",
              x: 200,
              y: 250,
              width: 260,
              height: 300,
              rotation: Math.floor(Math.random() * 8) - 4,
              zIndex: layout.elements.length + 10,
              imageUrl: resultUrl,
              caption: "Scrapbook snapshot",
              photoStyle: "polaroid",
            };
            onChangeLayout({
              ...layout,
              elements: [...layout.elements, newPhoto],
            });
            setSelectedId(newPhoto.id);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // -------------------------------------------------------------
  // Element Actions (Layer, Delete, Duplicate, Style)
  // -------------------------------------------------------------
  const handleBringToFront = (id: string) => {
    const maxZ = Math.max(...layout.elements.map((el) => el.zIndex || 1), 10);
    onChangeLayout({
      ...layout,
      elements: layout.elements.map((el) =>
        el.id === id ? { ...el, zIndex: maxZ + 1 } : el
      ),
    });
  };

  const handleSendToBack = (id: string) => {
    const minZ = Math.min(...layout.elements.map((el) => el.zIndex || 1), 1);
    onChangeLayout({
      ...layout,
      elements: layout.elements.map((el) =>
        el.id === id ? { ...el, zIndex: Math.max(1, minZ - 1) } : el
      ),
    });
  };

  const handleDuplicate = (id: string) => {
    const target = layout.elements.find((el) => el.id === id);
    if (!target) return;
    const duplicated: ScrapbookElement = {
      ...target,
      id: `${target.type}_${Date.now()}`,
      x: target.x + 25,
      y: target.y + 25,
      zIndex: Math.max(...layout.elements.map((el) => el.zIndex || 1)) + 1,
    };
    onChangeLayout({
      ...layout,
      elements: [...layout.elements, duplicated],
    });
    setSelectedId(duplicated.id);
  };

  const handleDelete = (id: string) => {
    onChangeLayout({
      ...layout,
      elements: layout.elements.filter((el) => el.id !== id),
    });
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleUpdateElement = (id: string, updates: Partial<ScrapbookElement>) => {
    onChangeLayout({
      ...layout,
      elements: layout.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      ),
    });
  };

  // -------------------------------------------------------------
  // Texture and Background CSS Generator
  // -------------------------------------------------------------
  const getPaperBackgroundStyle = (): React.CSSProperties => {
    const baseColor = layout.paperColor || paperMeta.defaultBgColor;

    switch (layout.paperStyle) {
      case "ruled_notebook":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            linear-gradient(90deg, transparent 72px, #f87171 72px, #f87171 74px, transparent 74px),
            repeating-linear-gradient(transparent, transparent 31px, #cbd5e1 31px, #cbd5e1 32px)
          `,
          backgroundSize: "100% 100%, 100% 32px",
        };
      case "dot_grid":
        return {
          backgroundColor: baseColor,
          backgroundImage: `radial-gradient(#94a3b8 1.2px, transparent 1.2px)`,
          backgroundSize: "24px 24px",
        };
      case "grid_graph":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            linear-gradient(to right, rgba(14, 165, 233, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(14, 165, 233, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        };
      case "kraft_paper":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(168, 126, 88, 0.08) 0%, transparent 80%),
            repeating-linear-gradient(45deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 2px, transparent 2px, transparent 4px)
          `,
        };
      case "cream_linen":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(circle at 10% 20%, rgba(217, 182, 140, 0.05) 0%, transparent 40%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0.01) 0px, rgba(0,0,0,0.01) 1px, transparent 1px, transparent 3px)
          `,
        };
      case "soft_rose":
        return {
          backgroundColor: baseColor,
          backgroundImage: `radial-gradient(circle at 80% 10%, rgba(251, 207, 232, 0.35) 0%, transparent 60%)`,
        };
      case "watercolor_blush":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(244, 114, 182, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 85% 80%, rgba(251, 146, 60, 0.15) 0%, transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(253, 230, 138, 0.12) 0%, transparent 70%)
          `,
        };
      case "vintage_parchment":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(ellipse at center, rgba(230, 205, 160, 0.25) 0%, rgba(190, 160, 120, 0.3) 100%),
            repeating-linear-gradient(60deg, rgba(0,0,0,0.01) 0px, rgba(0,0,0,0.01) 2px, transparent 2px, transparent 6px)
          `,
        };
      case "stained_aged":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(circle at 75% 25%, rgba(120, 53, 15, 0.18) 0%, rgba(120, 53, 15, 0.08) 18px, transparent 45px),
            radial-gradient(circle at 20% 70%, rgba(180, 83, 9, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at center, rgba(160, 110, 60, 0.12) 0%, rgba(120, 80, 40, 0.25) 100%)
          `,
        };
      case "sage_meadow":
        return {
          backgroundColor: baseColor,
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(167, 243, 208, 0.25) 0%, transparent 60%)`,
        };
      case "retro_film":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(circle at 50% 30%, rgba(249, 115, 22, 0.08) 0%, transparent 70%),
            radial-gradient(circle at 80% 80%, rgba(234, 88, 12, 0.06) 0%, transparent 50%),
            repeating-linear-gradient(0deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 1px, transparent 1px, transparent 3px)
          `,
        };
      case "midnight_journal":
        return {
          backgroundColor: baseColor,
          backgroundImage: `
            radial-gradient(circle at 80% 20%, rgba(253, 224, 71, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)
          `,
        };
      default:
        return { backgroundColor: baseColor };
    }
  };

  return (
    <div className="flex flex-col items-center select-none relative w-full">

      {/* Floating Canvas Controls (Undo, Redo, Zoom hint) */}
      {!readOnly && (
        <div className="w-full max-w-[800px] flex items-center justify-between px-2 mb-2 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
              <span>{paperMeta.icon}</span>
              <span>{paperMeta.label} Canvas</span>
            </span>
            <span className="hidden sm:inline text-[11px] text-stone-400">
              &bull; Drag & drop photos, text, or stickers
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onUndo && (
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-40 text-stone-700 shadow-2xs font-medium"
                title="Undo (Cmd+Z)"
              >
                ↩ Undo
              </button>
            )}
            {onRedo && (
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-40 text-stone-700 shadow-2xs font-medium"
                title="Redo"
              >
                ↪ Redo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Canvas Paper Wrapper with Authentic Paper Shadow & Border */}
      <div className="w-full overflow-x-auto flex justify-center py-2 px-1 scrollbar-none">
        
        <div
          id="scrapbook-paper-sheet"
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!readOnly) setSelectedId(null);
          }}
          style={{
            width: `${layout.canvasWidth}px`,
            minHeight: `${layout.canvasHeight}px`,
            ...getPaperBackgroundStyle(),
          }}
          className={`relative transition-colors duration-200 rounded-[24px] border border-stone-300/80 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_20px_35px_-4px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden shrink-0 ${
            isDraggingOver ? "ring-4 ring-amber-400 ring-offset-2" : ""
          }`}
        >

          {/* Realistic Spiral Notebook Spine Holes (Left Edge Accent) */}
          {layout.paperStyle === "ruled_notebook" && (
            <div className="absolute left-3 top-6 bottom-6 flex flex-col justify-between pointer-events-none z-30 opacity-70">
              {Array.from({ length: 18 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-3.5 h-3.5 rounded-full bg-stone-300/90 border border-stone-400/80 shadow-inner"
                />
              ))}
            </div>
          )}

          {/* Top Paper Header Tape Accent for Minimal/Nature styles */}
          {(layout.paperStyle === "cream_linen" || layout.paperStyle === "sage_meadow") && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-32 h-6 bg-amber-200/60 border border-amber-300/70 shadow-xs rotate-1 pointer-events-none z-30 opacity-80 backdrop-blur-xs" />
          )}

          {/* Drop Image Overlay Guide */}
          {isDraggingOver && (
            <div className="absolute inset-0 bg-amber-500/10 border-4 border-dashed border-amber-500 rounded-3xl z-50 flex items-center justify-center pointer-events-none backdrop-blur-xs animate-fade-in">
              <div className="bg-white/95 px-6 py-3 rounded-2xl shadow-lg text-center space-y-1">
                <ImageIcon className="w-8 h-8 text-amber-600 mx-auto animate-bounce" />
                <div className="text-sm font-bold text-stone-900 font-['Newsreader'] italic">
                  Drop photo onto journal page
                </div>
                <div className="text-xs text-stone-500">
                  Creates an authentic scrapbook polaroid print
                </div>
              </div>
            </div>
          )}

          {/* Render Elements on Canvas */}
          {layout.elements.map((el) => {
            const isSelected = !readOnly && selectedId === el.id;
            const fontObj = JOURNAL_FONTS.find((f) => f.id === el.fontFamily) || JOURNAL_FONTS[0];

            return (
              <div
                key={el.id}
                onPointerDown={(e) => handlePointerDownElement(e, el)}
                onClick={(e) => {
                  if (!readOnly) {
                    e.stopPropagation();
                    setSelectedId(el.id);
                  }
                }}
                style={{
                  position: "absolute",
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                  minHeight: `${el.height}px`,
                  transform: `rotate(${el.rotation || 0}deg)`,
                  zIndex: el.zIndex || 10,
                  opacity: el.opacity !== undefined ? el.opacity : 1,
                  cursor: readOnly ? "default" : isSelected ? "move" : "pointer",
                }}
                className={`transition-[box-shadow] group ${
                  isSelected
                    ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-transparent shadow-lg rounded-xl"
                    : "hover:outline-dashed hover:outline-1 hover:outline-amber-400"
                }`}
              >

                {/* ------------------------------------------------------------- */}
                {/* 1. TEXT BLOCK                                                */}
                {/* ------------------------------------------------------------- */}
                {el.type === "text" && (
                  <div
                    style={{
                      fontFamily: fontObj.cssFamily,
                      fontSize: `${el.fontSize || 16}px`,
                      fontWeight: el.fontWeight || "normal",
                      fontStyle: el.fontStyle || "normal",
                      textDecoration: el.textDecoration || "none",
                      textAlign: el.textAlign || "left",
                      color: el.color || (layout.paperStyle === "midnight_journal" ? "#f5f5f4" : "#1c1917"),
                      backgroundColor: el.backgroundColor || "transparent",
                      borderColor: el.borderColor || "transparent",
                      borderWidth: el.borderWidth ? `${el.borderWidth}px` : 0,
                      borderRadius: el.borderRadius ? `${el.borderRadius}px` : "8px",
                      padding: el.backgroundColor ? "12px 14px" : "4px 6px",
                      lineHeight: 1.6,
                    }}
                    className="w-full h-full relative"
                  >
                    {editingTextId === el.id ? (
                      <textarea
                        autoFocus
                        value={el.content || ""}
                        onChange={(e) => handleUpdateElement(el.id, { content: e.target.value })}
                        onBlur={() => setEditingTextId(null)}
                        className="w-full h-full bg-transparent border-none outline-none resize-none p-0 focus:ring-0 leading-relaxed"
                        style={{ fontFamily: fontObj.cssFamily, fontSize: `${el.fontSize || 16}px` }}
                      />
                    ) : (
                      <div
                        onDoubleClick={() => {
                          if (!readOnly) setEditingTextId(el.id);
                        }}
                        className="whitespace-pre-wrap break-words leading-relaxed"
                      >
                        {el.content || "(Double click to write...)"}
                      </div>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 2. IMAGE / POLAROID PRINT                                    */}
                {/* ------------------------------------------------------------- */}
                {el.type === "image" && (
                  <div className="w-full h-full">
                    {/* Polaroid Style */}
                    {el.photoStyle === "polaroid" && (
                      <div className="bg-white p-3 pb-7 rounded-sm shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_4px_6px_-2px_rgba(0,0,0,0.1)] border border-stone-200/80 space-y-2 relative">
                        {/* Washi Tape on top of Polaroid */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-amber-200/85 border border-amber-300 shadow-2xs rotate-2 pointer-events-none" />

                        <div className="w-full overflow-hidden bg-stone-100 rounded-xs aspect-4/3 flex items-center justify-center">
                          {el.imageUrl ? (
                            <img
                              src={el.imageUrl}
                              alt={el.caption || "Scrapbook photo"}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          ) : (
                            <div className="p-4 text-center text-xs text-stone-400">
                              📷 Photo Placeholder
                            </div>
                          )}
                        </div>

                        {/* Handwritten Caption */}
                        <div className="text-center font-['Caveat'] text-stone-800 text-base leading-tight pt-1 px-1 truncate">
                          {el.caption || "Cherished moment ✨"}
                        </div>
                      </div>
                    )}

                    {/* Tape Corner Style */}
                    {el.photoStyle === "tape" && (
                      <div className="bg-white p-1 rounded-sm shadow-md border border-stone-200 relative">
                        {/* Corner Tape Strips */}
                        <div className="absolute -top-2.5 -left-2.5 w-12 h-4 bg-rose-300/80 border border-rose-400 rotate-[-35deg] pointer-events-none shadow-xs" />
                        <div className="absolute -bottom-2.5 -right-2.5 w-12 h-4 bg-rose-300/80 border border-rose-400 rotate-[-35deg] pointer-events-none shadow-xs" />

                        <img
                          src={el.imageUrl}
                          alt={el.caption || "Journal Photo"}
                          className="w-full h-full object-cover rounded-xs pointer-events-none"
                        />
                      </div>
                    )}

                    {/* Clean Border / Frame Style */}
                    {(el.photoStyle === "border" || el.photoStyle === "clean" || !el.photoStyle) && (
                      <div className="w-full h-full rounded-2xl overflow-hidden shadow-md border-2 border-white">
                        <img
                          src={el.imageUrl}
                          alt={el.caption || "Journal Photo"}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 3. STICKER / DOODLE / STAMP                                  */}
                {/* ------------------------------------------------------------- */}
                {el.type === "sticker" && (
                  <div
                    style={{ fontSize: `${el.fontSize || 32}px` }}
                    className="w-full h-full flex items-center justify-center drop-shadow-sm select-none"
                  >
                    {el.content || "⭐"}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 4. WASHI TAPE STRIP                                          */}
                {/* ------------------------------------------------------------- */}
                {el.type === "tape" && (
                  <div
                    className={`w-full h-full ${
                      el.tapeColor || "bg-amber-300/80 border-amber-400"
                    } border shadow-2xs backdrop-blur-2xs opacity-90 rounded-xs`}
                  />
                )}

                {/* ------------------------------------------------------------- */}
                {/* 5. GEMINI AI REFLECTION INSIGHT CARD                         */}
                {/* ------------------------------------------------------------- */}
                {el.type === "ai_card" && (
                  <div
                    style={{
                      backgroundColor: el.backgroundColor || "#fef3c7",
                      borderColor: el.borderColor || "#fde68a",
                      color: el.color || "#78350f",
                    }}
                    className="w-full h-full p-4 rounded-2xl border shadow-xs space-y-1.5 font-['Newsreader']"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80 font-['Plus_Jakarta_Sans']">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{el.caption || "Gemini Reflection"}</span>
                    </div>
                    <div className="text-xs leading-relaxed italic">
                      "{el.content}"
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 6. POSTAL / DIARY STAMP                                      */}
                {/* ------------------------------------------------------------- */}
                {el.type === "stamp" && (
                  <div
                    style={{
                      color: el.stampColor || "#b91c1c",
                      borderColor: el.stampColor || "#b91c1c",
                    }}
                    className={`w-full h-full p-2 flex flex-col items-center justify-center select-none font-mono uppercase tracking-widest text-center shadow-xs transition-transform ${
                      el.stampVariant === "circle"
                        ? "rounded-full border-2 border-dashed border-current aspect-square"
                        : "rounded-md border-2 border-dashed border-current"
                    }`}
                  >
                    <div className="text-[10px] opacity-75 leading-tight font-bold">
                      ★ SCRAPBOOK ★
                    </div>
                    <div className="font-extrabold text-xs tracking-wider border-y border-current my-0.5 py-0.5 w-full text-center truncate">
                      {el.stampText || el.content || "RECORDED"}
                    </div>
                    <div className="text-[9px] opacity-70 tracking-tight">
                      AUTHENTIC ENTRY
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 7. ELEGANT QUOTE CARD                                        */}
                {/* ------------------------------------------------------------- */}
                {el.type === "quote_card" && (
                  <div
                    style={{
                      backgroundColor: el.backgroundColor || "#fef9c3",
                      borderColor: el.borderColor || "#fef08a",
                      color: el.color || "#78350f",
                      fontFamily: fontObj.cssFamily,
                    }}
                    className="w-full h-full p-3.5 rounded-xl border shadow-sm relative leading-relaxed flex flex-col justify-between overflow-hidden"
                  >
                    <div className="text-2xl font-serif leading-none opacity-30 select-none -mb-1">
                      “
                    </div>
                    <div className="text-xs sm:text-sm italic font-medium px-1 line-clamp-4">
                      {el.content || "Every moment is a fresh beginning."}
                    </div>
                    <div className="text-right text-[11px] font-bold tracking-wider uppercase opacity-75 mt-1.5 truncate">
                      — {el.caption || "Mindful Reflection"}
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* SELECTION HANDLES & ROTATION HANDLE (Shown only when selected) */}
                {/* ------------------------------------------------------------- */}
                {isSelected && (
                  <>
                    {/* Top Rotation Knob */}
                    <div
                      onPointerDown={(e) => handlePointerDownRotate(e, el)}
                      title="Drag to rotate element"
                      className="absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-500 text-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-50 hover:scale-110 transition-transform"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </div>

                    {/* Bottom-Right Resize Handle */}
                    <div
                      onPointerDown={(e) => handlePointerDownResize(e, el)}
                      title="Drag to resize"
                      className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-amber-500 border-2 border-white shadow-md cursor-se-resize z-50 hover:scale-125 transition-transform"
                    />

                    {/* Quick Floating Action Bar Above Element */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute -top-12 left-0 flex items-center gap-1 bg-stone-900 text-stone-100 p-1 rounded-xl shadow-xl z-50 text-[11px] font-semibold whitespace-nowrap animate-fade-in"
                    >
                      {el.type === "text" && (
                        <button
                          type="button"
                          onClick={() => setEditingTextId(el.id)}
                          className="px-2 py-0.5 rounded hover:bg-stone-800 flex items-center gap-1 text-amber-300"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Text</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleUpdateElement(el.id, { locked: !el.locked })}
                        className={`p-1 rounded hover:bg-stone-800 ${
                          el.locked ? "text-amber-400" : "text-stone-300 hover:text-white"
                        }`}
                        title={el.locked ? "Unlock element position" : "Lock element position"}
                      >
                        {el.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBringToFront(el.id)}
                        className="p-1 rounded hover:bg-stone-800 text-stone-300 hover:text-white"
                        title="Bring to Front"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendToBack(el.id)}
                        className="p-1 rounded hover:bg-stone-800 text-stone-300 hover:text-white"
                        title="Send to Back"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(el.id)}
                        className="p-1 rounded hover:bg-stone-800 text-stone-300 hover:text-white"
                        title="Duplicate Element"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(el.id)}
                        className="p-1 rounded hover:bg-rose-900/60 text-rose-400 hover:text-rose-200"
                        title="Delete Element"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}

              </div>
            );
          })}

        </div>

      </div>

    </div>
  );
};
