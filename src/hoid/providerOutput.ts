/**
 * Runtime boundary for text returned by external Hoid providers.
 *
 * TypeScript contracts are not a security boundary: SDK adapters and remote
 * providers can still return malformed or unexpectedly large values at runtime.
 * Invalid output is rejected so the pipeline can fail closed before spoiler
 * checks or rendering.
 */
export const DEFAULT_MAX_PROVIDER_TEXT_LENGTH = 12_000;

export function validProviderText(
  value: unknown,
  maxLength = DEFAULT_MAX_PROVIDER_TEXT_LENGTH,
): string | null {
  if (typeof value !== "string") return null;
  if (!Number.isFinite(maxLength) || maxLength <= 0) return null;

  // Remove only transport-level control characters before deciding whether the
  // response is usable. A provider must not be able to turn an otherwise empty
  // answer into an accepted value by sending only invisible control bytes.
  const text = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();

  if (!text || text.length > Math.floor(maxLength)) return null;

  // Content is otherwise left untouched so later spoiler guards inspect the
  // provider's actual wording.
  return text;
}
