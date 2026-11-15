import { HoidSourceId, isCatalogSource } from "./catalog";

export type HoidIntent = "explain" | "recommend";

export interface ReadingProgress {
  sourceId: HoidSourceId;
  chapter: number;
}

export interface Evidence {
  id: string;
  sourceId: HoidSourceId;
  chapter: number;
  /** Original summary; never a copied passage from a private EPUB. */
  summary: string;
}

export interface SafeRequest {
  question: string;
  intent: HoidIntent;
  progress: ReadingProgress;
}

export interface SafeContext {
  request: SafeRequest;
  evidence: Evidence[];
}

export type SafeResult =
  | { ok: true; context: SafeContext }
  | { ok: false; reason: "invalid-request" | "no-authorized-evidence" };

/**
 * Pure, provider-independent authorization boundary.
 * Unknown sources, malformed chapters and future evidence fail closed.
 */
export function buildSafeContext(
  request: SafeRequest,
  candidates: readonly Evidence[],
): SafeResult {
  if (
    !request.question.trim() ||
    !isCatalogSource(request.progress.sourceId) ||
    !Number.isInteger(request.progress.chapter) ||
    request.progress.chapter < 1
  ) return { ok: false, reason: "invalid-request" };

  const evidence = candidates.filter(item =>
    item.id.trim().length > 0 &&
    item.summary.trim().length > 0 &&
    item.sourceId === request.progress.sourceId &&
    Number.isInteger(item.chapter) &&
    item.chapter >= 1 &&
    item.chapter <= request.progress.chapter
  );

  return evidence.length
    ? { ok: true, context: { request, evidence } }
    : { ok: false, reason: "no-authorized-evidence" };
}
