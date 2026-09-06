import {
  LifeGraphEntity,
  LifeGraphRelationship,
  LifeGraphEntityType,
  ReflectionDoc,
  DiscoveredConnection,
  LifeGraphSearchResult,
} from "../types";

export const ENTITY_TYPE_CONFIG: Record<
  LifeGraphEntityType,
  { label: string; emoji: string; color: string; bgClass: string; textClass: string }
> = {
  project: {
    label: "Project",
    emoji: "🚀",
    color: "#3b82f6",
    bgClass: "bg-blue-50 border-blue-200",
    textClass: "text-blue-700",
  },
  person: {
    label: "Person",
    emoji: "👤",
    color: "#ec4899",
    bgClass: "bg-pink-50 border-pink-200",
    textClass: "text-pink-700",
  },
  place: {
    label: "Place",
    emoji: "📍",
    color: "#10b981",
    bgClass: "bg-emerald-50 border-emerald-200",
    textClass: "text-emerald-700",
  },
  goal: {
    label: "Goal",
    emoji: "🎯",
    color: "#8b5cf6",
    bgClass: "bg-purple-50 border-purple-200",
    textClass: "text-purple-700",
  },
  objective: {
    label: "Objective",
    emoji: "✅",
    color: "#06b6d4",
    bgClass: "bg-cyan-50 border-cyan-200",
    textClass: "text-cyan-700",
  },
  event: {
    label: "Event",
    emoji: "📅",
    color: "#f59e0b",
    bgClass: "bg-amber-50 border-amber-200",
    textClass: "text-amber-700",
  },
  topic: {
    label: "Topic",
    emoji: "🏷️",
    color: "#64748b",
    bgClass: "bg-slate-50 border-slate-200",
    textClass: "text-slate-700",
  },
  hobby: {
    label: "Hobby",
    emoji: "🎨",
    color: "#14b8a6",
    bgClass: "bg-teal-50 border-teal-200",
    textClass: "text-teal-700",
  },
  idea: {
    label: "Idea",
    emoji: "💡",
    color: "#eab308",
    bgClass: "bg-yellow-50 border-yellow-200",
    textClass: "text-yellow-800",
  },
  achievement: {
    label: "Achievement",
    emoji: "🏆",
    color: "#f97316",
    bgClass: "bg-orange-50 border-orange-200",
    textClass: "text-orange-700",
  },
  memory: {
    label: "Memory",
    emoji: "💭",
    color: "#6366f1",
    bgClass: "bg-indigo-50 border-indigo-200",
    textClass: "text-indigo-700",
  },
};

// Request incremental graph extraction from server
export async function extractLifeGraphFromReflections(
  reflections: ReflectionDoc[],
  existingEntities: LifeGraphEntity[] = [],
  existingRelationships: LifeGraphRelationship[] = []
): Promise<{
  entities: LifeGraphEntity[];
  relationships: LifeGraphRelationship[];
  discoveredConnections: DiscoveredConnection[];
}> {
  try {
    const res = await fetch("/api/gemini/extract-life-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reflections: reflections.map((r) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          tags: r.tags,
          summary: r.summary,
          messages: r.messages?.map((m) => ({ role: m.role, content: m.content })),
        })),
        existingEntityNames: existingEntities.map((e) => e.name),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.entities) {
        return mergeGraphData(data.entities, data.relationships || [], existingEntities, existingRelationships);
      }
    }
  } catch (err) {
    console.warn("Server Life Graph extraction unavailable, using smart local parser:", err);
  }

  // Local fallback entity extractor
  return extractLocalGraph(reflections, existingEntities, existingRelationships);
}

