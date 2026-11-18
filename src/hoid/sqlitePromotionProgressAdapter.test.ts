import { describe, expect, it, vi } from "vitest";
import { emptyHoidCursorProgressSnapshot } from "./cursorProgressLedger";
import { createHoidSqlitePromotionProgressPort } from "./sqlitePromotionProgressAdapter";

function snapshot(revision: number) {
  if (revision === 0) return emptyHoidCursorProgressSnapshot();
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([]),
    updatedAt: "2026-11-18T02:00:00.000Z",
  });
}

describe("Hoid SQLite promotion progress adapter", () => {
  it("reads the persisted store on every call rather than reusing a cached snapshot", async () => {
    const read = vi.fn()
      .mockResolvedValueOnce(snapshot(1))
      .mockResolvedValueOnce(snapshot(2));
    const port = createHoidSqlitePromotionProgressPort({ read });
    await expect(port.readAuthoritativeProgressSnapshot()).resolves.toEqual(snapshot(1));
    await expect(port.readAuthoritativeProgressSnapshot()).resolves.toEqual(snapshot(2));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("supports class-based SQLite store implementations", async () => {
    class Store {
      async read(): Promise<unknown> {
        return snapshot(3);
      }
    }
    const port = createHoidSqlitePromotionProgressPort(new Store());
    await expect(port.readAuthoritativeProgressSnapshot()).resolves.toEqual(snapshot(3));
  });

  it("fails closed when the SQLite store cannot return a valid persisted snapshot", async () => {
    const port = createHoidSqlitePromotionProgressPort({
      read: async () => null,
    });
    await expect(port.readAuthoritativeProgressSnapshot()).rejects.toThrow(
      "snapshot is unavailable or invalid",
    );
  });

  it("rejects accessor-backed read methods without invoking the getter", async () => {
    let getterCalled = false;
    const store = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(store, "read", {
      enumerable: true,
      get() {
        getterCalled = true;
        return async () => snapshot(1);
      },
    });
    const port = createHoidSqlitePromotionProgressPort(store);
    await expect(port.readAuthoritativeProgressSnapshot()).rejects.toThrow(
      "could not be inspected",
    );
    expect(getterCalled).toBe(false);
  });

  it("rejects a missing read method", async () => {
    const port = createHoidSqlitePromotionProgressPort({});
    await expect(port.readAuthoritativeProgressSnapshot()).rejects.toThrow(
      "read method is unavailable",
    );
  });
});
