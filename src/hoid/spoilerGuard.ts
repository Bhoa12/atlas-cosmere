import { isKnownHoidSource } from './bibliography';
import { buildReadingContext } from './readingContext';
import { HoidAnswer, HoidAnswerRequest, ReadingPosition } from './types';

export type SpoilerRule = {
  terms: string[];
  minimum: { bookId: string; chapter: number };
  message: string;
};

/**
 * Rules are deliberately explicit. A term is not considered unlocked merely
 * because a different book was marked read.
 *
 * Rule positions are catalog identifiers. An invalid or stale identifier is
 * treated as locked rather than allowing a malformed rule to fail open.
 */
const rules: SpoilerRule[] = [
  {
    terms: ['thaidakar'],
    minimum: { bookId: 'sh', chapter: 1 },
    message: 'Ese nombre todavía no forma parte del camino que has recorrido. Guarda esa pregunta para cuando la historia te haya presentado sus propias respuestas.'
  }
];

/**
 * Normalize text at the deterministic spoiler boundary. Providers can insert
 * Unicode format characters such as zero-width spaces between letters; those
 * characters are invisible to readers but must not let a locked term bypass
 * the safety rules. NFKD also separates combining marks so invisible diacritics cannot split a
 * locked term. Neither transformation changes the text returned to the UI.
 */
function normalizeForSpoilerMatch(text: string): string {
  return text.normalize('NFKD').replace(/[\p{Cf}\p{Mn}]/gu, '').toLowerCase();
}

function hasReached(reading: ReadingPosition[], minimum: SpoilerRule['minimum']): boolean {
  // A rule that does not point at the verified source catalog must never grant
  // access. This keeps stale policy data from silently disabling spoiler safety.
  if (!isKnownHoidSource(minimum.bookId)) return false;

  // Reuse the canonical progress boundary instead of interpreting raw input
  // independently. Duplicate entries, invalid chapters and unknown works are
  // therefore handled identically by authorization and spoiler filtering.
  const position = buildReadingContext(reading)
    .find(item => item.bookId === minimum.bookId);

  if (!position) return false;
  return position.completed || position.chapter >= minimum.chapter;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsLockedTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeForSpoilerMatch(term);
  if (!normalizedTerm) return false;

  // Unicode-aware lexical boundaries avoid blocking innocent longer words while
  // still treating punctuation and whitespace as separators.
  const expression = new RegExp(
    "(^|[^\\p{L}\\p{N}])" + escapeRegexLiteral(normalizedTerm) + "($|[^\\p{L}\\p{N}])",
    "u",
  );
  return expression.test(text);
}

function matchedLockedRule(text: string, reading: ReadingPosition[]): SpoilerRule | undefined {
  const normalized = normalizeForSpoilerMatch(text);
  return rules.find(rule =>
    rule.terms.some(term => containsLockedTerm(normalized, term))
    && !hasReached(reading, rule.minimum),
  );
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
