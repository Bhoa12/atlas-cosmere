/**
 * Provider output is untrusted. This boundary accepts only structured claims
 * that cite already-authorized editorial record identifiers.
 *
 * It intentionally does not inspect private source text: provenance and the
 * reader's authorization ceiling are enforced before presentation.
 */

export type HoidResponseStatus = "authorized" | "limited" | "abstain" | "blocked";

export interface HoidResponseClaim {
  text: string;
  evidenceIds: string[];
}

export interface HoidResponseProposal {
  claims: HoidResponseClaim[];
}

export interface SafeResponse {
  status: HoidResponseStatus;
  text: string;
  acceptedEvidenceIds: string[];
}

export const DEFAULT_MAX_RESPONSE_CLAIMS = 32;
export const DEFAULT_MAX_RESPONSE_TEXT_LENGTH = 16_000;
export const DEFAULT_MAX_CLAIM_TEXT_LENGTH = 4_000;
export const DEFAULT_MAX_EVIDENCE_IDS_PER_CLAIM = 16;
export const DEFAULT_MAX_EVIDENCE_ID_LENGTH = 256;

function canonicalEvidenceIds(value: unknown, authorized: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > DEFAULT_MAX_EVIDENCE_IDS_PER_CLAIM) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    const id = raw.trim();
    if (id.length === 0 || id.length > DEFAULT_MAX_EVIDENCE_ID_LENGTH || !authorized.has(id)) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.length > 0 ? ids : null;
}

/**
 * Reduces a provider proposal to claims with explicit, authorized evidence.
 * Any malformed or unsupported claim is discarded; if nothing survives, the
 * caller receives a conservative abstention instead of provider prose.
 */
export function verifyHoidResponse(
  proposal: unknown,
  authorizedEvidenceIds: ReadonlySet<string>
): SafeResponse {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { status: "abstain", text: "", acceptedEvidenceIds: [] };
  }
  const claims = (proposal as Partial<HoidResponseProposal>).claims;
  if (!Array.isArray(claims) || claims.length === 0 || claims.length > DEFAULT_MAX_RESPONSE_CLAIMS) {
    return { status: "abstain", text: "", acceptedEvidenceIds: [] };
  }

  const accepted: string[] = [];
  const evidence = new Set<string>();
  let totalLength = 0;
  let rejected = false;

  for (const raw of claims) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { rejected = true; continue; }
    const claim = raw as Partial<HoidResponseClaim>;
    if (typeof claim.text !== "string") { rejected = true; continue; }
    const text = claim.text.trim();
    if (text.length === 0 || text.length > DEFAULT_MAX_CLAIM_TEXT_LENGTH || totalLength + text.length > DEFAULT_MAX_RESPONSE_TEXT_LENGTH) {
      rejected = true;
      continue;
    }
    const ids = canonicalEvidenceIds(claim.evidenceIds, authorizedEvidenceIds);
    if (!ids) { rejected = true; continue; }
    accepted.push(text);
    totalLength += text.length;
    ids.forEach((id) => evidence.add(id));
  }

  if (accepted.length === 0) return { status: rejected ? "blocked" : "abstain", text: "", acceptedEvidenceIds: [] };
  return {
    status: rejected ? "limited" : "authorized",
    text: accepted.join("\n\n"),
    acceptedEvidenceIds: [...evidence].sort(),
  };
}


/**
 * Builds the evidence allow-list directly from editorial records using the
 * same catalog and progress authorization boundary. This avoids a common
 * integration mistake: treating a repository-wide set of record identifiers
 * as if all of them were safe for the current reader.
 */
export function authorizedEditorialEvidenceIds(
  records: readonly unknown[],
  progress: unknown,
  catalog: readonly import("./contracts").HoidCatalogEntry[]
): ReadonlySet<string> {
  const { authorizedEditorialRecords } = require("./contracts") as typeof import("./contracts");
  return new Set(authorizedEditorialRecords(records, progress, catalog).map((record) => record.id));
}

/**
 * Convenience boundary for integrations that hold editorial records rather
 * than a precomputed evidence set. Authorization is recomputed locally from
 * the current progress before any provider claim is accepted.
 */
export function verifyHoidResponseWithEditorialRecords(
  proposal: unknown,
  records: readonly unknown[],
  progress: unknown,
  catalog: readonly import("./contracts").HoidCatalogEntry[]
): SafeResponse {
  return verifyHoidResponse(proposal, authorizedEditorialEvidenceIds(records, progress, catalog));
}
