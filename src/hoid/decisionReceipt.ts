/**
 * Safe decision receipts describe an already-made security decision without
 * carrying narrative prose. They are suitable for UI explanations and
 * diagnostics because every field is bounded and normalized.
 */
export type HoidDecisionOutcome = "authorized" | "limited" | "blocked" | "abstain";
export type HoidDecisionBoundary =
  | "input"
  | "progress"
  | "authorization"
  | "retrieval"
  | "provider"
  | "response";

export interface HoidDecisionReceipt {
  outcome: HoidDecisionOutcome;
  boundary: HoidDecisionBoundary;
  reason: string;
  bookId?: string;
  chapter?: number;
  evidenceIds?: string[];
}

export const DEFAULT_MAX_RECEIPT_REASON_LENGTH = 128;
export const DEFAULT_MAX_RECEIPT_BOOK_ID_LENGTH = 256;
export const DEFAULT_MAX_RECEIPT_CHAPTER = 100_000_000;
export const DEFAULT_MAX_RECEIPT_EVIDENCE_IDS = 16;
export const DEFAULT_MAX_RECEIPT_EVIDENCE_ID_LENGTH = 256;

function boundedString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : undefined;
}

/**
 * Creates a sanitized receipt. Invalid optional metadata is omitted rather
 * than preserved, so a receipt can never become a side channel for provider
 * prose or spoiler-bearing free text.
 */
export function createHoidDecisionReceipt(value: unknown): HoidDecisionReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<HoidDecisionReceipt>;
  if (
    raw.outcome !== "authorized" &&
    raw.outcome !== "limited" &&
    raw.outcome !== "blocked" &&
    raw.outcome !== "abstain"
  ) return null;
  if (
    raw.boundary !== "input" &&
    raw.boundary !== "progress" &&
    raw.boundary !== "authorization" &&
    raw.boundary !== "retrieval" &&
    raw.boundary !== "provider" &&
    raw.boundary !== "response"
  ) return null;

  const reason = boundedString(raw.reason, DEFAULT_MAX_RECEIPT_REASON_LENGTH);
  if (!reason || !/^[a-z0-9-]+$/.test(reason)) return null;

  const receipt: HoidDecisionReceipt = { outcome: raw.outcome, boundary: raw.boundary, reason };
  const bookId = boundedString(raw.bookId, DEFAULT_MAX_RECEIPT_BOOK_ID_LENGTH);
  if (bookId) receipt.bookId = bookId;
  if (Number.isSafeInteger(raw.chapter) && raw.chapter! >= 0 && raw.chapter! <= DEFAULT_MAX_RECEIPT_CHAPTER) {
    receipt.chapter = raw.chapter;
  }
  if (Array.isArray(raw.evidenceIds) && raw.evidenceIds.length > 0 && raw.evidenceIds.length <= DEFAULT_MAX_RECEIPT_EVIDENCE_IDS) {
    const ids = [...new Set(raw.evidenceIds.map((id) => boundedString(id, DEFAULT_MAX_RECEIPT_EVIDENCE_ID_LENGTH)))];
    if (ids.every((id) => id && /^[a-z0-9:_-]+$/i.test(id))) {
      receipt.evidenceIds = ids as string[];
    }
  }
  return receipt;
}
