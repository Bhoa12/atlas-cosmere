import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getExpoHoidDatabase: vi.fn(),
  createExpoSqliteHoidCursorProgressStore: vi.fn(),
}));

vi.mock("./expoHoidDatabase", () => ({
  getExpoHoidDatabase: mocks.getExpoHoidDatabase,
}));

vi.mock("./cursorSqliteProgressStore", () => ({
  createExpoSqliteHoidCursorProgressStore: mocks.createExpoSqliteHoidCursorProgressStore,
}));

describe("shared Expo cursor progress runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("shares one store and coordinator with the compatibility entry point", async () => {
    const database = Object.freeze({});
    const store = Object.freeze({
      load: vi.fn(async () => ({ status: "unavailable" as const, reason: "storage-error" as const })),
      read: vi.fn(async () => null),
      compareAndSwap: vi.fn(async () => false),
    });
    mocks.getExpoHoidDatabase.mockResolvedValue(database);
    mocks.createExpoSqliteHoidCursorProgressStore.mockReturnValue(store);

    const runtimeModule = await import("./expoCursorProgressCoordinator");
    const firstPromise = runtimeModule.getExpoHoidCursorProgressRuntime();
    const secondPromise = runtimeModule.getExpoHoidCursorProgressRuntime();
    expect(secondPromise).toBe(firstPromise);

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    const compatibilityCoordinator = await runtimeModule.createExpoHoidCursorProgressCoordinator();

    expect(first).toBe(second);
    expect(first.store).toBe(store);
    expect(compatibilityCoordinator).toBe(first.coordinator);
    expect(mocks.getExpoHoidDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.createExpoSqliteHoidCursorProgressStore).toHaveBeenCalledTimes(1);
    expect(mocks.createExpoSqliteHoidCursorProgressStore).toHaveBeenCalledWith(database);
  });

  it("clears a rejected open promise so a later screen mount can retry", async () => {
    const database = Object.freeze({});
    const store = Object.freeze({
      load: vi.fn(async () => ({ status: "unavailable" as const, reason: "storage-error" as const })),
      read: vi.fn(async () => null),
      compareAndSwap: vi.fn(async () => false),
    });
    mocks.getExpoHoidDatabase
      .mockRejectedValueOnce(new Error("temporary SQLite open failure"))
      .mockResolvedValueOnce(database);
    mocks.createExpoSqliteHoidCursorProgressStore.mockReturnValue(store);

    const runtimeModule = await import("./expoCursorProgressCoordinator");
    await expect(runtimeModule.getExpoHoidCursorProgressRuntime()).rejects.toThrow(
      "temporary SQLite open failure",
    );

    const recovered = await runtimeModule.getExpoHoidCursorProgressRuntime();
    expect(recovered.store).toBe(store);
    expect(mocks.getExpoHoidDatabase).toHaveBeenCalledTimes(2);
    expect(mocks.createExpoSqliteHoidCursorProgressStore).toHaveBeenCalledTimes(1);
  });
});
