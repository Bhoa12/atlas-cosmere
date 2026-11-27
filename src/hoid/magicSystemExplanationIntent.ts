export type HoidMagicSystemFacet =
  | "principle"
  | "rule"
  | "limitation"
  | "cost"
  | "application"
  | "exception"
  | "interaction";

export type HoidMagicSystemExplanationIntent =
  | Readonly<{ status: "not-magic" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "ready"; systemName: string; facet?: HoidMagicSystemFacet }>
  | Readonly<{ status: "invalid" }>;

const MAX_QUESTION_LENGTH = 4_000;
const MAX_SYSTEM_NAME_LENGTH = 256;

type Prefix = Readonly<{ pattern: RegExp; facet?: HoidMagicSystemFacet }>;

const PREFIXES: readonly Prefix[] = Object.freeze([
  { pattern: /^(?:¿\\s*)?(?:c[oó]mo\\s+(?:funciona|opera)\\s+)(?:el\\s+)?(?:sistema\\s+de\\s+magia\\s+)?/iu, facet: "principle" },
  { pattern: /^(?:¿\\s*)?expl[ií]came\\s+(?:el\\s+)?(?:sistema\\s+de\\s+magia\\s+)?/iu },
  { pattern: /^(?:¿\\s*)?(?:cu[aá]les\\s+son\\s+las?\\s+)?reglas\\s+de\\s+/iu, facet: "rule" },
  { pattern: /^(?:¿\\s*)?limitaciones\\s+de\\s+/iu, facet: "limitation" },
  { pattern: /^(?:¿\\s*)?costes?\\s+de\\s+/iu, facet: "cost" },
  { pattern: /^(?:¿\\s*)?aplicaciones\\s+de\\s+/iu, facet: "application" },
  { pattern: /^(?:¿\\s*)?excepciones\\s+de\\s+/iu, facet: "exception" },
  { pattern: /^(?:¿\\s*)?interacciones\\s+de\\s+/iu, facet: "interaction" },
  { pattern: /^(?:¿\\s*)?principios\\s+de\\s+/iu, facet: "principle" },
  { pattern: /^how\\s+does\\s+/iu, facet: "principle" },
  { pattern: /^explain\\s+(?:the\\s+)?(?:magic\\s+system\\s+(?:of\\s+)?)?/iu },
  { pattern: /^(?:what\\s+are\\s+the\\s+)?rules\\s+of\\s+/iu, facet: "rule" },
  { pattern: /^limitations\\s+of\\s+/iu, facet: "limitation" },
  { pattern: /^costs?\\s+of\\s+/iu, facet: "cost" },
  { pattern: /^applications?\\s+of\\s+/iu, facet: "application" },
  { pattern: /^exceptions?\\s+of\\s+/iu, facet: "exception" },
  { pattern: /^interactions?\\s+of\\s+/iu, facet: "interaction" },
  { pattern: /^principles?\\s+of\\s+/iu, facet: "principle" },
]);

function canonicalQuestion(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_QUESTION_LENGTH ||
    value !== value.trim() ||
    /[\\u0000-\\u001F\\u007F\\p{Cf}]/u.test(value)
  ) return null;
  return value;
}

function canonicalSystemName(value: string): string {
  return value
    .replace(/[?!¡¿.,;:…]+$/u, "")
    .replace(/^[\"'“”«»]+|[\"'“”«»]+$/gu, "")
    .replace(/\\s+(?:magic|system)$/iu, "")
    .trim();
}

/**
 * Deterministic exact-name routing. This parser does not resolve aliases,
 * search for entities or infer a magic system from ordinary prose.
 */
export function classifyHoidMagicSystemExplanationIntent(
  value: unknown,
): HoidMagicSystemExplanationIntent {
  const question = canonicalQuestion(value);
  if (!question) return Object.freeze({ status: "invalid" });

  for (const prefix of PREFIXES) {
    const match = prefix.pattern.exec(question);
    if (!match) continue;
    let remainder = question.slice(match[0].length);
    if (/^how\\s+does\\s+/iu.test(match[0])) {
      remainder = remainder.replace(/\\s+work[?!.,;:…]*$/iu, "");
    }
    const systemName = canonicalSystemName(remainder);
    if (!systemName) return Object.freeze({ status: "needs-name" });
    if (
      systemName.length > MAX_SYSTEM_NAME_LENGTH ||
      /[\\u0000-\\u001F\\u007F\\p{Cf}]/u.test(systemName)
    ) return Object.freeze({ status: "invalid" });
    return Object.freeze({
      status: "ready",
      systemName,
      ...(prefix.facet ? { facet: prefix.facet } : {}),
    });
  }

  return Object.freeze({ status: "not-magic" });
}
