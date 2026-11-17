import type { HoidClaimIntent } from "./evidenceRuntime";

export type HoidConversationIntentSignal =
  | "recommendation-cue"
  | "reading-context-cue"
  | "default-explanation";

export type HoidConversationIntentResult =
  | Readonly<{
      status: "ready";
      intent: HoidClaimIntent;
      signal: HoidConversationIntentSignal;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-question";
    }>;

const MAX_QUESTION_LENGTH = 4_000;

const RECOMMENDATION_CUES = Object.freeze([
  "recomienda",
  "recomiendas",
  "recomiendame",
  "recomendar",
  "recomendacion",
  "recomendaciones",
  "recomendarias leer",
  "me recomiendas",
  "que libro leo",
  "que libro deberia leer",
  "que deberia leer",
  "que leo despues",
  "siguiente libro",
  "siguiente lectura",
  "proxima lectura",
  "proximo libro",
  "que obra leo",
  "que me aconsejas leer",
  "aconsejame",
]);

const READING_CONTEXT_CUES = Object.freeze([
  "donde me quede",
  "en que capitulo voy",
  "hasta donde he leido",
  "que he leido",
  "que llevo leido",
  "mi progreso",
  "resumen de lo leido",
  "recuerdame",
  "ponme al dia",
  "contexto de lectura",
  "que ha pasado hasta",
  "que habia pasado hasta",
]);

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsCue(normalizedQuestion: string, cues: readonly string[]): boolean {
  const padded = ` ${normalizedQuestion} `;
  return cues.some(cue => padded.includes(` ${cue} `));
}

/**
 * Deterministic, provider-free intent routing.
 *
 * This classifier chooses only among the existing evidence-runtime intents.
 * It never extracts character names, infers plot facts or authorizes evidence.
 * Recommendation cues take precedence over context cues; all other valid
 * questions use the conservative "explain" route.
 */
export function classifyHoidConversationIntent(
  value: unknown,
): HoidConversationIntentResult {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_QUESTION_LENGTH ||
    value !== value.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(value)
  ) {
    return Object.freeze({ status: "unavailable", reason: "invalid-question" });
  }

  let normalizedQuestion: string;
  try {
    normalizedQuestion = normalizeQuestion(value);
  } catch {
    return Object.freeze({ status: "unavailable", reason: "invalid-question" });
  }
  if (!normalizedQuestion) {
    return Object.freeze({ status: "unavailable", reason: "invalid-question" });
  }

  if (containsCue(normalizedQuestion, RECOMMENDATION_CUES)) {
    return Object.freeze({
      status: "ready",
      intent: "recommend",
      signal: "recommendation-cue",
    });
  }

  if (containsCue(normalizedQuestion, READING_CONTEXT_CUES)) {
    return Object.freeze({
      status: "ready",
      intent: "context",
      signal: "reading-context-cue",
    });
  }

  return Object.freeze({
    status: "ready",
    intent: "explain",
    signal: "default-explanation",
  });
}