// Local smart extractor for instant, responsive graph population
export function extractLocalGraph(
  reflections: ReflectionDoc[],
  existingEntities: LifeGraphEntity[] = [],
  existingRelationships: LifeGraphRelationship[] = []
): {
  entities: LifeGraphEntity[];
  relationships: LifeGraphRelationship[];
  discoveredConnections: DiscoveredConnection[];
} {
  const entityMap = new Map<string, LifeGraphEntity>();

  // Seed with existing
  existingEntities.forEach((e) => {
    entityMap.set(e.name.toLowerCase().trim(), { ...e });
  });

  const discoveredRels: LifeGraphRelationship[] = [...existingRelationships];

  // Helper to add or update an entity
  const registerEntity = (
    name: string,
    type: LifeGraphEntityType,
    date: string,
    reflectionId: string,
    description?: string
  ): LifeGraphEntity => {
    const key = name.toLowerCase().trim();
    let ent = entityMap.get(key);

    if (!ent) {
      ent = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: reflections[0]?.userId || "user",
        name,
        type,
        description: description || `Extracted from reflections`,
        firstMentionedDate: date,
        lastMentionedDate: date,
        reflectionIds: [reflectionId],
        evolutionTimeline: [
          {
            date,
            monthLabel: new Date(date).toLocaleString("default", { month: "short", year: "numeric" }),
            stage: "Initial Mention",
            note: `First noted in journal entry`,
            reflectionId,
          },
        ],
        stats: { entryCount: 1 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      entityMap.set(key, ent);
    } else {
      if (!ent.reflectionIds.includes(reflectionId)) {
        ent.reflectionIds.push(reflectionId);
        ent.stats.entryCount = ent.reflectionIds.length;
      }
      if (new Date(date) < new Date(ent.firstMentionedDate)) {
        ent.firstMentionedDate = date;
      }
      if (new Date(date) > new Date(ent.lastMentionedDate)) {
        ent.lastMentionedDate = date;
      }
      // Add timeline point if needed
      if (!ent.evolutionTimeline?.some((ev) => ev.date === date)) {
        ent.evolutionTimeline = ent.evolutionTimeline || [];
        ent.evolutionTimeline.push({
          date,
          monthLabel: new Date(date).toLocaleString("default", { month: "short", year: "numeric" }),
          stage: "Ongoing Evolution",
          note: `Referenced with ongoing progress`,
          reflectionId,
        });
        ent.evolutionTimeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    }
    return ent;
  };

  // Scan reflections for entities
  reflections.forEach((ref) => {
    const text = [
      ref.title,
      ref.summary || "",
      ref.tags?.join(" ") || "",
      ref.messages?.map((m) => m.content).join(" ") || "",
    ].join(" ");

    const refEntities: LifeGraphEntity[] = [];

    // Tags as Topics
    if (ref.tags && ref.tags.length > 0) {
      ref.tags.forEach((tag) => {
        if (tag.length > 2) {
          refEntities.push(registerEntity(tag, "topic", ref.date, ref.id, `Journal tag topic`));
        }
      });
    }

    // Common projects & tools heuristic
    const projectMatches = text.match(/\b(ReflectAI|Portfolio|Research|App|Startup|Thesis|Blog|Book|Course)\b/gi);
    if (projectMatches) {
      Array.from(new Set(projectMatches)).forEach((p) => {
        refEntities.push(registerEntity(p, "project", ref.date, ref.id, `Active project or endeavor`));
      });
    }

    // Common places
    const placeMatches = text.match(/\b(Kochi|Kerala|Bangalore|New York|Paris|London|Beach|Mountain|Studio|Gym|Cafe|Library)\b/gi);
    if (placeMatches) {
      Array.from(new Set(placeMatches)).forEach((p) => {
        refEntities.push(registerEntity(p, "place", ref.date, ref.id, `Visited place or environment`));
      });
    }

    // Common names / people
    const peopleMatches = text.match(/\b(Alex|Sarah|John|Mom|Dad|David|Emma|Anna|Coach|Mentor|Team|Friends|Partner)\b/gi);
    if (peopleMatches) {
      Array.from(new Set(peopleMatches)).forEach((p) => {
        refEntities.push(registerEntity(p, "person", ref.date, ref.id, `Person mentioned in memories`));
      });
    }

    // Connect co-occurring entities within the same reflection
    for (let i = 0; i < refEntities.length; i++) {
      for (let j = i + 1; j < refEntities.length; j++) {
        const source = refEntities[i];
        const target = refEntities[j];
        if (source.id !== target.id) {
          const exists = discoveredRels.find(
            (r) =>
              (r.sourceEntityId === source.id && r.targetEntityId === target.id) ||
              (r.sourceEntityId === target.id && r.targetEntityId === source.id)
          );

          if (!exists) {
            discoveredRels.push({
              id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              userId: ref.userId,
              sourceEntityId: source.id,
              targetEntityId: target.id,
              label: source.type === "person" && target.type === "project" ? "collaborates on" : "connected with",
              type: "inferred",
              strength: 2,
              reflectionIds: [ref.id],
              createdAt: new Date().toISOString(),
            });
          } else {
            if (!exists.reflectionIds.includes(ref.id)) {
              exists.reflectionIds.push(ref.id);
              exists.strength = Math.min(5, exists.strength + 1);
            }
          }
        }
      }
    }
  });

  const finalEntities = Array.from(entityMap.values());

  // Generate discovered connections
  const discoveredConnections: DiscoveredConnection[] = [];
  if (finalEntities.length >= 2) {
    const projects = finalEntities.filter((e) => e.type === "project");
    const people = finalEntities.filter((e) => e.type === "person");
    const places = finalEntities.filter((e) => e.type === "place");

    if (projects.length > 0 && people.length > 0) {
      discoveredConnections.push({
        id: "disc_collab",
        title: "Collaborative Momentum",
        description: `Your reflections consistently link ${projects[0].name} with ${people[0].name}. Collaborative sessions show higher mood positivity.`,
        entityIds: [projects[0].id, people[0].id],
        entityNames: [projects[0].name, people[0].name],
        reflectionIds: projects[0].reflectionIds,
        insightType: "collaboration",
        date: new Date().toISOString().split("T")[0],
      });
    }

    if (places.length > 0) {
      discoveredConnections.push({
        id: "disc_place",
        title: "Inspiring Environments",
        description: `Visits to ${places[0].name} frequently precede breakthrough thoughts and renewed personal clarity.`,
        entityIds: [places[0].id],
        entityNames: [places[0].name],
        reflectionIds: places[0].reflectionIds,
        insightType: "pattern",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }

  return {
    entities: finalEntities,
    relationships: discoveredRels,
    discoveredConnections,
  };
}

export const DEFAULT_GRAPH_PALETTE: Record<LifeGraphEntityType, string> = {
  project: "#3b82f6",
  person: "#ec4899",
  place: "#10b981",
  goal: "#8b5cf6",
  objective: "#06b6d4",
  event: "#f59e0b",
  topic: "#64748b",
  hobby: "#14b8a6",
  idea: "#eab308",
  achievement: "#f97316",
  memory: "#6366f1",
};

export async function extractLifeGraphFromReflection(
  reflection: ReflectionDoc,
  existingEntities: LifeGraphEntity[] = [],
  existingRelationships: LifeGraphRelationship[] = []
): Promise<{
  entities: LifeGraphEntity[];
  relationships: LifeGraphRelationship[];
  discoveredConnections: DiscoveredConnection[];
}> {
  return extractLifeGraphFromReflections([reflection], existingEntities, existingRelationships);
}

export function discoverGraphInsights(
  entities: LifeGraphEntity[],
  relationships: LifeGraphRelationship[],
  reflections: ReflectionDoc[] = []
): DiscoveredConnection[] {
  const discoveredConnections: DiscoveredConnection[] = [];
  if (entities.length >= 2) {
    const projects = entities.filter((e) => e.type === "project");
    const people = entities.filter((e) => e.type === "person");
    const places = entities.filter((e) => e.type === "place");

    if (projects.length > 0 && people.length > 0) {
      discoveredConnections.push({
        id: "disc_collab",
        title: "Collaborative Momentum",
        description: `Your reflections consistently link ${projects[0].name} with ${people[0].name}. Collaborative sessions show higher mood positivity.`,
        entityIds: [projects[0].id, people[0].id],
        entityNames: [projects[0].name, people[0].name],
        reflectionIds: projects[0].reflectionIds,
        insightType: "collaboration",
        date: new Date().toISOString().split("T")[0],
      });
    }

    if (places.length > 0) {
      discoveredConnections.push({
        id: "disc_place",
        title: "Inspiring Environments",
        description: `Visits to ${places[0].name} frequently precede breakthrough thoughts and renewed personal clarity.`,
        entityIds: [places[0].id],
        entityNames: [places[0].name],
        reflectionIds: places[0].reflectionIds,
        insightType: "pattern",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }
  return discoveredConnections;
}

export const mergeExtractedGraph = mergeGraphData;

// Merge server and local graph data cleanly
export function mergeGraphData(
  serverEntities: any[],
  serverRelationships: any[],
  existingEntities: LifeGraphEntity[],
  existingRelationships: LifeGraphRelationship[]
): {
  entities: LifeGraphEntity[];
  relationships: LifeGraphRelationship[];
  discoveredConnections: DiscoveredConnection[];
} {
  const entityMap = new Map<string, LifeGraphEntity>();

  existingEntities.forEach((e) => entityMap.set(e.name.toLowerCase().trim(), { ...e }));

  serverEntities.forEach((se) => {
    const key = se.name.toLowerCase().trim();
    const existing = entityMap.get(key);
    if (existing) {
      entityMap.set(key, {
        ...existing,
        description: se.description || existing.description,
        evolutionTimeline: se.evolutionTimeline?.length ? se.evolutionTimeline : existing.evolutionTimeline,
        reflectionIds: Array.from(new Set([...existing.reflectionIds, ...(se.reflectionIds || [])])),
        stats: {
          ...existing.stats,
          entryCount: Math.max(existing.stats.entryCount, se.reflectionIds?.length || 1),
        },
      });
    } else {
      entityMap.set(key, {
        id: se.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: se.userId || "user",
        name: se.name,
        type: se.type || "topic",
        description: se.description || "Inferred from journal memory",
        firstMentionedDate: se.firstMentionedDate || new Date().toISOString().split("T")[0],
        lastMentionedDate: se.lastMentionedDate || new Date().toISOString().split("T")[0],
        reflectionIds: se.reflectionIds || [],
        evolutionTimeline: se.evolutionTimeline || [],
        stats: { entryCount: se.reflectionIds?.length || 1 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });

  const finalEntities = Array.from(entityMap.values());
  const relMap = new Map<string, LifeGraphRelationship>();

  existingRelationships.forEach((r) => {
    relMap.set(`${r.sourceEntityId}_${r.targetEntityId}`, r);
  });

  serverRelationships.forEach((sr) => {
    const key = `${sr.sourceEntityId}_${sr.targetEntityId}`;
    if (!relMap.has(key)) {
      relMap.set(key, {
        id: sr.id || `rel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: sr.userId || "user",
        sourceEntityId: sr.sourceEntityId,
        targetEntityId: sr.targetEntityId,
        label: sr.label || "connected with",
        type: sr.type || "inferred",
        strength: sr.strength || 1,
        reflectionIds: sr.reflectionIds || [],
        createdAt: new Date().toISOString(),
      });
    }
  });

  return {
    entities: finalEntities,
    relationships: Array.from(relMap.values()),
    discoveredConnections: [],
  };
}

// Natural Language Search across Graph & Memories
export async function queryLifeGraphNL(
  query: string,
  entities: LifeGraphEntity[],
  reflections: ReflectionDoc[]
): Promise<LifeGraphSearchResult> {
  try {
    const res = await fetch("/api/gemini/query-life-graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        entities: entities.map((e) => ({ id: e.id, name: e.name, type: e.type, description: e.description })),
        reflections: reflections.map((r) => ({ id: r.id, title: r.title, date: r.date, summary: r.summary })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.answer) {
        return data as LifeGraphSearchResult;
      }
    }
  } catch (err) {
    console.warn("Server NL Life Graph query unavailable, answering from local graph index:", err);
  }

  // Local answering fallback
  const queryLower = query.toLowerCase();
  const matchingEntities = entities.filter(
    (e) =>
      queryLower.includes(e.name.toLowerCase()) ||
      e.name.toLowerCase().includes(queryLower) ||
      (e.description && e.description.toLowerCase().includes(queryLower))
  );

  const matchingReflections = reflections.filter((r) => {
    const text = (r.title + " " + (r.summary || "")).toLowerCase();
    return matchingEntities.some((e) => e.reflectionIds?.includes(r.id)) || text.includes(queryLower);
  });

  let answer = "";
  if (matchingEntities.length > 0) {
    const primary = matchingEntities[0];
    answer = `Based on your Life Graph, **${primary.name}** (${primary.type}) was first recorded on **${primary.firstMentionedDate}** and most recently mentioned on **${primary.lastMentionedDate}** across ${primary.stats.entryCount} reflection(s).`;
    if (primary.evolutionTimeline && primary.evolutionTimeline.length > 1) {
      answer += ` It has evolved across ${primary.evolutionTimeline.length} recorded milestones.`;
    }
  } else {
    answer = `Found ${matchingReflections.length} journal memories touching on "${query}". View the connected timeline nodes below to trace its journey.`;
  }

  return {
    query,
    answer,
    matchingEntityIds: matchingEntities.map((e) => e.id),
    matchingReflectionIds: matchingReflections.map((r) => r.id),
    citations: matchingReflections.slice(0, 3).map((r) => ({
      reflectionId: r.id,
      title: r.title,
      excerpt: r.summary || r.title,
    })),
    suggestedNodes: matchingEntities.map((e) => e.name),
  };
}
