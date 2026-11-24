export class HoidOperationCancelledError extends Error {
  constructor() {
    super("Hoid operation cancelled");
    this.name = "HoidOperationCancelledError";
  }
}

export function isHoidOperationCancelled(error: unknown): boolean {
  return error instanceof HoidOperationCancelledError;
}

export function throwIfHoidOperationAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new HoidOperationCancelledError();
}

/**
 * Await an adapter operation without retaining the caller when its signal is
 * aborted. The underlying promise remains observed, so a late rejection cannot
 * become unhandled. Adapters may additionally consume the same signal to stop
 * their own work cooperatively.
 */
export function awaitHoidOperationWithSignal<T>(
  operation: () => T | PromiseLike<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) {
    try {
      return Promise.resolve(operation());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  if (signal.aborted) return Promise.reject(new HoidOperationCancelledError());

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new HoidOperationCancelledError());
    };

    signal.addEventListener("abort", onAbort, { once: true });

    let pending: T | PromiseLike<T>;
    try {
      pending = operation();
    } catch (error) {
      if (!settled) {
        settled = true;
        cleanup();
        reject(error);
      }
      return;
    }

    // Both handlers are attached immediately and remain attached even if the
    // caller aborts first. A non-cooperative adapter may finish later, but its
    // result is discarded and its rejection is still observed.
    Promise.resolve(pending).then(
      value => {
        if (settled) return;
        settled = true;
        cleanup();
        if (signal.aborted) reject(new HoidOperationCancelledError());
        else resolve(value);
      },
      error => {
        if (settled) return;
        settled = true;
        cleanup();
        if (signal.aborted) reject(new HoidOperationCancelledError());
        else reject(error);
      },
    );

    if (signal.aborted) onAbort();
  });
}
