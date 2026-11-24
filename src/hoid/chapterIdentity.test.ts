import { describe, expect, it } from "vitest";
import { getHoidReadingManifest, type HoidReadingManifest } from "./readingManifest";
import {
  isHoidChapterIdentityForManifest,
  resolveHoidChapterIdentity,
  resolveHoidChapterIdentityInManifest,
  validateHoidChapterIdentity,
  validateHoidChapterIdentityInManifest,
} from "./chapterIdentity";

const NAVIGATION_SHA = "a".repeat(64);

function duplicateNumberManifest(): HoidReadingManifest {
  return Object.freeze({
    manifestId: "hoid:test-edition:sawt:" + NAVIGATION_SHA,
    editionId: "test-edition",
    navigationSha256: NAVIGATION_SHA,
    bookId: "sawt",
    unitScope: "numbered-chapters-only",
    coverage: "partial-before-ambiguous-chapter",
    units: Object.freeze([
      Object.freeze({
        id: "chapter:011",
        kind: "chapter" as const,
        ordinal: 11,
        chapterNumber: 11,
        locatorId: "nav:test:chapter-11",
      }),
      Object.freeze({
        id: "chapter:012-a",
        kind: "chapter" as const,
        ordinal: 12,
        chapterNumber: 12,
        locatorId: "nav:test:chapter-12-a",
      }),
      Object.freeze({
        id: "chapter:012-b",
        kind: "chapter" as const,
        ordinal: 13,
        chapterNumber: 12,
        locatorId: "nav:test:chapter-12-b",
      }),
      Object.freeze({
        id: "chapter:013",
        kind: "chapter" as const,
        ordinal: 14,
        chapterNumber: 13,
        locatorId: "nav:test:chapter-13",
      }),
    ]),
    ambiguousChapterNumbers: Object.freeze([12]),
  });
}

