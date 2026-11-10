import { resolveCatalogReadingBoundary, type CatalogReadingBoundary } from "./catalogReadingBoundary";
import { resolveWorldSpoilerBatchGate, type WorldSpoilerBatchRequest } from "./worldSpoilerBatchGate";

export type CatalogSpoilerAccessPlanInput = {
  worldId: string;
  workIds: readonly string[];
  frontierStatus: "blocked" | "not-started" | "in-progress" | "complete";
  safeCompletedPositions: number;
  declaredPositions: number;
  requests: WorldSpoilerBatchRequest[];
};

export type CatalogSpoilerAccessPlan =
  | { status: "blocked"; boundary: null; allowedContentIds: [] }
  | { status: "resolved"; boundary: CatalogReadingBoundary; allowedContentIds: string[] };

/**
 * Composes verified catalog membership with the metadata-only spoiler gate.
 * No reading order, narrative facts or protected EPUB text are inferred here.
 */
export function resolveCatalogSpoilerAccessPlan(input: CatalogSpoilerAccessPlanInput): CatalogSpoilerAccessPlan {
  // Treat persisted or external input as untrusted at this composition boundary.\n  // The lower-level gate validates request members, but checking the collection\n  // itself here prevents a malformed runtime value from throwing before the\n  // fail-closed path can be returned.\n  if (!input || !Array.isArray(input.workIds) || !Array.isArray(input.requests)) {\n    return { status: "blocked", boundary: null, allowedContentIds: [] };\n  }\n\n  const boundary = resolveCatalogReadingBoundary(input.worldId, input.workIds);
  if (!boundary) return { status: "blocked", boundary: null, allowedContentIds: [] };

  // Positions are world-local coordinates supplied by the caller. When this
  // composition layer is given a catalog boundary, its declared extent must
  // match that boundary exactly; otherwise a frontier could authorize content
  // beyond the selected catalog works.
  if (input.declaredPositions !== boundary.workIds.length) {
    return { status: "blocked", boundary: null, allowedContentIds: [] };
  }

  const gate = resolveWorldSpoilerBatchGate({
    worldId: boundary.worldId,
    frontierStatus: input.frontierStatus,
    safeCompletedPositions: input.safeCompletedPositions,
    declaredPositions: input.declaredPositions,
    requests: [...input.requests],
  });

  if (gate.status === "blocked") {
    return { status: "blocked", boundary: null, allowedContentIds: [] };
  }

  return { status: "resolved", boundary, allowedContentIds: gate.allowedContentIds };
}
