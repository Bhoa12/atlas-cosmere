/**
 * Hoid IA: request normalization and intent contract.
 *
 * This boundary does not infer narrative facts. It only classifies how a
 * safe response may be presented after scope and evidence checks succeed.
 */

export type HoidResponseIntent = "explain" | "recommend";

export interface HoidRequest {
  readonly question: string;
  readonly intent: HoidResponseIntent;
  readonly bookId: string;
  readonly chapter?: number;
}

export type NormalizedHoidRequest =
  | {
      readonly valid: true;
      readonly question: string;
      readonly intent: HoidResponseIntent;
      readonly bookId: string;
      readonly chapter?: number;
    }
  | {
      readonly valid: false;
      readonly reason: "empty-question" | "invalid-intent" | "missing-book" | "invalid-chapter";
    };

const INTENTS: ReadonlySet<string> = new Set(["explain", "recommend"]);

export function normalizeHoidRequest(input: Partial<HoidRequest>): NormalizedHoidRequest {
  const question = input.question?.trim();
  if (!question) return { valid: false, reason: "empty-question" };

  if (!input.intent || !INTENTS.has(input.intent)) {
    return { valid: false, reason: "invalid-intent" };
  }

  const bookId = input.bookId?.trim();
  if (!bookId) return { valid: false, reason: "missing-book" };

  if (
    input.chapter !== undefined &&
    (!Number.isInteger(input.chapter) || input.chapter < 1)
  ) {
    return { valid: false, reason: "invalid-chapter" };
  }

  return {
    valid: true,
    question,
    intent: input.intent,
    bookId,
    chapter: input.chapter,
  };
}