describe("edition-bound chapter identity", () => {
  it("resolves a unique chapter number from the current work manifest", () => {
    const result = resolveHoidChapterIdentity("twok", { chapterNumber: 1 });
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.identity).toMatchObject({
      schemaVersion: 1,
      bookId: "twok",
      editionId: "roshar-omnibus-v1",
      ordinal: 1,
      chapterNumber: 1,
    });
    expect(result.identity.locatorId).toContain("L1-012.xhtml");
  });

  it("never chooses the first unit when a chapter number has multiple edition units", () => {
    const result = resolveHoidChapterIdentityInManifest(
      duplicateNumberManifest(),
      { chapterNumber: 12 },
    );
    expect(result).toEqual({
      status: "ambiguous",
      chapterNumber: 12,
      candidateCount: 2,
    });
  });

  it("resolves a repeated chapter number only with an exact unit ID", () => {
    const result = resolveHoidChapterIdentityInManifest(
      duplicateNumberManifest(),
      { chapterNumber: 12, unitId: "chapter:012-b" },
    );
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.identity).toMatchObject({
      unitId: "chapter:012-b",
      ordinal: 13,
      chapterNumber: 12,
      locatorId: "nav:test:chapter-12-b",
    });
  });

  it("resolves a repeated chapter number only with its exact edition-bound locator", () => {
    const result = resolveHoidChapterIdentityInManifest(
      duplicateNumberManifest(),
      { chapterNumber: 12, locatorId: "nav:test:chapter-12-a" },
    );
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.identity.unitId).toBe("chapter:012-a");
  });

  it("requires unit ID and locator ID to identify the same unit when both are supplied", () => {
    const result = resolveHoidChapterIdentityInManifest(
      duplicateNumberManifest(),
      {
        chapterNumber: 12,
        unitId: "chapter:012-a",
        locatorId: "nav:test:chapter-12-b",
      },
    );
    expect(result).toEqual({ status: "unavailable", reason: "identity-mismatch" });
  });

  it("does not issue an identity for a unit without a verified locator", () => {
    const manifest = duplicateNumberManifest();
    const withoutLocator = Object.freeze({
      ...manifest,
      units: Object.freeze([
        Object.freeze({
          id: "chapter:001",
          kind: "chapter" as const,
          ordinal: 1,
          chapterNumber: 1,
        }),
      ]),
      ambiguousChapterNumbers: Object.freeze([]),
    });
    expect(resolveHoidChapterIdentityInManifest(
      withoutLocator,
      { chapterNumber: 1 },
    )).toEqual({ status: "unavailable", reason: "locator-unverified" });
  });

  it("revalidates every identity field against the exact current manifest", () => {
    const manifestResult = getHoidReadingManifest("twok");
    expect(manifestResult.status).toBe("ready");
    if (manifestResult.status !== "ready") return;

    const resolved = resolveHoidChapterIdentityInManifest(
      manifestResult.manifest,
      { chapterNumber: 2 },
    );
    expect(resolved.status).toBe("resolved");
    if (resolved.status !== "resolved") return;

    expect(validateHoidChapterIdentityInManifest(
      manifestResult.manifest,
      resolved.identity,
    )).toEqual({ status: "valid", identity: resolved.identity });
    expect(isHoidChapterIdentityForManifest(
      manifestResult.manifest,
      resolved.identity,
    )).toBe(true);
  });

  it("rejects stale edition, navigation, ordinal and locator bindings", () => {
    const manifestResult = getHoidReadingManifest("twok");
    expect(manifestResult.status).toBe("ready");
    if (manifestResult.status !== "ready") return;

    const resolved = resolveHoidChapterIdentityInManifest(
      manifestResult.manifest,
      { chapterNumber: 2 },
    );
    expect(resolved.status).toBe("resolved");
    if (resolved.status !== "resolved") return;

    for (const override of [
      { editionId: "another-edition" },
      { navigationSha256: "b".repeat(64) },
      { ordinal: 3 },
      { locatorId: "nav:forged" },
    ]) {
      expect(validateHoidChapterIdentityInManifest(
        manifestResult.manifest,
        { ...resolved.identity, ...override },
      ).status).toBe("invalid");
    }
  });

  it("keeps Viento y verdad ambiguous chapter labels blocked without inventing candidate counts", () => {
    expect(resolveHoidChapterIdentity("sawt", { chapterNumber: 11 }).status).toBe("resolved");
    expect(resolveHoidChapterIdentity("sawt", { chapterNumber: 12 })).toEqual({
      status: "ambiguous",
      chapterNumber: 12,
      candidateCount: null,
    });
    expect(resolveHoidChapterIdentity("sawt", { chapterNumber: 14 })).toEqual({
      status: "ambiguous",
      chapterNumber: 14,
      candidateCount: null,
    });
  });

  it("does not resolve a declared ambiguous number from a partial single-candidate manifest", () => {
    const manifest = duplicateNumberManifest();
    const partial = Object.freeze({
      ...manifest,
      units: Object.freeze([manifest.units[0], manifest.units[1]]),
    });
    expect(resolveHoidChapterIdentityInManifest(partial, { chapterNumber: 12 })).toEqual({
      status: "ambiguous",
      chapterNumber: 12,
      candidateCount: null,
    });
  });

  it("rejects duplicate chapter units that are not declared ambiguous by the manifest", () => {
    const manifest = duplicateNumberManifest();
    const malformed = Object.freeze({
      ...manifest,
      ambiguousChapterNumbers: Object.freeze([]),
    });
    expect(resolveHoidChapterIdentityInManifest(
      malformed,
      { chapterNumber: 12, unitId: "chapter:012-a" },
    )).toEqual({ status: "unavailable", reason: "invalid-manifest" });
  });

  it("rejects malformed, accessor-bearing and unknown chapter selections", () => {
    let invoked = false;
    const accessorSelection = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessorSelection, "chapterNumber", {
      enumerable: true,
      get: () => {
        invoked = true;
        return 1;
      },
    });

    expect(resolveHoidChapterIdentity("twok", accessorSelection)).toEqual({
      status: "unavailable",
      reason: "invalid-selection",
    });
    expect(invoked).toBe(false);
    expect(resolveHoidChapterIdentity("unknown-work", { chapterNumber: 1 }).status).toBe("unavailable");
    expect(resolveHoidChapterIdentity("twok", { chapterNumber: 999 }).status).toBe("unavailable");
  });
});
