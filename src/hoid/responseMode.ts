/**
 * Response-mode contract for Hoid IA.
 * Modes change presentation, never the narrative knowledge boundary.
 */
export type ResponseMode = "explain" | "recommend";

export interface AuthorizedEvidence {
  id: string;
  workId: string;
  chapter: number;
  summary: string;
}

export interface ModeRequest {
  mode: ResponseMode;
  workId: string;
  maxChapter: number;
  evidence: ReadonlyArray<AuthorizedEvidence>;
}

export type ModeContext =
  | { kind: "ready"; mode: ResponseMode; evidence: AuthorizedEvidence[] }
  | { kind: "abstain"; reason: "invalid-request" | "no-authorized-evidence" };

/**
 * Produces a presentation context without widening the evidence set.
 * Evidence from another work, future chapters, or malformed summaries is discarded.
 */
export function buildModeContext(request: ModeRequest): ModeContext {
  if (!request.workId.trim() || !Number.isInteger(request.maxChapter) || request.maxChapter < 1) {
    return { kind: "abstain", reason: "invalid-request" };
  }

  const seen = new Set<string>();
  const evidence = request.evidence.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return item.id.trim().length > 0
      && item.workId === request.workId
      && Number.isInteger(item.chapter)
      && item.chapter >= 1
      && item.chapter <= request.maxChapter
      && item.summary.trim().length > 0;
  });

  return evidence.length > 0
    ? { kind: "ready", mode: request.mode, evidence }
    : { kind: "abstain", reason: "no-authorized-evidence" };
}
