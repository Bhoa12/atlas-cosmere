/**
 * Runtime boundary for text returned by external Hoid providers.
 *
 * TypeScript contracts are not a security boundary: SDK adapters and remote
 * providers can still return malformed values at runtime. Invalid output is
 * rejected so the pipeline can fail closed before spoiler checks or rendering.
 */
export function validProviderText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (!text) return null;

  // Remove only transport-level control characters. Content is otherwise left
  // untouched so later spoiler guards inspect the provider's actual wording.
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
