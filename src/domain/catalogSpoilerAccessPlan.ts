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
  const boundary = resolveCatalogReadingBoundary(input.worldId, input.workIds);
  if (!boundary) return { status: "blocked", boundary: null, allowedContentIds: [] };

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
