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
      locatorId: "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/001.xhtml",
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

  it("keeps numeric progress capped while retaining exact locators for duplicate Viento y verdad labels", () => {
    const result = getHoidReadingManifest("sawt");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.manifest.units).toHaveLength(15);
    expect(result.manifest.units.slice(0, 11).map(unit => unit.chapterNumber)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    expect(result.manifest.units.slice(11)).toEqual([
      {
        id: "chapter:012:unit:012",
        kind: "chapter",
        ordinal: 12,
        chapterNumber: 12,
        locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L5-023.xhtml",
      },
      {
        id: "chapter:012:unit:014",
        kind: "chapter",
        ordinal: 14,
        chapterNumber: 12,
        locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L5-028.xhtml",
      },
      {
        id: "chapter:014:unit:015",
        kind: "chapter",
        ordinal: 15,
        chapterNumber: 14,
        locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L5-030.xhtml",
      },
      {
        id: "chapter:014:unit:035",
        kind: "chapter",
        ordinal: 35,
        chapterNumber: 14,
        locatorId: "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L5-055.xhtml",
      },
    ]);
    expect(result.manifest.ambiguousChapterNumbers).toEqual([12, 14]);
    expect(result.manifest.coverage).toBe("partial-before-ambiguous-chapter");
    expect(createHoidReadingCursor("sawt", 12)).toEqual({
      status: "unavailable",
      reason: "ambiguous-chapter",
    });
    expect(createHoidReadingCursor("sawt", 14)).toEqual({
      status: "unavailable",
      reason: "ambiguous-chapter",
    });
    expect(createHoidReadingCursor("sawt", 13)).toEqual({
      status: "unavailable",
      reason: "unit-not-found",
    });
  });

  it("rejects a forged numeric cursor even when an exact ambiguous unit exists in the manifest", () => {
    const result = getHoidReadingManifest("sawt");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const duplicateUnit = result.manifest.units.find(unit => unit.chapterNumber === 12);
    expect(duplicateUnit?.locatorId).toBeTruthy();
    if (!duplicateUnit) return;
    const forgedCursor = {
      schemaVersion: 1,
      manifestId: result.manifest.manifestId,
      bookId: result.manifest.bookId,
      unitId: duplicateUnit.id,
      ordinal: duplicateUnit.ordinal,
      chapterNumber: duplicateUnit.chapterNumber,
    };
    expect(validateHoidReadingCursor(forgedCursor)).toEqual({
      status: "invalid",
      reason: "unit-not-found",
    });
    expect(cursorToLegacyReadingPosition(forgedCursor)).toBeNull();
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
      chapter: 11,
    });
  });

  it("does not project an open chapter-one cursor into completed progress", () => {
    const created = createHoidReadingCursor("tfe", 1);
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    expect(cursorToLegacyReadingPosition(created.cursor)).toBeNull();
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
      reason: "ambiguous-chapter",
    });
    expect(createHoidReadingCursor("sawt", 12)).toEqual({
      status: "unavailable",
      reason: "ambiguous-chapter",
    });
    expect(createHoidReadingCursor("sawt", 14)).toEqual({
      status: "unavailable",
      reason: "ambiguous-chapter",
    });
  });

  it("attaches exact navigation locators for both inspected source groups", () => {
    const roshar = getHoidReadingManifest("twok");
    expect(roshar.status).toBe("ready");
    if (roshar.status !== "ready") return;
    expect(roshar.manifest.units[0].locatorId).toBe(
      "nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-012.xhtml",
    );

    const cosmere = getHoidReadingManifest("tfe");
    expect(cosmere.status).toBe("ready");
    if (cosmere.status !== "ready") return;
    expect(cosmere.manifest.units[0].locatorId).toBe(
      "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/001.xhtml",
    );
  });


  it("attaches locators to both individually inspected Roshar novellas", () => {
    for (const [bookId, expectedCount] of [["edgedancer", 20], ["dawnshard", 19]] as const) {
      const result = getHoidReadingManifest(bookId);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") continue;
      expect(result.manifest.units).toHaveLength(expectedCount);
      expect(result.manifest.units.every(unit => typeof unit.locatorId === "string")).toBe(true);
    }
  });

  it("stores no chapter titles or narrative text in manifests", () => {
    const result = getHoidReadingManifest("twok");
    expect(result.status).toBe("ready");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Prólogo");
    expect(serialized).not.toContain("Epílogo");
    expect(serialized).not.toContain("Capítulo");
  });
});
