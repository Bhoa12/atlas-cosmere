import { describe, expect, it, vi } from "vitest";
import { createHoidSharedSqliteDatabaseProvider } from "./sharedSqliteDatabase";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("shared Hoid SQLite database provider", () => {
  it("coalesces concurrent opens and returns the same database handle", async () => {
    const opening = deferred<{ readonly marker: string }>();
    const openDatabase = vi.fn(() => opening.promise);
    const provider = createHoidSharedSqliteDatabaseProvider(openDatabase);

    const first = provider.get();
    const second = provider.get();

    expect(first).toBe(second);
    await Promise.resolve();
    expect(openDatabase).toHaveBeenCalledTimes(1);

    const handle = Object.freeze({ marker: "shared-database" });
    opening.resolve(handle);

    await expect(first).resolves.toBe(handle);
    await expect(second).resolves.toBe(handle);
    await expect(provider.get()).resolves.toBe(handle);
    expect(openDatabase).toHaveBeenCalledTimes(1);
  });

  it("shares one handle between independent store consumers", async () => {
    const handle = Object.freeze({ execute: vi.fn() });
    const openDatabase = vi.fn(async () => handle);
    const provider = createHoidSharedSqliteDatabaseProvider(openDatabase);

    const [progressStoreDatabase, conversationStoreDatabase] = await Promise.all([
      provider.get(),
      provider.get(),
    ]);

    expect(progressStoreDatabase).toBe(conversationStoreDatabase);
    expect(progressStoreDatabase).toBe(handle);
    expect(openDatabase).toHaveBeenCalledTimes(1);
  });

  it("clears a rejected open and permits a later retry", async () => {
    const handle = Object.freeze({ marker: "recovered" });
    const failure = new Error("temporary open failure");
    const openDatabase = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(handle);
    const provider = createHoidSharedSqliteDatabaseProvider(openDatabase);

    const first = provider.get();
    const concurrent = provider.get();
    expect(first).toBe(concurrent);

    await expect(first).rejects.toBe(failure);
    expect(openDatabase).toHaveBeenCalledTimes(1);

    await expect(provider.get()).resolves.toBe(handle);
    await expect(provider.get()).resolves.toBe(handle);
    expect(openDatabase).toHaveBeenCalledTimes(2);
  });

  it("keeps separate providers isolated", async () => {
    const firstHandle = Object.freeze({ marker: "first" });
    const secondHandle = Object.freeze({ marker: "second" });
    const firstOpen = vi.fn(async () => firstHandle);
    const secondOpen = vi.fn(async () => secondHandle);
    const firstProvider = createHoidSharedSqliteDatabaseProvider(firstOpen);
    const secondProvider = createHoidSharedSqliteDatabaseProvider(secondOpen);

    await expect(firstProvider.get()).resolves.toBe(firstHandle);
    await expect(secondProvider.get()).resolves.toBe(secondHandle);
    expect(firstOpen).toHaveBeenCalledTimes(1);
    expect(secondOpen).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing opener at composition time", () => {
    expect(() => createHoidSharedSqliteDatabaseProvider(null as never))
      .toThrow("A SQLite database opener is required");
  });

  it("does not expose a close or reset operation", () => {
    const provider = createHoidSharedSqliteDatabaseProvider(async () => ({}));
    expect(Object.keys(provider)).toEqual(["get"]);
    expect(Object.isFrozen(provider)).toBe(true);
  });
});
