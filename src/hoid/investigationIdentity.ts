import { canonicalizeHoidAnswerBookScope } from "./answerScope";
import { sha256Hex } from "./sha256";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_SUBJECT_LABEL_LENGTH = 256;

export function fingerprintHoidInvestigationSubject(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > MAX_SUBJECT_LABEL_LENGTH ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(value)
  ) return null;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\p{Mn}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return normalized ? sha256Hex(normalized) : null;
}

export function fingerprintHoidInvestigationScope(
  progressRevision: unknown,
  progressFingerprint: unknown,
  bookScopeInput: unknown,
): string | null {
  if (
    typeof progressRevision !== "number" ||
    !Number.isSafeInteger(progressRevision) ||
    progressRevision < 0 ||
    typeof progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(progressFingerprint)
  ) return null;
  const scope = canonicalizeHoidAnswerBookScope(bookScopeInput);
  if (!scope) return null;
  return sha256Hex(JSON.stringify({
    mode: scope.mode,
    bookIds: scope.bookIds,
    progressRevision,
    progressFingerprint,
  }));
}
