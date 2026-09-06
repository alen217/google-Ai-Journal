import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LifeGraphEntity,
  LifeGraphRelationship,
  LifeGraphEntityType,
  LifeGraphQueryResult,
  ReflectionDoc,
  UserProfile,
} from "../types";
import {
  fetchLifeGraphEntities,
  fetchLifeGraphRelationships,
  saveLifeGraphEntities,
  saveLifeGraphRelationships,
  deleteLifeGraphEntity,
  deleteLifeGraphRelationship,
} from "../lib/firebase";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import {
  extractLifeGraphFromReflection,
  mergeExtractedGraph,
  queryLifeGraphNL,
  discoverGraphInsights,
  DEFAULT_GRAPH_PALETTE,
} from "../lib/lifeGraphService";
import {
  Share2,
  Search,
  Sparkles,
  Filter,
  Plus,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Tag,
  Clock,
  ChevronRight,
  TrendingUp,
  BookOpen,
  Eye,
  RefreshCw,
  Info,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  MapPin,
  Users,
  Target,
  FolderGit2,
  Compass,
  Lightbulb,
  Trash2,
} from "lucide-react";

interface LifeGraphViewProps {
  userProfile: UserProfile;
  reflections: ReflectionDoc[];
  initialFocusEntityName?: string;
  onNavigateBack: () => void;
  onOpenReflection: (doc: ReflectionDoc) => void;
  onNavigateToScrapbook?: (reflection: ReflectionDoc) => void;
}

