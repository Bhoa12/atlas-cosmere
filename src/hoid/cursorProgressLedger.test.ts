import { describe, expect, it } from "vitest";
import {
  emptyHoidCursorProgressSnapshot,
  migrateHoidProgressV1ToV2,
  validateHoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import { createHoidReadingCursor } from "./readingManifest";

const updatedAt = "2026-11-17T00:00:00.000Z";

function legacySnapshot(
  positions: readonly Record<string, unknown>[] = [],
  revision = positions.length === 0 ? 0 : 4,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    revision,
    positions,
    updatedAt: revision === 0 ? null : updatedAt,
  };
}

function cursorFor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Test cursor unavailable");
  return result.cursor;
}

describe("Hoid cursor progress snapshot v2", () => {
  it("creates a canonical empty v2 snapshot", () => {
    expect(emptyHoidCursorProgressSnapshot()).toEqual({
      schemaVersion: 2,
      revision: 0,
      positions: [],
      updatedAt: null,
    });
  });

  it("validates and sorts cursor positions by book ID", () => {
    const result = validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 2,
      positions: [
        { bookId: "woa", completed: true },
        { bookId: "tfe", cursor: cursorFor("tfe", 12) },
      ],
      updatedAt,
    });

    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.snapshot.positions.map(position => position.bookId)).toEqual(["tfe", "woa"]);
  });

  it("preserves an explicit completion without inventing a cursor", () => {
    const result = validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "woa", completed: true }],
      updatedAt,
    });

    expect(result).toMatchObject({
      status: "valid",
      snapshot: { positions: [{ bookId: "woa", completed: true }] },
    });
  });

  it("rejects a chapter cursor combined with completion", () => {
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [{
        bookId: "tfe",
        cursor: cursorFor("tfe", 12),
        completed: true,
      }],
      updatedAt,
    })).toMatchObject({ status: "invalid", reason: "invalid-position" });
  });

  it("rejects a cursor belonging to a different book", () => {
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "woa", cursor: cursorFor("tfe", 12) }],
      updatedAt,
    })).toMatchObject({ status: "invalid", reason: "invalid-position" });
  });

  it("rejects duplicate work positions", () => {
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [
        { bookId: "tfe", cursor: cursorFor("tfe", 2) },
        { bookId: "tfe", cursor: cursorFor("tfe", 3) },
      ],
      updatedAt,
    })).toMatchObject({ status: "invalid", reason: "duplicate-book" });
  });

  it("rejects unknown completed works", () => {
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "not-in-catalog", completed: true }],
      updatedAt,
    })).toMatchObject({ status: "invalid", reason: "unknown-work" });
  });

  it("rejects a cursor with an obsolete edition digest", () => {
    const cursor = cursorFor("tfe", 2);
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "tfe", cursor: { ...cursor, manifestId: "old-edition" } }],
      updatedAt,
    })).toMatchObject({ status: "invalid", reason: "invalid-position" });
  });

  it("rejects non-canonical timestamps and inconsistent revision state", () => {
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "tfe", cursor: cursorFor("tfe", 2) }],
      updatedAt: "yesterday",
    })).toMatchObject({ status: "invalid", reason: "invalid-timestamp" });

    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 0,
      positions: [{ bookId: "tfe", cursor: cursorFor("tfe", 2) }],
      updatedAt: null,
    })).toMatchObject({ status: "invalid", reason: "invalid-revision-state" });
  });

  it("rejects sparse arrays, accessors and extra snapshot fields", () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 1,
      positions: sparse,
      updatedAt,
    })).toMatchObject({ status: "invalid", reason: "invalid-shape" });

    const accessor = {
      schemaVersion: 2,
      revision: 0,
      positions: [],
      updatedAt: null,
    };
    Object.defineProperty(accessor, "revision", { enumerable: true, get: () => 0 });
    expect(validateHoidCursorProgressSnapshot(accessor)).toMatchObject({
      status: "invalid",
      reason: "invalid-shape",
    });

    expect(validateHoidCursorProgressSnapshot({
      schemaVersion: 2,
      revision: 0,
      positions: [],
      updatedAt: null,
      unexpected: true,
    })).toMatchObject({ status: "invalid", reason: "invalid-shape" });
  });

  it("migrates a valid v1 chapter into an edition-bound cursor", async () => {
    const legacy = legacySnapshot([{ bookId: "tfe", chapter: 12, order: 7 }]);
    const result = await migrateHoidProgressV1ToV2(legacy);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.snapshot).toMatchObject({
      schemaVersion: 2,
      revision: 4,
      updatedAt,
      positions: [{
        bookId: "tfe",
        cursor: {
          bookId: "tfe",
          unitId: "chapter:012",
          ordinal: 12,
          chapterNumber: 12,
        },
        order: 7,
      }],
    });
    expect(result.sourceRevision).toBe(4);
    expect(result.migratedFrom).toBe(1);
  });

  it("migrates explicit completion without converting it into a chapter", async () => {
    const result = await migrateHoidProgressV1ToV2(
      legacySnapshot([{ bookId: "woa", completed: true }]),
    );

    expect(result).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "woa", completed: true }] },
    });
    if (result.status === "ready") {
      expect("cursor" in result.snapshot.positions[0]).toBe(false);
    }
  });

  it("migrates an empty v1 ledger without changing its revision", async () => {
    const result = await migrateHoidProgressV1ToV2(legacySnapshot([], 0));
    expect(result).toMatchObject({
      status: "ready",
      sourceRevision: 0,
      snapshot: { schemaVersion: 2, revision: 0, positions: [], updatedAt: null },
    });
  });

  it("withholds the entire migration when the legacy snapshot is malformed", async () => {
    const result = await migrateHoidProgressV1ToV2(legacySnapshot([
      { bookId: "tfe", chapter: 2, completed: true },
    ]));
    expect(result).toEqual({ status: "unavailable", reason: "invalid-legacy-snapshot" });
  });

  it("does not silently drop ambiguous Elantris progress", async () => {
    const result = await migrateHoidProgressV1ToV2(
      legacySnapshot([{ bookId: "elantris", chapter: 48 }]),
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-legacy-snapshot" });
  });

  it("does not invent a cursor for unsegmented White Sand volumes", async () => {
    const result = await migrateHoidProgressV1ToV2(
      legacySnapshot([{ bookId: "white-sand-1", chapter: 5 }]),
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-legacy-snapshot" });
  });

  it("does not mutate the legacy snapshot during migration", async () => {
    const legacy = legacySnapshot([{ bookId: "tfe", chapter: 9 }]);
    const before = JSON.stringify(legacy);
    await migrateHoidProgressV1ToV2(legacy);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("produces a deterministic migration result for the same source snapshot", async () => {
    const legacy = legacySnapshot([{ bookId: "tfe", chapter: 9 }]);
    const first = await migrateHoidProgressV1ToV2(legacy);
    const second = await migrateHoidProgressV1ToV2(legacy);
    expect(first).toEqual(second);
  });
});
