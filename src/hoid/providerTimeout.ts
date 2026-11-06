/**
 * Provider invocation timeout boundary for Hoid IA.
 *
 * A slow or hanging provider must not keep a reader request alive indefinitely.
 * This helper is provider-neutral and deliberately converts timeout failures
 * into a conservative null result; the pipeline can then expose its existing
 * no-invention fallback without leaking partial provider output.
 */
export async function answerWithinTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), Math.floor(timeoutMs));
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
