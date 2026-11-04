import { HoidAnswer, HoidAnswerRequest, ReadingPosition } from './types';

export type SpoilerRule = {
  terms: string[];
  minimum: { bookId: string; chapter: number };
  message: string;
};

/**
 * Rules are deliberately explicit. A term is not considered unlocked merely
 * because a different book was marked read.
 */
const rules: SpoilerRule[] = [
  {
    terms: ['thaidakar'],
    minimum: { bookId: 'sh', chapter: 1 },
    message: 'Ese nombre todavía no forma parte del camino que has recorrido. Guarda esa pregunta para cuando la historia te haya presentado sus propias respuestas.'
  }
];

function hasReached(reading: ReadingPosition[], minimum: SpoilerRule['minimum']): boolean {
  const position = reading.find(item => item.bookId === minimum.bookId);
  if (!position) return false;
  return position.completed === true || (position.chapter !== undefined && position.chapter >= minimum.chapter);
}

function matchedLockedRule(text: string, reading: ReadingPosition[]): SpoilerRule | undefined {
  const normalized = text.toLocaleLowerCase();
  return rules.find(rule => rule.terms.some(term => normalized.includes(term.toLocaleLowerCase())) && !hasReached(reading, rule.minimum));
}

export function guardQuestion(request: HoidAnswerRequest): HoidAnswer | null {
  const rule = matchedLockedRule(request.question, request.reading);
  return rule ? { text: rule.message, blocked: true, reason: 'reading-position' } : null;
}

/**
 * Fail closed when a provider response contains a known locked term. This is
 * not a replacement for canonical retrieval; it is a final deterministic
 * safety net before text reaches the UI.
 */
export function redactProviderAnswer(answer: string, request: HoidAnswerRequest): HoidAnswer {
  const rule = matchedLockedRule(answer, request.reading);
  if (rule) {
    return {
      text: 'He empezado a seguir un sendero que podría revelar más de lo que has leído. Mejor dejemos ese misterio sellado por ahora.',
      blocked: true,
      reason: 'provider-output'
    };
  }
  return { text: answer, blocked: false };
}
