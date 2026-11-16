import {
  buildProviderContext,
  type ProviderContext,
  type ReaderProgress,
  type SafeEvidence,
} from "./providerRuntime";
import {
  renderApprovedClaims,
  type ApprovedClaim,
  type ApprovedClaimKind,
  type ClaimFirewallResult,
} from "./claimFirewall";

export interface ClaimCandidate {
  readonly id: string;
  readonly kind: ApprovedClaimKind;
  readonly chapter: number;
  readonly approvedText: string;
}

export interface HoidClaimSelector {
  selectClaims(
    context: ProviderContext,
    candidates: readonly ClaimCandidate[],
  ): Promise<unknown>;
}

export type AuditedExplanationResult =
  | ClaimFirewallResult
  | {
      readonly kind: "abstain";
      readonly reason: "invalid-request" | "provider-failure";
    };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_LEDGER = 500;
const MAX_CANDIDATES = 60;
const MAX_CANDIDATE_TEXT = 18_000;

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

function normalizeClaim(value: unknown): ApprovedClaim | null {
  if (!isRecord(value) ||
      !isId(value.id) ||
      !isId(value.bookId) ||
      !Number.isSafeInteger(value.chapter) ||
      (value.chapter as number) < 1 ||
      (value.kind !== "fact" && value.kind !== "explanation") ||
      value.status !== "approved" ||
      typeof value.approvedText !== "string" ||
      value.approvedText.trim().length === 0 ||
      value.approvedText.length > 1_600 ||
      !Array.isArray(value.evidenceIds) ||
      value.evidenceIds.length === 0 ||
      value.evidenceIds.length > 8) {
    return null;
  }

  const evidenceIds: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value.evidenceIds) {
    if (!isId(candidate) || seen.has(candidate)) return null;
    seen.add(candidate);
    evidenceIds.push(candidate);
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

function isClaimSupportedByContext(
  claim: ApprovedClaim,
  progress: ReaderProgress,
  evidenceById: ReadonlyMap<string, SafeEvidence>,
): boolean {
  if (claim.bookId !== progress.bookId || claim.chapter > progress.chapter) return false;
  return claim.evidenceIds.every((id) => {
    const evidence = evidenceById.get(id);
    return Boolean(
      evidence &&
      evidence.bookId === progress.bookId &&
      evidence.chapter >= claim.chapter &&
      evidence.chapter <= progress.chapter &&
      evidence.accessible,
    );
  });
}

/**
 * End-to-end explanation path: provider selects reviewed claim IDs only.
 * The renderer, not the provider, supplies every narrative sentence.
 */
export async function runAuditedExplanation(
  selector: HoidClaimSelector,
  question: unknown,
  progress: unknown,
  evidence: unknown,
  claimLedger: unknown,
): Promise<AuditedExplanationResult> {
  if (!isProgress(progress)) {
    return { kind: "abstain", reason: "invalid-progress" };
  }
  if (typeof question !== "string" ||
      question.trim().length === 0 ||
      question.length > 4_000) {
    return { kind: "abstain", reason: "invalid-request" };
  }
  if (!selector || typeof selector.selectClaims !== "function") {
    return { kind: "abstain", reason: "provider-failure" };
  }

  const context = buildProviderContext(
    question,
    "explain",
    progress,
    evidence as SafeEvidence[],
  );
  if (!context) {
    return { kind: "abstain", reason: "no-authorized-claims" };
  }
  if (!Array.isArray(claimLedger) || claimLedger.length > MAX_LEDGER) {
    return { kind: "abstain", reason: "no-authorized-claims" };
  }

  const evidenceById = new Map<string, SafeEvidence>(
    context.evidence.map((item) => [item.id, item]),
  );
  const claims: ApprovedClaim[] = [];
  const seenIds = new Set<string>();
  let candidateTextLength = 0;

  for (const item of claimLedger) {
    if (!isRecord(item) || !isId(item.id)) continue;
    if (seenIds.has(item.id)) {
      return { kind: "abstain", reason: "no-authorized-claims" };
    }
    seenIds.add(item.id);

    const claim = normalizeClaim(item);
    if (!claim || !isClaimSupportedByContext(claim, progress, evidenceById)) continue;

    candidateTextLength += claim.approvedText.length;
    if (claims.length >= MAX_CANDIDATES || candidateTextLength > MAX_CANDIDATE_TEXT) {
      return { kind: "abstain", reason: "no-authorized-claims" };
    }
    claims.push(claim);
  }

  if (claims.length === 0) {
    return { kind: "abstain", reason: "no-authorized-claims" };
  }

  const candidates = Object.freeze(claims.map((claim) => Object.freeze({
    id: claim.id,
    kind: claim.kind,
    chapter: claim.chapter,
    approvedText: claim.approvedText,
  })));

  try {
    const selection = await selector.selectClaims(context, candidates);
    return renderApprovedClaims(
      selection,
      "explain",
      context.progress,
      context.evidence,
      claims,
    );
  } catch {
    return { kind: "abstain", reason: "provider-failure" };
  }
}
