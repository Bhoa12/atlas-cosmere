/**
 * Safe provenance boundaries for Cosmere expansion data.
 *
 * A declared source can catalog a work without authorizing narrative content.
 * Only explicitly accessible editorial sources may support reading structure
 * or original summaries.
 */

export type SourceAccess = "declared-private" | "verified-index" | "editorial-accessible";

export interface CatalogSource {
  id: string;
  access: SourceAccess;
  accessible: boolean;
}

export interface CatalogClaim {
  id: string;
  sourceId: string;
  kind: "metadata" | "reading-structure" | "original-summary";
}

export interface ClaimAudit {
  accepted: CatalogClaim[];
  rejectedIds: string[];
}

function canSupport(source: CatalogSource, kind: CatalogClaim["kind"]): boolean {
  if (kind === "metadata") {
    return source.access === "verified-index" || source.access === "editorial-accessible";
  }

  return source.access === "editorial-accessible" && source.accessible;
}

/**
 * Audits provenance without inspecting or reproducing source text.
 * Duplicate claim identifiers are rejected rather than silently merged.
 */
export function auditCatalogClaims(
  sources: readonly CatalogSource[],
  claims: readonly CatalogClaim[],
): ClaimAudit {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const seen = new Set<string>();
  const accepted: CatalogClaim[] = [];
  const rejectedIds: string[] = [];

  for (const claim of claims) {
    const source = sourceById.get(claim.sourceId);
    const valid =
      claim.id.trim().length > 0 &&
      claim.sourceId.trim().length > 0 &&
      !!source &&
      !seen.has(claim.id) &&
      canSupport(source, claim.kind);

    if (!valid) {
      rejectedIds.push(claim.id);
      continue;
    }

    seen.add(claim.id);
    accepted.push(claim);
  }

  return { accepted, rejectedIds };
}
