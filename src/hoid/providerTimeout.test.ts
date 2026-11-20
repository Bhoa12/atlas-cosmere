import { describe, expect, it, vi } from "vitest";
import { answerWithinTimeout, invokeWithProviderDeadline } from "./providerTimeout";

describe("answerWithinTimeout", () => {
  it("returns provider values that arrive before the deadline", async () => {
    await expect(answerWithinTimeout(Promise.resolve("safe"), 100)).resolves.toBe("safe");
  });

  it("fails closed when the timeout is invalid", async () => {
    await expect(answerWithinTimeout(Promise.resolve("safe"), 0)).resolves.toBeNull();
    await expect(answerWithinTimeout(Promise.resolve("safe"), Number.POSITIVE_INFINITY)).resolves.toBeNull();
  });

  it("fails closed when the provider rejects", async () => {
    await expect(answerWithinTimeout(Promise.reject(new Error("provider failure")), 100)).resolves.toBeNull();
  });

  it("keeps positive fractional deadlines as real timeouts", async () => {
    const delayed = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 20));
    await expect(answerWithinTimeout(delayed, 0.1)).resolves.toBeNull();
  });
});

describe("invokeWithProviderDeadline", () => {
  it("returns a completed value without aborting the provider signal", async () => {
    let providerSignal: AbortSignal | undefined;
    const result = await invokeWithProviderDeadline(async signal => {
      providerSignal = signal;
      return "safe";
    }, 100);

    expect(result).toEqual({ status: "completed", value: "safe" });
    expect(providerSignal?.aborted).toBe(false);
  });

  it("aborts the provider signal at the deadline and ignores a late resolution", async () => {
    let providerSignal: AbortSignal | undefined;
    let resolveLate: ((value: string) => void) | undefined;
    const result = await invokeWithProviderDeadline(signal => {
      providerSignal = signal;
      return new Promise<string>(resolve => { resolveLate = resolve; });
    }, 5);

    expect(result).toEqual({ status: "timeout" });
    expect(providerSignal?.aborted).toBe(true);
    resolveLate?.("late");
    await Promise.resolve();
    expect(result).toEqual({ status: "timeout" });
  });

  it("propagates caller cancellation and aborts the adapter signal", async () => {
    const caller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const pending = invokeWithProviderDeadline(signal => {
      providerSignal = signal;
      return new Promise<string>(() => {});
    }, 1_000, caller.signal);

    await Promise.resolve();
    caller.abort();
    await expect(pending).resolves.toEqual({ status: "aborted" });
    expect(providerSignal?.aborted).toBe(true);
  });

  it("does not start an adapter when the caller is already aborted", async () => {
    const caller = new AbortController();
    caller.abort();
    const operation = vi.fn(async () => "must not run");
    const result = await invokeWithProviderDeadline(operation, 100, caller.signal);

    expect(result).toEqual({ status: "aborted" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("contains provider rejection as a failed invocation", async () => {
    const result = await invokeWithProviderDeadline(
      async () => { throw new Error("provider failure"); },
      100,
    );
    expect(result).toEqual({ status: "failed" });
  });
});
