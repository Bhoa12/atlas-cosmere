import { buildReadingContext } from './readingContext';
import { HoidAnswerRequest } from './types';

/**
 * Creates an immutable, detached request at the provider trust boundary.
 *
 * The provider receives canonical metadata rather than raw UI progress:
 * duplicate updates are collapsed, malformed chapters cannot inflate access,
 * and unknown works are removed before any external integration sees them.
 * Providers must never observe mutable application state because they can run
 * after a timeout and their asynchronous work is outside Atlas control.
 */
export type ProviderSnapshotOptions = {\n  /**\n   * Only enable this for context constructed internally after editorial and\n   * provenance checks. Caller-supplied knowledge is never trusted by default.\n   */\n  includeAuthorizedKnowledgeContext?: boolean;\n};\n\nexport function snapshotProviderRequest(\n  request: HoidAnswerRequest,\n  options: ProviderSnapshotOptions = {},\n): HoidAnswerRequest {
  const reading = buildReadingContext(request.reading)
    .map((position) => Object.freeze({ ...position }));

  const knowledgeContext = request.knowledgeContext
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
