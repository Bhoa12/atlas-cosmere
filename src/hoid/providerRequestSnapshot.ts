import { buildReadingContext } from './readingContext';
import { HoidAnswerRequest, ReadingPosition } from './types';

/**
 * Creates an immutable, detached request at the provider trust boundary.
 *
 * The provider receives canonical metadata rather than raw UI progress:
 * ambiguous or malformed progress fails closed, so it cannot inflate access,
 * and unknown works are removed before any external integration sees them.
 * Providers must never observe mutable application state because they can run
 * after a timeout and their asynchronous work is outside Atlas control.
 */
export type ProviderSnapshotOptions = {
  /**
   * Only enable this for context constructed internally after editorial and
   * provenance checks. Caller-supplied knowledge is never trusted by default.
   */
  includeAuthorizedKnowledgeContext?: boolean;
};

export function snapshotProviderRequest(
  request: HoidAnswerRequest,
  options: ProviderSnapshotOptions = {},
): HoidAnswerRequest {
  // buildReadingContext is a presentation projection with both "chapter"
  // and "completed" fields. The provider contract is the exclusive
  // ReadingPosition union, so reconstruct exactly one progress form before
  // the snapshot crosses the trust boundary.
  const reading: ReadingPosition[] = buildReadingContext(request.reading).map(position =>
    position.completed
      ? { bookId: position.bookId, completed: true }
      : { bookId: position.bookId, chapter: position.chapter },
  ).map(position => Object.freeze(position));

  const knowledgeContext = options.includeAuthorizedKnowledgeContext && request.knowledgeContext
    ? request.knowledgeContext.map((fact) => Object.freeze({
        id: fact.id,
        kind: fact.kind,
        source: Object.freeze({ ...fact.source }),
        summary: fact.summary,
      }))
    : undefined;

  return Object.freeze({
    question: request.question,
    reading: Object.freeze(reading),
    ...(knowledgeContext ? { knowledgeContext: Object.freeze(knowledgeContext) } : {}),
  });
}
