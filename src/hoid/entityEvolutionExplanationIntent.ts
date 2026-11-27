export type HoidCharacterEvolutionDimension =
  | "perspective"
  | "knowledge"
  | "capability"
  | "affiliation"
  | "relationship"
  | "status"
  | "motivation"
  | "cause";

export type HoidCharacterEvolutionIntent =
  | Readonly<{ status: "not-evolution" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{
      status: "ready";
      characterName: string;
      dimension?: HoidCharacterEvolutionDimension;
    }>;

type Prefix = Readonly<{
  pattern: RegExp;
  dimension?: HoidCharacterEvolutionDimension;
  stripEnding?: RegExp;
}>;

const MAX_QUESTION_LENGTH = 4_000;
const MAX_CHARACTER_NAME_LENGTH = 256;

/**
 * Exact, punctuation-tolerant forms that express an evolution intent but
 * contain no entity name. Keep these separate from the extraction prefixes:
 * punctuation must not be mistaken for a character name.
 */
const EMPTY_NAME_PATTERNS: readonly RegExp[] = Object.freeze([
  /^(?:¿\\s*)?cómo\\s+ha\\s+(?:evolucionado|cambiado)(?:\\s+el\\s+personaje\\s+de)?[?!.,;:…]*$/iu,
  /^(?:¿\\s*)?evolución\\s+(?:del\\s+personaje\\s+de|de)[?!.,;:…]*$/iu,
  /^(?:¿\\s*)?desarrollo\\s+(?:del\\s+personaje\\s+de|de)[?!.,;:…]*$/iu,
  /^(?:¿\\s*)?qué\\s+cambios\\s+conocemos\\s+de[?!.,;:…]*$/iu,
  /^(?:¿\\s*)?cambios?\\s+(?:conocidos?\\s+)?(?:en|de)[?!.,;:…]*$/iu,
  /^(?:¿\\s*)?(?:perspectiva|conocimientos?|capacidades?|afiliaciones?|relaciones?|estado|motivaciones?|causas?)\\s+de[?!.,;:…]*$/iu,
  /^how\\s+has[?!.,;:…]*$/iu,
  /^evolution\\s+of[?!.,;:…]*$/iu,
  /^character\\s+development\\s+of[?!.,;:…]*$/iu,
  /^changes?\\s+(?:for|in)[?!.,;:…]*$/iu,
  /^(?:perspective|knowledge|abilities|capabilities|affiliations?|relationships?|status|motivations?|causes?)\\s+of[?!.,;:…]*$/iu,
]);

const PREFIXES: readonly Prefix[] = Object.freeze([
  { pattern: /^(?:¿\s*)?cómo\s+ha\s+evolucionado(?:\s+el\s+personaje\s+de)?(?:\s+|$)/iu },
  { pattern: /^(?:¿\s*)?evolución\s+(?:del\s+personaje\s+de|de)(?:\s+|$)/iu },
  { pattern: /^(?:¿\s*)?qué\s+cambios\s+conocemos\s+de\s+/iu },
  { pattern: /^(?:¿\s*)?cómo\s+ha\s+evolucionado\s+(?:el\s+personaje\s+de\s+)?/iu },
  { pattern: /^(?:¿\s*)?cómo\s+ha\s+cambiado\s+(?:el\s+personaje\s+de\s+)?/iu },
  { pattern: /^(?:¿\s*)?evolución\s+(?:del\s+personaje\s+de\s+|de\s+)/iu },
  { pattern: /^(?:¿\s*)?desarrollo\s+(?:del\s+personaje\s+de\s+|de\s+)/iu },
  { pattern: /^(?:¿\s*)?cambios?\s+(?:conocidos?\s+)?(?:en|de)\s+/iu },
  { pattern: /^(?:¿\s*)?perspectiva\s+de\s+/iu, dimension: "perspective" },
  { pattern: /^(?:¿\s*)?conocimientos?\s+de\s+/iu, dimension: "knowledge" },
  { pattern: /^(?:¿\s*)?capacidades?\s+de\s+/iu, dimension: "capability" },
  { pattern: /^(?:¿\s*)?afiliaciones?\s+de\s+/iu, dimension: "affiliation" },
  { pattern: /^(?:¿\s*)?relaciones?\s+de\s+/iu, dimension: "relationship" },
  { pattern: /^(?:¿\s*)?estado\s+de\s+/iu, dimension: "status" },
  { pattern: /^(?:¿\s*)?motivaciones?\s+de\s+/iu, dimension: "motivation" },
  { pattern: /^(?:¿\s*)?causas?\s+de\s+/iu, dimension: "cause" },
  { pattern: /^how\s+has\s+/iu, stripEnding: /\s+(?:changed|evolved)[?!.,;:…]*$/iu },
  { pattern: /^evolution\s+of\s+/iu },
  { pattern: /^character\s+development\s+of\s+/iu },
  { pattern: /^changes?\s+(?:for|in)\s+/iu },
  { pattern: /^perspective\s+of\s+/iu, dimension: "perspective" },
  { pattern: /^knowledge\s+of\s+/iu, dimension: "knowledge" },
  { pattern: /^(?:abilities|capabilities)\s+of\s+/iu, dimension: "capability" },
  { pattern: /^affiliations?\s+of\s+/iu, dimension: "affiliation" },
  { pattern: /^relationships?\s+of\s+/iu, dimension: "relationship" },
  { pattern: /^status\s+of\s+/iu, dimension: "status" },
  { pattern: /^motivations?\s+of\s+/iu, dimension: "motivation" },
  { pattern: /^causes?\s+of\s+/iu, dimension: "cause" },
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

function canonicalCharacterName(value: string, stripEnding?: RegExp): string {
  let name = stripEnding ? value.replace(stripEnding, "") : value;
  name = name
    .replace(/\s+(?:hasta\s+ahora|hasta\s+donde\s+(?:he\s+)?le[ií]do|hasta\s+donde\s+voy)$/iu, "")
    .replace(/\s+(?:so\s+far|up\s+to\s+now|as\s+far\s+as\s+i(?:'|’)ve\s+read)$/iu, "")
    .replace(/[?!¡¿.,;:…]+$/u, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/gu, "")
    .trim();
  return name;
}

/**
 * Deterministic exact-name routing. It classifies an evolution question but
 * does not resolve aliases, search entities or infer narrative changes.
 */
export function classifyHoidCharacterEvolutionIntent(
  value: unknown,
): HoidCharacterEvolutionIntent {
  const question = canonicalQuestion(value);
  if (!question) return Object.freeze({ status: "invalid" });
  if (EMPTY_NAME_PATTERNS.some(pattern => pattern.test(question))) {
    return Object.freeze({ status: "needs-name" });
  }

  for (const prefix of PREFIXES) {
    const match = prefix.pattern.exec(question);
    if (!match) continue;
    const characterName = canonicalCharacterName(
      question.slice(match[0].length),
      prefix.stripEnding,
    );
    if (!characterName) return Object.freeze({ status: "needs-name" });
    if (
      characterName.length > MAX_CHARACTER_NAME_LENGTH ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(characterName)
    ) return Object.freeze({ status: "invalid" });
    return Object.freeze({
      status: "ready",
      characterName,
      ...(prefix.dimension ? { dimension: prefix.dimension } : {}),
    });
  }

  return Object.freeze({ status: "not-evolution" });
}