export const LifeGraphView: React.FC<LifeGraphViewProps> = ({
  userProfile,
  reflections,
  initialFocusEntityName,
  onNavigateBack,
  onOpenReflection,
  onNavigateToScrapbook,
}) => {
  // Graph Data
  const [entities, setEntities] = useState<LifeGraphEntity[]>([]);
  const [relationships, setRelationships] = useState<LifeGraphRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanningReflections, setIsScanningReflections] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>("");

  // Filtering & Selection
  const [selectedType, setSelectedType] = useState<LifeGraphEntityType | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // NL Search
  const [nlQuery, setNlQuery] = useState("");
  const [isQueryingNL, setIsQueryingNL] = useState(false);
  const [nlResult, setNlResult] = useState<LifeGraphQueryResult | null>(null);

  // View Mode: Interactive Graph Canvas vs Timeline Evolution vs Discover Insights
  const [activeTab, setActiveTab] = useState<"graph" | "timeline" | "insights">("graph");

  // Manual Add Modal
  const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityType, setNewEntityType] = useState<LifeGraphEntityType>("project");
  const [newEntityDesc, setNewEntityDesc] = useState("");

  // SVG Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [entityToDelete, setEntityToDelete] = useState<LifeGraphEntity | null>(null);
  const [isDeletingEntity, setIsDeletingEntity] = useState(false);

  // Load initial graph data from Firestore
  useEffect(() => {
    let isMounted = true;
    async function loadGraph() {
      setIsLoading(true);
      try {
        const [savedEntities, savedRels] = await Promise.all([
          fetchLifeGraphEntities(userProfile.uid),
          fetchLifeGraphRelationships(userProfile.uid),
        ]);

        if (isMounted) {
          // If no entities yet in database, offer auto-scan from reflections if AI is enabled
          if (savedEntities.length === 0 && reflections.length > 0) {
            setEntities([]);
            setRelationships([]);
            if (userProfile.privacyAISettings?.aiAnalysisEnabled !== false && userProfile.privacyAISettings?.lifeGraphEnabled !== false) {
              autoScanAllReflections(reflections.slice(0, 10));
            }
          } else {
            setEntities(savedEntities);
            setRelationships(savedRels);

            if (initialFocusEntityName) {
              const matched = savedEntities.find(
                (e) => e.name.toLowerCase() === initialFocusEntityName.toLowerCase()
              );
              if (matched) setSelectedEntityId(matched.id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load life graph:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadGraph();
    return () => {
      isMounted = false;
    };
  }, [userProfile.uid]);

  // Scan all reflections to extract/refresh life graph
  const autoScanAllReflections = async (docsToScan: ReflectionDoc[]) => {
    if (docsToScan.length === 0) return;
    if (userProfile.privacyAISettings?.aiAnalysisEnabled === false || userProfile.privacyAISettings?.lifeGraphEnabled === false) {
      setScanProgress("AI extraction is disabled in your Privacy Settings.");
      setTimeout(() => setScanProgress(""), 4000);
      return;
    }
    setIsScanningReflections(true);
    setScanProgress(`Analyzing ${docsToScan.length} journal reflections with AI...`);

    try {
      let currentEntities = [...entities];
      let currentRels = [...relationships];

      for (let i = 0; i < docsToScan.length; i++) {
        const ref = docsToScan[i];
        setScanProgress(`Processing entry ${i + 1} of ${docsToScan.length}: "${ref.title || "Untitled"}"...`);
        const extracted = await extractLifeGraphFromReflection(ref, currentEntities, currentRels);
        currentEntities = extracted.entities;
        currentRels = extracted.relationships;
      }

      setEntities(currentEntities);
      setRelationships(currentRels);

      // Persist to Firestore
      await Promise.all([
        saveLifeGraphEntities(userProfile.uid, currentEntities),
        saveLifeGraphRelationships(userProfile.uid, currentRels),
      ]);

      setScanProgress("Knowledge Graph updated successfully!");
      setTimeout(() => setScanProgress(""), 3000);
    } catch (err) {
      console.error("Auto scan failed:", err);
      setScanProgress("Error during scan. Local graph preserved.");
    } finally {
      setIsScanningReflections(false);
    }
  };

  const handleConfirmDeleteEntity = async () => {
    if (!entityToDelete) return;
    setIsDeletingEntity(true);
    try {
      await deleteLifeGraphEntity(userProfile.uid, entityToDelete.id);
      // Prune any relationships connected to this entity
      const connectedRels = relationships.filter(
        (r) => r.sourceEntityId === entityToDelete.id || r.targetEntityId === entityToDelete.id
      );
      for (const rel of connectedRels) {
        await deleteLifeGraphRelationship(userProfile.uid, rel.id);
      }
      setEntities((prev) => prev.filter((e) => e.id !== entityToDelete.id));
      setRelationships((prev) =>
        prev.filter((r) => r.sourceEntityId !== entityToDelete.id && r.targetEntityId !== entityToDelete.id)
      );
      if (selectedEntityId === entityToDelete.id) {
        setSelectedEntityId(null);
      }
      setEntityToDelete(null);
    } catch (err) {
      console.error("Failed to delete entity:", err);
    } finally {
      setIsDeletingEntity(false);
    }
  };

  // Natural Language Search Query
  const handleNLSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nlQuery.trim()) return;

    setIsQueryingNL(true);
    try {
      const res = await queryLifeGraphNL(nlQuery, entities, reflections);
      setNlResult(res);
      // If result identifies matching entities, highlight the first one
      if (res.matchingEntityIds && res.matchingEntityIds.length > 0) {
        setSelectedEntityId(res.matchingEntityIds[0]);
      }
    } catch (err) {
      console.error("NL query error:", err);
    } finally {
      setIsQueryingNL(false);
    }
  };

  // Filtered entities for view
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (e.isArchived) return false;
      if (selectedType !== "all" && e.type !== selectedType) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entities, selectedType, searchTerm]);

  // Selected Entity Details
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    return entities.find((e) => e.id === selectedEntityId) || null;
  }, [entities, selectedEntityId]);

  // Associated Reflections for Selected Entity
  const selectedEntityReflections = useMemo(() => {
    if (!selectedEntity) return [];
    return reflections.filter((r) =>
      selectedEntity.reflectionIds?.includes(r.id)
    );
  }, [selectedEntity, reflections]);

  // Connected Relationships for Selected Entity
  const selectedEntityRelationships = useMemo(() => {
    if (!selectedEntity) return [];
    return relationships.filter(
      (r) => r.sourceEntityId === selectedEntity.id || r.targetEntityId === selectedEntity.id
    );
  }, [selectedEntity, relationships]);

  // Layout node positions in canvas (radial / circular cluster layout)
  const nodeLayout = useMemo(() => {
    const map = new Map<string, { x: number; y: number; radius: number; color: string }>();
    const count = filteredEntities.length;
    if (count === 0) return map;

    const centerX = 500;
    const centerY = 350;

    // Group by entity type
    const byType: Record<string, LifeGraphEntity[]> = {};
    filteredEntities.forEach((e) => {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type].push(e);
    });

    const types = Object.keys(byType);
    types.forEach((typeKey, typeIdx) => {
      const typeEntities = byType[typeKey];
      const typeAngle = (typeIdx / types.length) * 2 * Math.PI;
      const typeDistance = count > 15 ? 260 : 180;
      const groupCenterX = centerX + Math.cos(typeAngle) * typeDistance;
      const groupCenterY = centerY + Math.sin(typeAngle) * typeDistance;

      typeEntities.forEach((entity, entIdx) => {
        const subAngle = (entIdx / Math.max(1, typeEntities.length)) * 2 * Math.PI;
        const subDist = typeEntities.length > 1 ? 55 + (entIdx % 3) * 25 : 0;

        const x = groupCenterX + Math.cos(subAngle) * subDist;
        const y = groupCenterY + Math.sin(subAngle) * subDist;

        // Size proportional to mentions
        const mentions = entity.stats?.entryCount || 1;
        const radius = Math.min(38, Math.max(18, 16 + mentions * 3));
        const color = DEFAULT_GRAPH_PALETTE[entity.type] || "#78716c";

        map.set(entity.id, { x, y, radius, color });
      });
    });

    return map;
  }, [filteredEntities]);

  // Discovered Serendipitous Insights
  const discoveredInsights = useMemo(() => {
    return discoverGraphInsights(entities, relationships);
  }, [entities, relationships]);

  // Pan & Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.2));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Add Manual Entity
  const handleAddManualEntity = async () => {
    if (!newEntityName.trim()) return;
    const newEnt: LifeGraphEntity = {
      id: `ent_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: userProfile.uid,
      name: newEntityName.trim(),
      type: newEntityType,
      description: newEntityDesc.trim(),
      firstMentionedDate: new Date().toISOString().slice(0, 10),
      lastMentionedDate: new Date().toISOString().slice(0, 10),
      reflectionIds: [],
      stats: { entryCount: 1, totalOccurrences: 1 },
      evolutionTimeline: [
        {
          date: new Date().toISOString().slice(0, 10),
          stage: "Initial Entry",
          note: `Added ${newEntityName} to Life Graph`,
          event: `Added ${newEntityName} to Life Graph`,
          reflectionId: "",
          reflectionTitle: "Direct Graph Entry",
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const next = [newEnt, ...entities];
    setEntities(next);
    await saveLifeGraphEntities(userProfile.uid, next);

    setSelectedEntityId(newEnt.id);
    setIsAddEntityModalOpen(false);
    setNewEntityName("");
    setNewEntityDesc("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header */}
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
              <span className="text-xl">🌐</span>
              <h1 className="text-2xl font-bold font-['Playfair_Display'] text-stone-900">
                Personal Life Graph
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-900 border border-indigo-200">
                Knowledge Network
              </span>
            </div>
            <p className="text-xs text-stone-500 font-['Plus_Jakarta_Sans']">
              Interconnected map of people, projects, goals, places, and thoughts evolving over time.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Tabs */}
          <div className="flex items-center bg-stone-200/80 p-1 rounded-xl border border-stone-300/60 shadow-xs">
            <button
              onClick={() => setActiveTab("graph")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "graph"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Interactive Graph</span>
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "timeline"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Evolution Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab("insights")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "insights"
                  ? "bg-white text-stone-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Connections ({discoveredInsights.length})</span>
            </button>
          </div>

          {/* Rescan All Reflections */}
          <button
            onClick={() => autoScanAllReflections(reflections)}
            disabled={isScanningReflections}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            title="Analyze past journal entries to enrich the Life Graph"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-stone-600 ${isScanningReflections ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync Journal</span>
          </button>

          {/* Add Entity */}
          <button
            onClick={() => setIsAddEntityModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Entity</span>
          </button>
        </div>
      </div>

      {/* Progress banner during AI graph scan */}
      {scanProgress && (
        <div className="mb-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium flex items-center justify-between shadow-xs animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
            <span>{scanProgress}</span>
          </div>
        </div>
      )}

      {/* NATURAL LANGUAGE SEARCH BAR */}
      <div className="mb-6 bg-white rounded-2xl p-3 border border-stone-200 shadow-2xs">
        <form onSubmit={handleNLSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              placeholder="Ask your Life Graph: 'When did I first mention Project Atlas?' or 'How has my relationship with Sarah evolved?'"
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-stone-50/70 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white text-stone-900"
            />
          </div>
          <button
            type="submit"
            disabled={isQueryingNL || !nlQuery.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isQueryingNL ? "animate-spin" : ""}`} />
            <span>{isQueryingNL ? "Thinking..." : "Query AI"}</span>
          </button>
        </form>

        {/* NL Query Result Card */}
        {nlResult && (
          <div className="mt-3 p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-stone-900 text-xs leading-relaxed space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Life Graph Synthesis:
              </span>
              <button
                onClick={() => setNlResult(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-stone-800 whitespace-pre-wrap">{nlResult.answer}</p>
            {nlResult.citations && nlResult.citations.length > 0 && (
              <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-indigo-800">Citations:</span>
                {nlResult.citations.map((cit) => (
                  <button
                    key={cit.reflectionId}
                    onClick={() => {
                      const doc = reflections.find((r) => r.id === cit.reflectionId);
                      if (doc) onOpenReflection(doc);
                    }}
                    className="px-2 py-0.5 rounded-md bg-white border border-indigo-300 text-[11px] font-medium text-indigo-950 hover:bg-indigo-100 transition-colors"
                  >
                    📖 {cit.title || "Journal Reflection"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: INTERACTIVE GRAPH CANVAS */}
      {activeTab === "graph" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual SVG Canvas (2 Cols) */}
          <div className="lg:col-span-2 space-y-3">
            {/* Filter Pills & View Controls */}
            <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center flex-wrap gap-1">
                {(["all", "project", "person", "goal", "place", "topic", "objective"] as (LifeGraphEntityType | "all")[]).map(
                  (typeKey) => (
                    <button
                      key={typeKey}
                      onClick={() => setSelectedType(typeKey)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                        selectedType === typeKey
                          ? "bg-stone-900 text-white shadow-xs"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {typeKey}
                    </button>
                  )
                )}
              </div>

              {/* Pan/Zoom Tools */}
              <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetView}
                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                  title="Reset Pan & Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SVG Network Canvas */}
            <div
              className="bg-stone-950 rounded-3xl border border-stone-800 relative h-[600px] overflow-hidden shadow-inner cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* Background Stars / Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#292524_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

              {filteredEntities.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-3 pointer-events-none">
                  <Share2 className="w-12 h-12 text-stone-600 stroke-[1.5]" />
                  <p className="text-sm font-semibold">No entities found for this filter.</p>
                  <p className="text-xs text-stone-500 max-w-xs">
                    Click "Sync Journal" or "Add Entity" above to start populating your Life Graph!
                  </p>
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  className="w-full h-full"
                  viewBox="0 0 1000 700"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g
                    transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                    className="transition-transform duration-75"
                  >
                    {/* Edges / Connections */}
                    {relationships.map((rel) => {
                      const sNode = nodeLayout.get(rel.sourceEntityId);
                      const tNode = nodeLayout.get(rel.targetEntityId);
                      if (!sNode || !tNode) return null;

                      const isHighlighted =
                        selectedEntityId === rel.sourceEntityId ||
                        selectedEntityId === rel.targetEntityId;

                      return (
                        <g key={rel.id} className="transition-opacity">
                          <line
                            x1={sNode.x}
                            y1={sNode.y}
                            x2={tNode.x}
                            y2={tNode.y}
                            stroke={isHighlighted ? "#818cf8" : "#44403c"}
                            strokeWidth={isHighlighted ? 2.5 : 1.2}
                            strokeDasharray={rel.type === "inferred" ? "4,4" : undefined}
                            opacity={isHighlighted ? 0.9 : 0.45}
                          />
                          {/* Relationship Label */}
                          <text
                            x={(sNode.x + tNode.x) / 2}
                            y={(sNode.y + tNode.y) / 2 - 4}
                            fill={isHighlighted ? "#c7d2fe" : "#78716c"}
                            fontSize={isHighlighted ? 11 : 9}
                            fontWeight={isHighlighted ? "bold" : "normal"}
                            textAnchor="middle"
                            className="pointer-events-none"
                          >
                            {rel.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Entity Nodes */}
                    {filteredEntities.map((ent) => {
                      const pos = nodeLayout.get(ent.id);
                      if (!pos) return null;

                      const isSelected = selectedEntityId === ent.id;

                      return (
                        <g
                          key={ent.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntityId(ent.id);
                          }}
                          className="cursor-pointer group"
                        >
                          {/* Pulsing ring for selected node */}
                          {isSelected && (
                            <circle
                              cx={pos.x}
                              cy={pos.y}
                              r={pos.radius + 8}
                              fill="none"
                              stroke="#818cf8"
                              strokeWidth={2}
                              strokeDasharray="4,4"
                              className="animate-spin origin-center"
                            />
                          )}

                          {/* Node Circle */}
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={pos.radius}
                            fill={pos.color}
                            stroke={isSelected ? "#ffffff" : "#1c1917"}
                            strokeWidth={isSelected ? 3 : 1.5}
                            className="transition-transform group-hover:scale-110 shadow-lg"
                          />

                          {/* Node Label */}
                          <text
                            x={pos.x}
                            y={pos.y + pos.radius + 14}
                            fill={isSelected ? "#ffffff" : "#d6d3d1"}
                            fontSize={isSelected ? 13 : 11}
                            fontWeight={isSelected ? "bold" : "normal"}
                            textAnchor="middle"
                            className="pointer-events-none drop-shadow-md font-['Plus_Jakarta_Sans']"
                          >
                            {ent.name}
                          </text>

                          {/* Occurrences count badge inside node */}
                          <text
                            x={pos.x}
                            y={pos.y + 4}
                            fill="#ffffff"
                            fontSize={10}
                            fontWeight="bold"
                            textAnchor="middle"
                            className="pointer-events-none"
                          >
                            {ent.stats?.entryCount || 1}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
            </div>
          </div>

          {/* Entity Detail Inspector Drawer (1 Col) */}
          <div className="space-y-4">
            {selectedEntity ? (
              <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      style={{
                        backgroundColor: `${DEFAULT_GRAPH_PALETTE[selectedEntity.type]}20`,
                        color: DEFAULT_GRAPH_PALETTE[selectedEntity.type],
                        borderColor: `${DEFAULT_GRAPH_PALETTE[selectedEntity.type]}40`,
                      }}
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider inline-block mb-1.5"
                    >
                      {selectedEntity.type}
                    </span>
                    <h2 className="text-xl font-bold font-['Playfair_Display'] text-stone-900">
                      {selectedEntity.name}
                    </h2>
                    {selectedEntity.description && (
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {selectedEntity.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEntityToDelete(selectedEntity)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors"
                      title="Remove entity from graph"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedEntityId(null)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">First Mentioned</span>
                    <span className="font-semibold text-stone-800">{selectedEntity.firstMentionedDate}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-bold">Journal Mentions</span>
                    <span className="font-semibold text-stone-800">
                      {selectedEntity.stats?.entryCount || 1} reflection(s)
                    </span>
                  </div>
                </div>

                {/* "How It Evolved" Timeline */}
                <div>
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                    How It Evolved Over Time
                  </h3>

                  {selectedEntity.evolutionTimeline && selectedEntity.evolutionTimeline.length > 0 ? (
                    <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                      {selectedEntity.evolutionTimeline.map((item, idx) => (
                        <div key={idx} className="relative group">
                          {/* Dot */}
                          <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
                          <div className="text-xs">
                            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {item.date}
                            </span>
                            <p className="text-stone-800 font-medium mt-0.5 leading-snug">
                              {item.event}
                            </p>
                            {item.reflectionId && (
                              <button
                                onClick={() => {
                                  const doc = reflections.find((r) => r.id === item.reflectionId);
                                  if (doc) onOpenReflection(doc);
                                }}
                                className="text-[10px] text-stone-500 hover:text-indigo-600 underline mt-0.5 block"
                              >
                                📖 {item.reflectionTitle || "View Reflection"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic">No milestones logged yet.</p>
                  )}
                </div>

                {/* Connected Reflections */}
                {selectedEntityReflections.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      Linked Journal Reflections ({selectedEntityReflections.length})
                    </h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {selectedEntityReflections.map((ref) => (
                        <div
                          key={ref.id}
                          className="p-2.5 rounded-xl bg-stone-50 hover:bg-amber-50/60 border border-stone-200 transition-colors flex items-center justify-between"
                        >
                          <div className="truncate mr-2">
                            <h4 className="text-xs font-bold text-stone-900 truncate">
                              {ref.title || "Untitled Reflection"}
                            </h4>
                            <span className="text-[10px] text-stone-500">{ref.date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onOpenReflection(ref)}
                              className="px-2 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200 shadow-2xs"
                              title="Read reflection"
                            >
                              Read
                            </button>
                            {onNavigateToScrapbook && (
                              <button
                                onClick={() => onNavigateToScrapbook(ref)}
                                className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900"
                                title="Open Scrapbook"
                              >
                                ✨
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Entities */}
                {selectedEntityRelationships.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-blue-600" />
                      Interconnections
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEntityRelationships.map((rel) => {
                        const otherId =
                          rel.sourceEntityId === selectedEntity.id
                            ? rel.targetEntityId
                            : rel.sourceEntityId;
                        const otherEntity = entities.find((e) => e.id === otherId);
                        if (!otherEntity) return null;

                        return (
                          <button
                            key={rel.id}
                            onClick={() => setSelectedEntityId(otherEntity.id)}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-indigo-50 border border-stone-200 hover:border-indigo-300 text-xs text-stone-800 transition-colors flex items-center gap-1.5"
                          >
                            <span className="font-semibold text-indigo-900">{otherEntity.name}</span>
                            <span className="text-[10px] text-stone-400">({rel.label})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl shadow-inner">
                  🌐
                </div>
                <h3 className="text-base font-bold text-stone-800">Entity Explorer</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Click any node on the graph to inspect its backstory, milestone evolution timeline, and linked reflections.
                </p>
                <div className="pt-2 text-left text-xs text-stone-600 space-y-1 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                  <div className="font-semibold text-stone-800 mb-1">Graph Legend:</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Projects & Initiatives</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-pink-500" />
                    <span>People & Mentors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Places & Cities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span>Goals & Aspirations</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EVOLUTION TIMELINE OVERVIEW */}
      {activeTab === "timeline" && (
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-2xs space-y-6">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Life Journey Timeline</h2>
            <p className="text-xs text-stone-500">
              Chronological progression of your projects, achievements, and relationships across all journal entries.
            </p>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
            {entities
              .flatMap((e) =>
                (e.evolutionTimeline || []).map((ev) => ({
                  ...ev,
                  entityName: e.name,
                  entityType: e.type,
                  eventText: ev.event || ev.stage || ev.note,
                }))
              )
              .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
              .slice(0, 30)
              .map((item, idx) => (
                <div key={idx} className="relative group flex items-start justify-between">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-indigo-50" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {item.date}
                      </span>
                      <span className="text-xs font-semibold text-stone-500">
                        • {item.entityName} ({item.entityType})
                      </span>
                    </div>
                    <p className="text-sm font-medium text-stone-900 mt-1 font-['Newsreader']">
                      {item.eventText}
                    </p>
                  </div>
                  {item.reflectionId && (
                    <button
                      onClick={() => {
                        const doc = reflections.find((r) => r.id === item.reflectionId);
                        if (doc) onOpenReflection(doc);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline ml-4"
                    >
                      View Entry →
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: DISCOVER CONNECTIONS & INSIGHTS */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-2xs">
            <h2 className="text-lg font-bold text-stone-900">Serendipitous Connections</h2>
            <p className="text-xs text-stone-500">
              AI-discovered patterns, cross-pollinations, and synergies across your journal memories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {discoveredInsights.map((insight) => (
              <div
                key={insight.id}
                className="bg-white rounded-2xl p-5 border border-stone-200 hover:border-indigo-300 shadow-2xs transition-all space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                    ✨
                  </div>
                  <h3 className="font-bold text-stone-900 text-sm">{insight.title}</h3>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-['Newsreader']">
                  {insight.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-100">
                  {insight.entityNames.map((name, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-semibold"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD ENTITY MODAL */}
      {isAddEntityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Add to Life Graph</h3>
              <button
                onClick={() => setIsAddEntityModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Entity Name</label>
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="e.g., Tokyo, Sarah, Marathon Training, Design System"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Category Type</label>
                <select
                  value={newEntityType}
                  onChange={(e) => setNewEntityType(e.target.value as LifeGraphEntityType)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="project">Project / Initiative</option>
                  <option value="person">Person / Mentor</option>
                  <option value="goal">Goal / Aspirations</option>
                  <option value="place">Place / City</option>
                  <option value="topic">Topic / Skill</option>
                  <option value="objective">Objective / Milestone</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Brief Description (Optional)</label>
                <textarea
                  value={newEntityDesc}
                  onChange={(e) => setNewEntityDesc(e.target.value)}
                  rows={3}
                  placeholder="Why is this meaningful in your life journey?"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEntityModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddManualEntity}
                  disabled={!newEntityName.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                >
                  Save Entity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Entity Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(entityToDelete)}
        onClose={() => setEntityToDelete(null)}
        onConfirm={handleConfirmDeleteEntity}
        title="Remove Entity from Life Graph?"
        itemTitle={entityToDelete?.name}
        message="This will delete this node and its connected relationship lines from your memory graph. Your original journal reflections will NOT be deleted."
        isDeleting={isDeletingEntity}
      />
    </div>
  );
};
