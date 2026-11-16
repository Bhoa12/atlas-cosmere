import { describe, expect, it } from "vitest";
import {
  createHoidReadingCursor,
  cursorToLegacyReadingPosition,
  getHoidReadingManifest,
  validateHoidReadingCursor,
} from "./readingManifest";

describe("edition-bound reading manifests", () => {
  it("creates a metadata-only numeric manifest from verified chapter counts", () => {
    const result = getHoidReadingManifest("tfe");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.manifest.units).toHaveLength(38);
    expect(result.manifest.units[0]).toEqual({
      id: "chapter:001",
      kind: "chapter",
      ordinal: 1,
      chapterNumber: 1,
    });
    expect(result.manifest.units[37].id).toBe("chapter:038");
    expect(result.manifest.unitScope).toBe("numbered-chapters-only");
    expect(result.manifest.coverage).toBe("verified-numeric-chapters");
  });

  it("creates only the unambiguous prefix for Elantris", () => {
    const result = getHoidReadingManifest("elantris");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.manifest.units).toHaveLength(47);
    expect(result.manifest.units[46].chapterNumber).toBe(47);
    expect(result.manifest.ambiguousChapterNumbers).toEqual([48, 51, 57]);
    expect(result.manifest.coverage).toBe("partial-before-ambiguous-chapter");
  });

  it("creates only the unambiguous prefix for Viento y verdad", () => {
    const result = getHoidReadingManifest("sawt");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.manifest.units).toHaveLength(11);
    expect(result.manifest.ambiguousChapterNumbers).toEqual([12, 14]);
  });

  it("does not invent units for merged White Sand volumes or Arcanum", () => {
    expect(getHoidReadingManifest("white-sand-1")).toMatchObject({
      status: "unavailable",
      reason: "segmentation-unverified",
    });
    expect(getHoidReadingManifest("white-sand-2")).toMatchObject({
      status: "unavailable",
      reason: "segmentation-unverified",
    });
    expect(getHoidReadingManifest("white-sand-3")).toMatchObject({
      status: "unavailable",
      reason: "segmentation-unverified",
    });
    expect(getHoidReadingManifest("arcanum")).toMatchObject({
      status: "unavailable",
      reason: "segmentation-unverified",
    });
  });

  it("returns unknown-work for IDs outside the verified bibliography", () => {
    expect(getHoidReadingManifest("not-in-catalog")).toEqual({
      status: "unavailable",
      reason: "unknown-work",
    });
  });

  it("creates and validates a cursor against the exact manifest", () => {
    const created = createHoidReadingCursor("tfe", 12);
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;

    expect(validateHoidReadingCursor(created.cursor)).toMatchObject({
      status: "valid",
      cursor: {
        bookId: "tfe",
        unitId: "chapter:012",
        ordinal: 12,
        chapterNumber: 12,
      },
    });
    expect(cursorToLegacyReadingPosition(created.cursor)).toEqual({
      bookId: "tfe",
      chapter: 12,
    });
  });

  it("rejects forged unit IDs, ordinals, chapter numbers and manifest digests", () => {
    const created = createHoidReadingCursor("tfe", 12);
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;

    expect(validateHoidReadingCursor({ ...created.cursor, unitId: "chapter:013" })).toMatchObject({
      status: "invalid",
      reason: "unit-not-found",
    });
    expect(validateHoidReadingCursor({ ...created.cursor, ordinal: 13 })).toMatchObject({
      status: "invalid",
      reason: "unit-not-found",
    });
    expect(validateHoidReadingCursor({ ...created.cursor, chapterNumber: 13 })).toMatchObject({
      status: "invalid",
      reason: "unit-not-found",
    });
    expect(validateHoidReadingCursor({ ...created.cursor, manifestId: "old-edition" })).toMatchObject({
      status: "invalid",
      reason: "manifest-mismatch",
    });
  });

  it("rejects accessors, inherited fields and unknown cursor properties", () => {
    const created = createHoidReadingCursor("tfe", 3);
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;

    const accessor = { ...created.cursor } as Record<string, unknown>;
    Object.defineProperty(accessor, "chapterNumber", {
      enumerable: true,
      get: () => 3,
    });
    expect(validateHoidReadingCursor(accessor)).toMatchObject({
      status: "invalid",
      reason: "invalid-shape",
    });

    const inherited = Object.assign(Object.create({ extra: true }), created.cursor);
    expect(validateHoidReadingCursor(inherited)).toMatchObject({
      status: "invalid",
      reason: "invalid-shape",
    });

    expect(validateHoidReadingCursor({ ...created.cursor, title: "invented" })).toMatchObject({
      status: "invalid",
      reason: "invalid-shape",
    });
  });

  it("rejects cursors at or after ambiguous chapters", () => {
    expect(createHoidReadingCursor("elantris", 47).status).toBe("ready");
    expect(createHoidReadingCursor("elantris", 48)).toEqual({
      status: "unavailable",
      reason: "unit-not-found",
    });
    expect(createHoidReadingCursor("sawt", 12)).toEqual({
      status: "unavailable",
      reason: "unit-not-found",
    });
  });

  it("stores no chapter titles, locators or narrative text in manifests", () => {
    const result = getHoidReadingManifest("tfe");
    expect(result.status).toBe("ready");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\.xhtml|\.ncx|Prólogo|Epílogo|Capítulo\s+\d/i);
  });
});
