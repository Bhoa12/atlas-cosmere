/**
 * Validate untrusted user input before it reaches any provider or spoiler
 * boundary. This is deliberately provider-neutral and does not interpret
 * narrative content.
 */
export const DEFAULT_MAX_HOID_QUESTION_LENGTH = 6_000;
export const DEFAULT_MAX_RAW_HOID_QUESTION_LENGTH = 12_000;

export function validHoidQuestion(
  value: unknown,
  maxLength = DEFAULT_MAX_HOID_QUESTION_LENGTH,
  maxRawLength = DEFAULT_MAX_RAW_HOID_QUESTION_LENGTH,
): string | null {
  if (typeof value !== 'string') return null;
  if (!Number.isFinite(maxLength) || maxLength <= 0) return null;
  if (!Number.isFinite(maxRawLength) || maxRawLength <= 0) return null;

  // Reject oversized payloads before Unicode normalization. Normalization and
  // later filtering can allocate proportional intermediate strings, so the raw
  // transport boundary must be bounded independently of the visible contract.
  if (value.length > Math.floor(maxRawLength)) return null;

  // Unicode format controls can hide or reorder visible text without adding
  // narrative meaning. Remove them before every later trust boundary so the
  // spoiler guard and provider receive one canonical visible question.
  const question = value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\p{Cf}/gu, '')
    .trim();

  if (!question || question.length > Math.floor(maxLength)) return null;
  return question;
}
