import { describe, expect, it } from "vitest";
import {
  createHoidUnitProgressCursor,
  validateHoidUnitProgressCursor,
} from "./unitProgressCursor";

describe("Hoid exact unit progress cursor", () => {
  it("allows the first duplicated chapter only when its exact unit is inside the contiguous prefix", () => {
    const result = createHoidUnitProgressCursor("twok", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:012",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.boundary).toMatchObject({
      bookId: "twok",
      currentUnitId: "chapter:012:unit:012",
      currentOrdinal: 12,
      currentChapterNumber: 12,
      completedThroughOrdinal: 11,
      legacyReadingPosition: { bookId: "twok", chapter: 11 },
    });
    expect(validateHoidUnitProgressCursor(result.cursor).status).toBe("valid");
  });

  it("does not unlock the currently open duplicated chapter through the legacy numeric projection", () => {
    const result = createHoidUnitProgressCursor("twok", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:012",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.boundary.legacyReadingPosition).toEqual({
      bookId: "twok",
      chapter: 11,
    });
    expect(result.boundary.legacyReadingPosition?.chapter).not.toBe(12);
  });

  it("requires an exact unit ID when a visible chapter number is duplicated", () => {
    expect(createHoidUnitProgressCursor("twok", {
      chapterNumber: 12,
    })).toMatchObject({
      status: "ambiguous",
      chapterNumber: 12,
      candidateCount: 2,
    });
  });

  it("rejects the second occurrence when the preceding ordinal is absent", () => {
    expect(createHoidUnitProgressCursor("twok", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:014",
    })).toEqual({
      status: "unavailable",
      reason: "non-contiguous-prefix",
    });
  });

  it("rejects later duplicate-number units beyond the verified contiguous prefix", () => {
    expect(createHoidUnitProgressCursor("twok", {
      chapterNumber: 14,
      unitId: "chapter:014:unit:015",
    })).toEqual({
      status: "unavailable",
      reason: "non-contiguous-prefix",
    });
    expect(createHoidUnitProgressCursor("twok", {
      chapterNumber: 14,
      unitId: "chapter:014:unit:035",
    })).toEqual({
      status: "unavailable",
      reason: "non-contiguous-prefix",
    });
  });

  it("projects ordinary unique chapters to the previous completed chapter", () => {
    const result = createHoidUnitProgressCursor("twok", { chapterNumber: 3 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.boundary).toMatchObject({
      currentOrdinal: 3,
      currentChapterNumber: 3,
      completedThroughOrdinal: 2,
      legacyReadingPosition: { bookId: "twok", chapter: 2 },
    });
  });

  it("does not claim any completed unit when the first chapter is open", () => {
    const result = createHoidUnitProgressCursor("twok", { chapterNumber: 1 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.boundary.completedThroughOrdinal).toBeNull();
    expect(result.boundary.legacyReadingPosition).toBeNull();
  });

  it("keeps locators and navigation hashes out of the cursor", () => {
    const result = createHoidUnitProgressCursor("twok", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:012",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const serialized = JSON.stringify(result.cursor);
    expect(serialized).not.toContain("locatorId");
    expect(serialized).not.toContain("navigationSha256");
    expect(serialized).not.toContain("L5-023.xhtml");
    expect(result.cursor.reference.identityFingerprint).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects a stale identity fingerprint", () => {
    const result = createHoidUnitProgressCursor("twok", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:012",
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const forged = Object.freeze({
      ...result.cursor,
      reference: Object.freeze({
        ...result.cursor.reference,
        identityFingerprint: "0".repeat(64),
      }),
    });
    expect(validateHoidUnitProgressCursor(forged)).toEqual({
      status: "invalid",
      reason: "invalid-reference",
    });
  });

  it("rejects unexpected cursor properties", () => {
    const result = createHoidUnitProgressCursor("twok", { chapterNumber: 2 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(validateHoidUnitProgressCursor({
      ...result.cursor,
      completed: true,
    })).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
  });

  it("rejects accessor-backed cursor fields without invoking them", () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      schemaVersion: { enumerable: true, value: 1 },
      kind: { enumerable: true, value: "unit-progress-cursor" },
      reference: {
        enumerable: true,
        get() {
          invoked = true;
          return {};
        },
      },
    });
    expect(validateHoidUnitProgressCursor(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
    expect(invoked).toBe(false);
  });
});
