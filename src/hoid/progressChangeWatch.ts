import type { HoidRuntimeCallOptions } from "./evidenceRuntime";

/**
 * Emitted only after the durable reading ledger has committed a new snapshot.
 * The listener invalidates in-flight work; it never carries narrative data.
 */
export type HoidProgressChangeSubscription = (listener: () => void) => () => void;

export type HoidProgressWatchVerification = "current" | "changed" | "invalid";

export type HoidProgressWatchResult<T> =
  | Readonly<{ status: "completed"; value: T; progressChanged: false }>
  | Readonly<{ status: "failed"; progressChanged: boolean }>
  | Readonly<{ status: "cancelled"; reason: "caller-aborted" }>
  | Readonly<{ status: "unavailable" }>;

function callerCancelled(): HoidProgressWatchResult<never> {
  return Object.freeze({ status: "cancelled", reason: "caller-aborted" });
}

/**
 * Provider-neutral cancellation boundary for work tied to a reading snapshot.
 * A subscription is installed before a second durable read, closing the gap
 * between the gateway's initial freshness check and listener setup.
 *
 * Caller cancellation and progress invalidation both discard late values,
 * even when an adapter ignores AbortSignal. The post-call freshness check in
 * the gateway remains mandatory: notifications cannot replace authorization.
 */
export async function invokeWithHoidProgressChangeWatch<T>(input: Readonly<{
  subscribe?: HoidProgressChangeSubscription;
  options?: HoidRuntimeCallOptions;
  verifyCurrent: () => Promise<HoidProgressWatchVerification>;
  invoke: (options?: HoidRuntimeCallOptions) => T | Promise<T>;
}>): Promise<HoidProgressWatchResult<T>> {
  const callerSignal = input.options?.signal;
  if (callerSignal?.aborted) return callerCancelled();

  if (!input.subscribe) {
    try {
      const value = await input.invoke(input.options);
      return callerSignal?.aborted
        ? callerCancelled()
        : Object.freeze({ status: "completed", value, progressChanged: false });
    } catch {
      return callerSignal?.aborted
        ? callerCancelled()
        : Object.freeze({ status: "failed", progressChanged: false });
    }
  }

  const controller = new AbortController();
  let progressChanged = false;
  let callerAborted = false;
  let unsubscribe: (() => void) | undefined;
  let cleanupFailed = false;
  let outcome: HoidProgressWatchResult<T> = Object.freeze({ status: "unavailable" });
  const forwardCallerAbort = () => {
    callerAborted = true;
    controller.abort();
  };

  callerSignal?.addEventListener("abort", forwardCallerAbort, { once: true });

  try {
    const stop = input.subscribe(() => {
      progressChanged = true;
      controller.abort();
    });
    if (typeof stop !== "function") {
      outcome = Object.freeze({ status: "unavailable" });
    } else {
      unsubscribe = stop;
      if (progressChanged) {
        outcome = Object.freeze({ status: "failed", progressChanged: true });
      } else if (callerAborted || callerSignal?.aborted) {
        outcome = callerCancelled();
      } else {
        let verification: HoidProgressWatchVerification;
        try {
          verification = await input.verifyCurrent();
        } catch {
          verification = "invalid";
        }

        if (progressChanged) {
          outcome = Object.freeze({ status: "failed", progressChanged: true });
        } else if (callerAborted || callerSignal?.aborted) {
          outcome = callerCancelled();
        } else if (verification === "invalid") {
          outcome = Object.freeze({ status: "unavailable" });
        } else if (verification === "changed") {
          progressChanged = true;
          controller.abort();
          outcome = Object.freeze({ status: "failed", progressChanged: true });
        } else {
          try {
            const value = await input.invoke({
              ...(input.options ?? {}),
              signal: controller.signal,
            });
            if (progressChanged) {
              outcome = Object.freeze({ status: "failed", progressChanged: true });
            } else if (callerAborted || callerSignal?.aborted) {
              outcome = callerCancelled();
            } else {
              outcome = Object.freeze({ status: "completed", value, progressChanged: false });
            }
          } catch {
            if (progressChanged) {
              outcome = Object.freeze({ status: "failed", progressChanged: true });
            } else if (callerAborted || callerSignal?.aborted) {
              outcome = callerCancelled();
            } else {
              outcome = Object.freeze({ status: "failed", progressChanged: false });
            }
          }
        }
      }
    }
  } catch {
    outcome = callerAborted || callerSignal?.aborted
      ? callerCancelled()
      : Object.freeze({ status: "unavailable" });
  } finally {
    callerSignal?.removeEventListener("abort", forwardCallerAbort);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {
        cleanupFailed = true;
      }
    }
  }

  return cleanupFailed ? Object.freeze({ status: "unavailable" }) : outcome;
}
