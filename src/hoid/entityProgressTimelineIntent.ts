export type HoidEntityProgressTimelineIntent =
  | Readonly<{ status: "not-timeline" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "ready"; entityName: string }>
  | Readonly<{ status: "invalid" }>;

const MAX_QUESTION_LENGTH = 4_000;
const MAX_ENTITY_NAME_LENGTH = 256;

const PREFIXES: readonly RegExp[] = Object.freeze([
  /^(?:¿\\s*)?(?:cu[aá]l\\s+es\\s+la\\s+)?(?:evoluci[oó]n|cronolog[ií]a|trayectoria)\\s+(?:de\\s+la|del|de)\\s*/iu,
  /^(?:¿\\s*)?c[oó]mo\\s+(?:ha\\s+cambiado|evoluciona|ha\\s+evolucionado)\\s*/iu,
  /^(?:¿\\s*)?c[oó]mo\\s+ha\\s+sido\\s+la\\s+evoluci[oó]n\\s+de\\s*/iu,
  /^(?:¿\\s*)?what(?:\\s+is)?\\s+the\\s+(?:timeline|evolution|character\\s+arc)\\s+of\\s*/iu,
  /^(?:\\s*)?timeline\\s+of\\s*/iu,
  /^(?:\\s*)?evolution\\s+of\\s*/iu,
  /^(?:\\s*)?character\\s+arc\\s+of\\s*/iu,
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

function canonicalEntityName(value: string): string {
  return value
    .replace(/[?!¡¿.,;:…]+$/u, "")
    .replace(/^["'“”«»]+|["'“”«»]+$/gu, "")
    .trim();
}

/**
 * Deterministic routing for progress-aware entity timelines.
 *
 * The returned name is only an exact alias lookup key. The timeline adapter
 * reports reading-order evidence, never inferred in-world chronology.
 */
export function classifyHoidEntityProgressTimelineIntent(
  value: unknown,
): HoidEntityProgressTimelineIntent {
  const question = canonicalQuestion(value);
  if (!question) return Object.freeze({ status: "invalid" });

  for (const prefix of PREFIXES) {
    const match = prefix.exec(question);
    if (!match) continue;
    const entityName = canonicalEntityName(question.slice(match[0].length));
    if (!entityName) return Object.freeze({ status: "needs-name" });
    if (
      entityName.length > MAX_ENTITY_NAME_LENGTH ||
      /[\\u0000-\\u001F\\u007F\\p{Cf}]/u.test(entityName)
    ) return Object.freeze({ status: "invalid" });
    return Object.freeze({ status: "ready", entityName });
  }

  return Object.freeze({ status: "not-timeline" });
}
