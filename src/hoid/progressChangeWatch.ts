import type { HoidRuntimeCallOptions } from "./evidenceRuntime";

/**
 * Emitted only after the durable reading ledger has committed a new snapshot.
 * The listener invalidates in-flight work; it never carries narrative data.
 */
export type HoidProgressChangeSubscription = (listener: () => void) => () => void;

export type HoidProgressWatchVerification = "current" | "changed" | "invalid";

export type HoidProgressWatchResult<T> =
  | Readonly<{ status: "completed"; value: T; progressChanged: boolean }>
  | Readonly<{ status: "failed"; progressChanged: boolean }>
  | Readonly<{ status: "unavailable" }>;

/**
 * Optional, provider-neutral cancellation boundary for work tied to a reading
 * snapshot. A subscription is installed before a second durable read, closing
 * the gap between the gateway's initial freshness check and listener setup.
 *
 * The post-call freshness check in the gateway remains mandatory: notifications
 * are an optimization and cannot replace authoritative snapshot comparison.
 */
export async function invokeWithHoidProgressChangeWatch<T>(input: Readonly<{
  subscribe?: HoidProgressChangeSubscription;
  options?: HoidRuntimeCallOptions;
  verifyCurrent: () => Promise<HoidProgressWatchVerification>;
  invoke: (options?: HoidRuntimeCallOptions) => T | Promise<T>;
}>): Promise<HoidProgressWatchResult<T>> {
  if (!input.subscribe) {
    try {
      return Object.freeze({
        status: "completed",
        value: await input.invoke(input.options),
        progressChanged: false,
      });
    } catch {
      return Object.freeze({ status: "failed", progressChanged: false });
    }
  }

  const controller = new AbortController();
  let progressChanged = false;
  let unsubscribe: (() => void) | undefined;
  let cleanupFailed = false;
  let outcome: HoidProgressWatchResult<T> = Object.freeze({ status: "unavailable" });
  const callerSignal = input.options?.signal;
  const forwardCallerAbort = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", forwardCallerAbort, { once: true });

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
      } else {
        let verification: HoidProgressWatchVerification;
        try {
          verification = await input.verifyCurrent();
        } catch {
          verification = "invalid";
        }

        if (verification === "invalid") {
          outcome = Object.freeze({ status: "unavailable" });
        } else if (verification === "changed" || progressChanged) {
          progressChanged = true;
          controller.abort();
          outcome = Object.freeze({ status: "failed", progressChanged: true });
        } else {
          try {
            const value = await input.invoke({
              ...(input.options ?? {}),
              signal: controller.signal,
            });
            outcome = Object.freeze({ status: "completed", value, progressChanged });
          } catch {
            outcome = Object.freeze({ status: "failed", progressChanged });
          }
        }
      }
    }
  } catch {
    outcome = Object.freeze({ status: "unavailable" });
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
