import { describe, expect, it, vi } from "vitest";
import {
  awaitHoidOperationWithSignal,
  HoidOperationCancelledError,
} from "./abortableOperation";

describe("Hoid abortable operation boundary", () => {
  it("does not start an operation when its signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn(() => "unreachable");

    await expect(
      awaitHoidOperationWithSignal(operation, controller.signal),
    ).rejects.toBeInstanceOf(HoidOperationCancelledError);
    expect(operation).not.toHaveBeenCalled();
  });

  it("releases the caller promptly and observes a late adapter rejection", async () => {
    const controller = new AbortController();
    let rejectLate!: (reason: unknown) => void;
    const operation = vi.fn(() => new Promise<string>((_resolve, reject) => {
      rejectLate = reject;
    }));

    const pending = awaitHoidOperationWithSignal(operation, controller.signal);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(HoidOperationCancelledError);

    rejectLate(new Error("late adapter failure"));
    await Promise.resolve();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("preserves normal results when the operation completes before cancellation", async () => {
    const controller = new AbortController();
    await expect(
      awaitHoidOperationWithSignal(() => Promise.resolve("verified"), controller.signal),
    ).resolves.toBe("verified");
    expect(controller.signal.aborted).toBe(false);
  });
});
