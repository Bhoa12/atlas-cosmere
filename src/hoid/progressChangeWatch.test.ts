import { describe, expect, it, vi } from "vitest";
import { invokeWithHoidProgressChangeWatch } from "./progressChangeWatch";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("invokeWithHoidProgressChangeWatch caller cancellation", () => {
  it("does not start work when the caller signal is already aborted without a subscription", async () => {
    const controller = new AbortController();
    controller.abort();
    const invoke = vi.fn(async () => "late");

    const result = await invokeWithHoidProgressChangeWatch({
      options: { signal: controller.signal },
      verifyCurrent: async () => "current",
      invoke,
    });

    expect(result).toEqual({ status: "cancelled", reason: "caller-aborted" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not install a subscription or invoke work for an already-aborted caller", async () => {
    const controller = new AbortController();
    controller.abort();
    const subscribe = vi.fn((_listener: () => void) => () => undefined);
    const invoke = vi.fn(async () => "late");

    const result = await invokeWithHoidProgressChangeWatch({
      subscribe,
      options: { signal: controller.signal },
      verifyCurrent: async () => "current",
      invoke,
    });

    expect(result).toEqual({ status: "cancelled", reason: "caller-aborted" });
    expect(subscribe).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("discards a late value after caller cancellation when no progress subscription exists", async () => {
    const controller = new AbortController();
    const pendingValue = deferred<string>();
    const invoke = vi.fn(() => pendingValue.promise);

    const pending = invokeWithHoidProgressChangeWatch({
      options: { signal: controller.signal },
      verifyCurrent: async () => "current",
      invoke,
    });
    controller.abort();
    pendingValue.resolve("must-not-escape");

    expect(await pending).toEqual({ status: "cancelled", reason: "caller-aborted" });
  });

  it("forwards caller cancellation to the derived signal and discards a late value", async () => {
    const controller = new AbortController();
    const pendingValue = deferred<string>();
    const started = deferred<void>();
    const unsubscribe = vi.fn();
    let derivedSignal: AbortSignal | undefined;

    const pending = invokeWithHoidProgressChangeWatch({
      subscribe: listener => {
        expect(typeof listener).toBe("function");
        return unsubscribe;
      },
      options: { signal: controller.signal },
      verifyCurrent: async () => "current",
      invoke: options => {
        derivedSignal = options?.signal;
        started.resolve();
        return pendingValue.promise;
      },
    });

    await started.promise;
    expect(derivedSignal).toBeDefined();
    expect(derivedSignal?.aborted).toBe(false);
    controller.abort();
    expect(derivedSignal?.aborted).toBe(true);
    pendingValue.resolve("must-not-escape");

    expect(await pending).toEqual({ status: "cancelled", reason: "caller-aborted" });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the provider when the caller aborts during durable verification", async () => {
    const controller = new AbortController();
    const verification = deferred<"current">();
    const invoke = vi.fn(async () => "late");

    const pending = invokeWithHoidProgressChangeWatch({
      subscribe: () => () => undefined,
      options: { signal: controller.signal },
      verifyCurrent: () => verification.promise,
      invoke,
    });
    controller.abort();
    verification.resolve("current");

    expect(await pending).toEqual({ status: "cancelled", reason: "caller-aborted" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps progress invalidation distinct from caller cancellation", async () => {
    const pendingValue = deferred<string>();
    let notify: (() => void) | undefined;

    const pending = invokeWithHoidProgressChangeWatch({
      subscribe: listener => {
        notify = listener;
        return () => undefined;
      },
      verifyCurrent: async () => "current",
      invoke: () => pendingValue.promise,
    });
    await Promise.resolve();
    await Promise.resolve();
    notify?.();
    pendingValue.resolve("must-not-escape");

    expect(await pending).toEqual({ status: "failed", progressChanged: true });
  });
});
