/**
 * Provider invocation timeout boundary for Hoid IA.
 *
 * A slow or hanging provider must not keep a reader request alive indefinitely.
 * This helper is provider-neutral and deliberately converts timeout failures
 * into a conservative null result; the pipeline can then expose its existing
 * no-invention fallback without leaking partial provider output.
 *
 * The timer is unref'd when the runtime supports it so a pending provider
 * timeout cannot keep a server process alive by itself.
 */
export async function answerWithinTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;

  // Round up so every positive finite timeout gets a real deadline instead of
  // silently becoming a zero-millisecond race.
  const effectiveTimeoutMs = Math.ceil(timeoutMs);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), effectiveTimeoutMs);
        const nodeTimer = timer as ReturnType<typeof setTimeout> & { unref?: () => void };
        nodeTimer.unref?.();
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}


export type ProviderInvocationOutcome<T> =
  | Readonly<{ status: "completed"; value: T }>
  | Readonly<{ status: "timeout" }>
  | Readonly<{ status: "aborted" }>
  | Readonly<{ status: "failed" }>;

/**
 * Invoke a provider with a cooperative cancellation signal and a hard caller
 * deadline. A timeout or caller abort settles Hoid immediately and aborts the
 * signal. If an adapter ignores AbortSignal, its eventual value is observed
 * only by this settled promise chain and can never re-enter the answer path.
 */
export async function invokeWithProviderDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<ProviderInvocationOutcome<T>> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Object.freeze({ status: "failed" });
  }
  if (callerSignal?.aborted) {
    return Object.freeze({ status: "aborted" });
  }

  const controller = new AbortController();
  const effectiveTimeoutMs = Math.ceil(timeoutMs);

  return new Promise<ProviderInvocationOutcome<T>>(resolve => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    };

    const finish = (outcome: ProviderInvocationOutcome<T>) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome.status !== "completed" && !controller.signal.aborted) {
        controller.abort();
      }
      resolve(Object.freeze(outcome));
    };

    const onCallerAbort = () => finish({ status: "aborted" });

    try {
      callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
      if (callerSignal?.aborted) {
        onCallerAbort();
        return;
      }

      timer = setTimeout(() => finish({ status: "timeout" }), effectiveTimeoutMs);
      const nodeTimer = timer as ReturnType<typeof setTimeout> & { unref?: () => void };
      nodeTimer.unref?.();

      // Deferring invocation ensures the deadline and abort listener are
      // installed before any adapter code can run.
      void Promise.resolve()
        .then(() => operation(controller.signal))
        .then(
          value => finish({ status: "completed", value }),
          () => finish({ status: "failed" }),
        );
    } catch {
      finish({ status: "failed" });
    }
  });
}
