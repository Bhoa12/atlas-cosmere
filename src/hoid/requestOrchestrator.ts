/**
 * Hoid IA request orchestration.
 *
 * This module intentionally knows nothing about a specific AI SDK. It turns a
 * frozen reading boundary and verified provider claims into a safe response.
 * Later stages may discard information, but never add new knowledge.
 */

export type ReadingPosition = Readonly<{ workId: string; chapter: number }>;
export type Evidence = Readonly<{ id: string; workId: string; maxChapter: number }>;
export type AuthorizedContext = Readonly<{ evidenceIds: readonly string[] }>;
export type ProviderClaim = Readonly<{ text: string; evidenceIds: readonly string[] }>;
export type ProviderDraft = Readonly<{ claims: readonly ProviderClaim[] }>;

export type ResponseStatus = "authorized" | "limited" | "blocked" | "abstain";

export type SafeResponse = Readonly<{
  status: ResponseStatus;
  text: string;
  acceptedClaims: readonly ProviderClaim[];
  rejectedClaimCount: number;
}>;

function validPosition(position: ReadingPosition): boolean {
  return position.workId.trim().length > 0 &&
    Number.isInteger(position.chapter) &&
    position.chapter >= 0;
}

/**
 * Freezes a request-local reading snapshot. Conflicting positions fail closed.
 */
export function freezeReadingProgress(
  positions: readonly ReadingPosition[],
): ReadonlyMap<string, number> {
  const snapshot = new Map<string, number>();

  for (const position of positions) {
    if (!validPosition(position)) {
      throw new Error("Invalid reading position");
    }

    const previous = snapshot.get(position.workId);
    if (previous !== undefined && previous !== position.chapter) {
      throw new Error("Conflicting reading positions for the same work");
    }

    snapshot.set(position.workId, position.chapter);
  }

  return snapshot;
}

/**
 * Keeps only evidence at or before the frozen position of its own work.
 */
export function authorizeEvidence(
  progress: ReadonlyMap<string, number>,
  evidence: readonly Evidence[],
): readonly Evidence[] {
  const ids = new Set<string>();

  return evidence.filter((item) => {
    if (!item.id.trim() || ids.has(item.id) || !Number.isInteger(item.maxChapter) || item.maxChapter < 0) {
      return false;
    }

    const chapter = progress.get(item.workId);
    if (chapter === undefined || item.maxChapter > chapter) {
      return false;
    }

    ids.add(item.id);
    return true;
  });
}

/**
 * Verifies a provider draft claim-by-claim. A claim must cite at least one
 * authorized evidence id and may not cite any id outside the request context.
 */
export function finalizeDraft(
  context: AuthorizedContext,
  draft: ProviderDraft | null,
): SafeResponse {
  if (!draft || draft.claims.length === 0) {
    return { status: "abstain", text: "", acceptedClaims: [], rejectedClaimCount: 0 };
  }

  const allowed = new Set(context.evidenceIds);
  const accepted: ProviderClaim[] = [];
  let rejected = 0;

  for (const claim of draft.claims) {
    const text = claim.text.trim();
    const cited = [...new Set(claim.evidenceIds)];
    const valid = text.length > 0 &&
      cited.length > 0 &&
      cited.every((id) => allowed.has(id));

    if (valid) {
      accepted.push({ text, evidenceIds: cited });
    } else {
      rejected += 1;
    }
  }

  if (accepted.length === 0) {
    return { status: "blocked", text: "", acceptedClaims: [], rejectedClaimCount: rejected };
  }

  return {
    status: rejected === 0 ? "authorized" : "limited",
    text: accepted.map((claim) => claim.text).join("\n\n"),
    acceptedClaims: accepted,
    rejectedClaimCount: rejected,
  };
}
