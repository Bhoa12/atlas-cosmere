export type HoidEntityRelationshipIntent =
  | Readonly<{ status: "not-relationship" }>
  | Readonly<{ status: "needs-names" }>
  | Readonly<{ status: "ready"; leftEntityName: string; rightEntityName: string }>
  | Readonly<{ status: "invalid" }>;

const MAX_QUESTION_LENGTH = 4_000;
const MAX_ENTITY_NAME_LENGTH = 256;

type RelationshipForm = Readonly<{
  pattern: RegExp;
  separator: RegExp;
  suffix?: RegExp;
}>;

const PREFIXES: readonly RelationshipForm[] = Object.freeze([
  Object.freeze({
    pattern: /^(?:¿\s*)?qu[eé]\s+relaci[oó]n\s+(?:hay|existe)\s+entre\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?qu[eé]\s+conexi[oó]n\s+(?:hay|existe)\s+entre\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?conexi[oó]n\s+entre\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?v[ií]nculo\s+(?:hay\s+)?entre\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?c[oó]mo\s+se\s+relacionan\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?c[oó]mo\s+est[aá]n\s+relacionad[oa]s\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?en\s+qu[eé]\s+se\s+relacionan\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?qu[eé]\s+relaci[oó]n\s+tiene\b\s*/iu,
    separator: /\s+con\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?qu[eé]\s+une\s+a\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?qu[eé]\s+tienen\s+en\s+com[uú]n\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:¿\s*)?relaci[oó]n\s+entre\b\s*/iu,
    separator: /\s+(?:y|e)\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:\s*)?what\s+is\s+the\s+relationship\s+between\b\s*/iu,
    separator: /\s+and\s+/giu,
  }),
  Object.freeze({
    pattern: /^(?:\s*)?how\s+are\b\s*/iu,
    separator: /\s+and\s+/giu,
    suffix: /\s+(?:connected|related)[?!.]*$/iu,
  }),
  Object.freeze({
    pattern: /^(?:\s*)?what\s+unites\b\s*/iu,
    separator: /\s+and\s+/giu,
  }),
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

function canonicalName(value: string): string {
  return value
    .replace(/[?!¡¿.,;:…]+$/u, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/gu, "")
    .trim();
}

/**
 * Recognizes explicit two-entity relationship questions.
 * Names remain exact lookup keys; ambiguous conjunctions are rejected rather
 * than guessed, and a recognized relationship request never falls through
 * to a generic language provider.
 */
export function classifyHoidEntityRelationshipIntent(value: unknown): HoidEntityRelationshipIntent {
  const question = canonicalQuestion(value);
  if (!question) return Object.freeze({ status: "invalid" });

  for (const form of PREFIXES) {
    const prefix = form.pattern.exec(question);
    if (!prefix) continue;

    let remainder = question.slice(prefix[0].length).trim();
    if (form.suffix) remainder = remainder.replace(form.suffix, "").trim();
    if (!remainder) return Object.freeze({ status: "needs-names" });

    const separators = [...remainder.matchAll(form.separator)];
    if (separators.length === 0) return Object.freeze({ status: "needs-names" });
    if (separators.length !== 1) return Object.freeze({ status: "invalid" });

    const separator = separators[0];
    const index = separator.index;
    if (typeof index !== "number") return Object.freeze({ status: "invalid" });
    const leftEntityName = canonicalName(remainder.slice(0, index));
    const rightEntityName = canonicalName(remainder.slice(index + separator[0].length));

    if (!leftEntityName || !rightEntityName) return Object.freeze({ status: "needs-names" });
    if (
      leftEntityName.length > MAX_ENTITY_NAME_LENGTH ||
      rightEntityName.length > MAX_ENTITY_NAME_LENGTH ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(leftEntityName) ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(rightEntityName)
    ) return Object.freeze({ status: "invalid" });

    const normalize = (name: string) => name.normalize("NFKC").toLowerCase();
    if (normalize(leftEntityName) === normalize(rightEntityName)) {
      return Object.freeze({ status: "invalid" });
    }

    return Object.freeze({ status: "ready", leftEntityName, rightEntityName });
  }

  return Object.freeze({ status: "not-relationship" });
}
