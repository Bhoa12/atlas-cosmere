/**
 * Spoiler-safe recommendation boundary for Hoid IA.
 *
 * Recommendations deliberately use only progress snapshots, explicit reader
 * preferences and non-narrative catalogue metadata. No plot summary or
 * provider-supplied narrative knowledge is accepted as a recommendation reason.
 */

export type RecommendationBasis =
  | { kind: "progress"; workId: string; chapter: number }
  | { kind: "preference"; preferenceId: string }
  | { kind: "metadata"; workId: string; field: string; value: string };

export interface RecommendationCandidate {
  workId: string;
  title: string;
  reasons: RecommendationBasis[];
}

export interface ReaderRecommendationSnapshot {
  readonly positions: ReadonlyMap<string, number>;
  readonly preferences: ReadonlySet<string>;
}

export interface CatalogueMetadata {
  readonly workId: string;
  readonly fields: ReadonlyMap<string, string>;
}

export interface RecommendationResult {
  readonly status: "authorized" | "blocked";
  readonly candidate?: RecommendationCandidate;
  readonly rejectedReasons: readonly string[];
}

function validId(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

function basisIsAuthorized(
  basis: RecommendationBasis,
  snapshot: ReaderRecommendationSnapshot,
  catalogue: ReadonlyMap<string, CatalogueMetadata>,
): string | null {
  if (basis.kind === "progress") {
    const chapter = snapshot.positions.get(basis.workId);
    return Number.isInteger(basis.chapter) && basis.chapter > 0 && chapter !== undefined && basis.chapter <= chapter
      ? null
      : "progress basis exceeds the immutable reader snapshot";
  }

  if (basis.kind === "preference") {
    return snapshot.preferences.has(basis.preferenceId)
      ? null
      : "preference basis was not explicitly supplied by the reader";
  }

  const work = catalogue.get(basis.workId);
  return work?.fields.get(basis.field) === basis.value
    ? null
    : "metadata basis is not present in the non-narrative catalogue";
}

/**
 * Verifies recommendation reasons without consulting narrative content.
 * An empty or unverifiable rationale blocks the candidate rather than asking a
 * provider to fill the gap with external knowledge.
 */
export function verifyRecommendation(
  candidate: RecommendationCandidate,
  snapshot: ReaderRecommendationSnapshot,
  catalogueEntries: readonly CatalogueMetadata[],
): RecommendationResult {
  const rejectedReasons: string[] = [];
  if (!validId(candidate.workId) || !validId(candidate.title)) {
    return { status: "blocked", rejectedReasons: ["candidate has an invalid identifier or title"] };
  }

  if (candidate.reasons.length === 0) {
    return { status: "blocked", rejectedReasons: ["candidate has no verifiable recommendation basis"] };
  }

  const catalogue = new Map(catalogueEntries.map((entry) => [entry.workId, entry]));
  for (const basis of candidate.reasons) {
    const rejection = basisIsAuthorized(basis, snapshot, catalogue);
    if (rejection) rejectedReasons.push(rejection);
  }

  return rejectedReasons.length === 0
    ? { status: "authorized", candidate, rejectedReasons: [] }
    : { status: "blocked", rejectedReasons };
}
