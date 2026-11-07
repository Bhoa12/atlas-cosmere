import { answerWithinTimeout } from "./providerTimeout";

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
