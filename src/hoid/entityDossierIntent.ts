export type HoidEntityDossierIntent =
  | Readonly<{ status: "not-dossier" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "ready"; entityName: string }>
  | Readonly<{ status: "invalid" }>;

const MAX_QUESTION_LENGTH = 4_000;
const MAX_ENTITY_NAME_LENGTH = 256;

const PREFIXES: readonly RegExp[] = Object.freeze([
  /^(?:¿\s*)?qui[eé]n(?:es)?\s+(?:es|son|fue|era)\b\s*/iu,
  /^(?:¿\s*)?dime\s+qui[eé]n\s+es\b\s*/iu,
  /^(?:¿\s*)?h[aá]blame\s+de\b\s*/iu,
  /^(?:¿\s*)?cu[eé]ntame\s+de\b\s*/iu,
  /^(?:¿\s*)?qu[eé]\s+sabemos\s+de\b\s*/iu,
  /^(?:¿\s*)?dime\s+(?:algo\s+)?sobre\b\s*/iu,
  /^(?:¿\s*)?perfil\s+de\b\s*/iu,
  /^(?:¿\s*)?ficha\s+de\b\s*/iu,
  /^(?:¿\s*)?expediente\s+de\b\s*/iu,
  /^(?:¿\s*)?describe\s+(?:a|al|la|el)\b\s*/iu,
  /^(?:¿\s*)?describe\b\s*/iu,
  /^(?:\s*)?who\s+is\b\s*/iu,
  /^(?:\s*)?tell\s+me\s+about\b\s*/iu,
  /^(?:\s*)?what\s+do\s+we\s+know\s+about\b\s*/iu,
  /^(?:¿\s*)?qu[eé]\s+es\b\s*/iu,
  /^(?:¿\s*)?qu[eé]\s+significa\b\s*/iu,
]);

function canonicalQuestion(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_QUESTION_LENGTH ||
    value !== value.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(value)
  ) return null;
  return value;
}

function canonicalEntityName(value: string): string {
  return value
    .replace(/[?!¡¿.,;:…]+$/u, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/gu, "")
    .trim();
}

/**
 * Deterministic local routing for entity/concept dossiers.
 *
 * A recognized dossier question is never allowed to fall through to a
 * provider when the name is missing, ambiguous, unknown or still locked.
 * The returned name is only an exact alias lookup key; no fuzzy matching or
 * model-generated entity candidates are permitted.
 */
export function classifyHoidEntityDossierIntent(value: unknown): HoidEntityDossierIntent {
  const question = canonicalQuestion(value);
  if (!question) return Object.freeze({ status: "invalid" });

  for (const prefix of PREFIXES) {
    const match = prefix.exec(question);
    if (!match) continue;
    const entityName = canonicalEntityName(question.slice(match[0].length));
    if (!entityName) return Object.freeze({ status: "needs-name" });
    if (
      entityName.length > MAX_ENTITY_NAME_LENGTH ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(entityName)
    ) return Object.freeze({ status: "invalid" });
    return Object.freeze({ status: "ready", entityName });
  }

  return Object.freeze({ status: "not-dossier" });
}
