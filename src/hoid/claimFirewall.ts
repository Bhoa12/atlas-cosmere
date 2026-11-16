import type { ReaderProgress, SafeEvidence } from "./providerRuntime";

export type ApprovedClaimKind = "fact" | "explanation";

export interface ApprovedClaim {
  readonly id: string;
  readonly bookId: string;
  readonly chapter: number;
  readonly kind: ApprovedClaimKind;
  readonly evidenceIds: readonly string[];
  readonly approvedText: string;
  readonly status: "approved";
}

export interface ClaimSelection {
  readonly kind: "selection";
  readonly claimIds: readonly string[];
}

export type ClaimFirewallResult =
  | {
      readonly kind: "answer";
      readonly intent: "explain";
      readonly text: string;
      readonly claimIds: readonly string[];
      readonly evidenceIds: readonly string[];
    }
  | {
      readonly kind: "abstain";
      readonly reason:
        | "invalid-progress"
        | "invalid-selection"
        | "no-authorized-claims"
        | "unsupported-intent";
    };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_EVIDENCE = 40;
const MAX_LEDGER = 500;
const MAX_SELECTED_CLAIMS = 12;
const MAX_CLAIM_TEXT = 1_600;
const MAX_RENDERED_TEXT = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isProgress(value: unknown): value is ReaderProgress {
  return isRecord(value) &&
    isId(value.bookId) &&
    Number.isSafeInteger(value.chapter) &&
    (value.chapter as number) >= 1;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isSafeEvidence(value: unknown): value is SafeEvidence {
  return isRecord(value) &&
    isId(value.id) &&
    isId(value.bookId) &&
    Number.isSafeInteger(value.chapter) &&
    (value.chapter as number) >= 1 &&
    value.accessible === true &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0;
}

function readAllowedEvidence(
  value: unknown,
  progress: ReaderProgress,
): Map<string, SafeEvidence> | null {
  if (!Array.isArray(value) || value.length > MAX_EVIDENCE) return null;

  const allowed = new Map<string, SafeEvidence>();
  for (const item of value) {
    if (!isSafeEvidence(item)) return null;
    if (item.bookId !== progress.bookId || item.chapter > progress.chapter) return null;
    if (allowed.has(item.id)) return null;
    allowed.set(item.id, item);
  }
  return allowed;
}

function readSelection(value: unknown): string[] | null {
  if (!isRecord(value) ||
      !hasExactKeys(value, ["kind", "claimIds"]) ||
      value.kind !== "selection" ||
      !Array.isArray(value.claimIds) ||
      value.claimIds.length === 0 ||
      value.claimIds.length > MAX_SELECTED_CLAIMS) {
    return null;
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.claimIds) {
    if (!isId(candidate) || seen.has(candidate)) return null;
    seen.add(candidate);
    ids.push(candidate);
  }
  return ids;
}

function findUniqueClaim(ledger: readonly unknown[], id: string): ApprovedClaim | null {
  const matches = ledger.filter((item) => isRecord(item) && item.id === id);
  if (matches.length !== 1) return null;

  const value = matches[0];
  if (!isRecord(value) ||
      !isId(value.id) ||
      !isId(value.bookId) ||
      !Number.isSafeInteger(value.chapter) ||
      (value.chapter as number) < 1 ||
      (value.kind !== "fact" && value.kind !== "explanation") ||
      value.status !== "approved" ||
      typeof value.approvedText !== "string" ||
      value.approvedText.trim().length === 0 ||
      value.approvedText.length > MAX_CLAIM_TEXT ||
      !Array.isArray(value.evidenceIds) ||
      value.evidenceIds.length === 0 ||
      value.evidenceIds.length > 8) {
    return null;
  }

  const evidenceIds: string[] = [];
  const seen = new Set<string>();
  for (const evidenceId of value.evidenceIds) {
    if (!isId(evidenceId) || seen.has(evidenceId)) return null;
    seen.add(evidenceId);
    evidenceIds.push(evidenceId);
  }

  return {
    id: value.id,
    bookId: value.bookId,
    chapter: value.chapter as number,
    kind: value.kind,
    evidenceIds,
    approvedText: value.approvedText.trim(),
    status: "approved",
  };
}

/**
 * Converts a provider's selection of reviewed claim IDs into user-facing text.
 * Provider-authored prose is deliberately not accepted by this boundary.
 */
export function renderApprovedClaims(
  selection: unknown,
  intent: unknown,
  progress: unknown,
  authorizedEvidence: unknown,
  claimLedger: unknown,
): ClaimFirewallResult {
  if (!isProgress(progress)) {
    return { kind: "abstain", reason: "invalid-progress" };
  }
  if (intent !== "explain") {
    return { kind: "abstain", reason: "unsupported-intent" };
  }

  const allowedEvidence = readAllowedEvidence(authorizedEvidence, progress);
  if (!allowedEvidence || allowedEvidence.size === 0) {
    return { kind: "abstain", reason: "no-authorized-claims" };
  }

  if (!Array.isArray(claimLedger) || claimLedger.length > MAX_LEDGER) {
    return { kind: "abstain", reason: "no-authorized-claims" };
  }

  const selectedIds = readSelection(selection);
  if (!selectedIds) {
    return { kind: "abstain", reason: "invalid-selection" };
  }

  const claims: ApprovedClaim[] = [];
  const citedEvidence = new Set<string>();

  for (const id of selectedIds) {
    const claim = findUniqueClaim(claimLedger, id);
    if (!claim ||
        claim.bookId !== progress.bookId ||
        claim.chapter > progress.chapter) {
      return { kind: "abstain", reason: "invalid-selection" };
    }

    for (const evidenceId of claim.evidenceIds) {
      const evidence = allowedEvidence.get(evidenceId);
      if (!evidence || evidence.chapter < claim.chapter) {
        return { kind: "abstain", reason: "invalid-selection" };
      }
      citedEvidence.add(evidenceId);
    }
    claims.push(claim);
  }

  const text = [
    "Con el progreso indicado, la explicación se limita a afirmaciones revisadas:",
    ...claims.map((claim) => claim.approvedText),
  ].join("\n\n");

  if (text.length > MAX_RENDERED_TEXT) {
    return { kind: "abstain", reason: "invalid-selection" };
  }

  return {
    kind: "answer",
    intent: "explain",
    text,
    claimIds: claims.map((claim) => claim.id),
    evidenceIds: [...citedEvidence],
  };
}
