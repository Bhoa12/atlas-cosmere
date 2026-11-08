/**
 * Runtime boundary for text returned by external Hoid providers.
 *
 * Provider output is untrusted. Normalize invisible transport and formatting
 * characters before spoiler checks so the same visible text is evaluated by
 * every downstream boundary.
 */
export const DEFAULT_MAX_PROVIDER_TEXT_LENGTH = 12_000;

const TRANSPORT_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const INVISIBLE_FORMAT_CONTROLS = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;

export function validProviderText(
  value: unknown,
  maxLength = DEFAULT_MAX_PROVIDER_TEXT_LENGTH,
): string | null {
  if (typeof value !== "string") return null;
  if (!Number.isFinite(maxLength) || maxLength <= 0) return null;

  // NFKC keeps visible wording readable while preventing compatibility forms
  // and invisible Unicode controls from making provider text appear differently
  // to the reader and the spoiler guard.
  const text = value
    .normalize("NFKC")
    .replace(TRANSPORT_CONTROLS, "")
    .replace(INVISIBLE_FORMAT_CONTROLS, "")
    .trim();

  if (!text || text.length > Math.floor(maxLength)) return null;
  return text;
}
