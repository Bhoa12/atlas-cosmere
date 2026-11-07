import { HoidAnswerRequest } from './types';

/**
 * Creates an immutable, detached request at the provider trust boundary.
 * Providers must never observe mutable application state because they can run
 * after a timeout and their asynchronous work is outside Atlas control.
 */
export function snapshotProviderRequest(request: HoidAnswerRequest): HoidAnswerRequest {
  const reading = request.reading.map((position) => Object.freeze({ ...position }));
  return Object.freeze({
    question: request.question,
    reading: Object.freeze(reading),
  });
}
