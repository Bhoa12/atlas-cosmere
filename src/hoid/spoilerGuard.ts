import { HoidAnswer, HoidAnswerRequest, ReadingPosition } from './types';

export type SpoilerRule = { terms: string[]; minimum?: ReadingPosition; message: string };

const rules: SpoilerRule[] = [
  { terms: ['thaidakar', 'kelsier'], minimum: { bookId: 'sh', order: 999 }, message: 'Ese nombre todavía no forma parte del camino que has recorrido. Guarda esa pregunta para cuando la historia te haya presentado sus propias respuestas.' }
];

function hasReached(reading: ReadingPosition[], minimum?: ReadingPosition): boolean {
  if (!minimum) return true;
  return reading.some(position => position.bookId === minimum.bookId && (position.chapter === undefined || minimum.chapter === undefined || position.chapter >= minimum.chapter));
}

export function guardQuestion(request: HoidAnswerRequest): HoidAnswer | null {
  const normalized = request.question.toLowerCase();
  for (const rule of rules) if (rule.terms.some(term => normalized.includes(term)) && !hasReached(request.reading, rule.minimum)) return { text: rule.message, blocked: true, reason: 'reading-position' };
  return null;
}

export function redactProviderAnswer(answer: string, request: HoidAnswerRequest): HoidAnswer {
  return guardQuestion(request) ?? { text: answer, blocked: false };
}
