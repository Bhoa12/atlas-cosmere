import type { HoidClaimIntent } from "./evidenceRuntime";

export type HoidConversationIntentMode =
  | "catalogue-recommendation"
  | "reading-progress"
  | "narrative-context"
  | "explanation";

export type HoidConversationIntentSignal =
  | "recommendation-cue"
  | "progress-position-cue"
  | "narrative-recap-cue"
  | "default-explanation";

export type HoidConversationIntentResult =
  | Readonly<{
      status: "ready";
      intent: HoidClaimIntent;
      mode: HoidConversationIntentMode;
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
  "que puedo leer",
  "siguiente libro",
  "siguiente lectura",
  "proxima lectura",
  "proximo libro",
  "que obra leo",
  "que me aconsejas leer",
  "sugerencia de lectura",
  "sugerencias de lectura",
  "sugiereme una lectura",
  "aconsejame",
]);

const PROGRESS_POSITION_CUES = Object.freeze([
  "donde me quede",
  "en que capitulo voy",
  "en que capitulo estoy",
  "hasta donde he leido",
  "que he leido",
  "que llevo leido",
  "mi progreso",
  "por donde voy",
  "que libros he empezado",
  "que obras he empezado",
]);

const NARRATIVE_RECAP_CUES = Object.freeze([
  "resumen de lo leido",
  "resumen de lo que he leido",
  "resume lo que he leido",
  "recuerdame lo que",
  "ponme al dia",
  "contexto de lectura",
  "que ha pasado hasta",
  "que habia pasado hasta",
  "recapitulacion",
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
 * The mode selects a local capability, while intent remains one of the
 * existing evidence-runtime intents. A reading-progress mode may use only
 * the validated v2 cursor snapshot; a narrative recap still requires approved
 * editorial claims. Recommendation cues take precedence over context cues.
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
      mode: "catalogue-recommendation",
      signal: "recommendation-cue",
    });
  }

  if (containsCue(normalizedQuestion, NARRATIVE_RECAP_CUES)) {
    return Object.freeze({
      status: "ready",
      intent: "context",
      mode: "narrative-context",
      signal: "narrative-recap-cue",
    });
  }

  if (containsCue(normalizedQuestion, PROGRESS_POSITION_CUES)) {
    return Object.freeze({
      status: "ready",
      intent: "context",
      mode: "reading-progress",
      signal: "progress-position-cue",
    });
  }

  return Object.freeze({
    status: "ready",
    intent: "explain",
    mode: "explanation",
    signal: "default-explanation",
  });
}
