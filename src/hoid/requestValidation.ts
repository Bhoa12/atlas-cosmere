/**
 * Validate untrusted user input before it reaches any provider or spoiler
 * boundary. This is deliberately provider-neutral and does not interpret
 * narrative content.
 */
export const DEFAULT_MAX_HOID_QUESTION_LENGTH = 6_000;

export function validHoidQuestion(
  value: unknown,
  maxLength = DEFAULT_MAX_HOID_QUESTION_LENGTH,
): string | null {
  if (typeof value !== 'string') return null;
  if (!Number.isFinite(maxLength) || maxLength <= 0) return null;

  const question = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

  if (!question || question.length > Math.floor(maxLength)) return null;
  return question;
}
