import { describe, expect, it } from "vitest";
import {
  createHoidChapterReference,
  validateHoidChapterReference,
} from "./chapterReference";
import {
  cursorToLegacyReadingPosition,
  getHoidReadingManifest,
  validateHoidReadingCursor,
} from "./readingManifest";
import { validateHoidCursorProgressSnapshot } from "./cursorProgressLedger";

describe("Hoid identity-only chapter references", () => {
  it("creates and revalidates a reference for a uniquely numbered chapter", () => {
    const created = createHoidChapterReference("tfe", { chapterNumber: 3 });
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;

    expect(created.reference).toMatchObject({
      schemaVersion: 1,
      kind: "chapter-reference",
      authority: "identity-only",
      bookId: "tfe",
      chapterNumber: 3,
      ordinal: 3,
      unitId: "chapter:003",
      labelAmbiguous: false,
    });
    expect(validateHoidChapterReference(created.reference)).toEqual({
      status: "valid",
      reference: created.reference,
    });
  });

  it("requires an exact disambiguator for repeated chapter labels", () => {
    expect(createHoidChapterReference("sawt", { chapterNumber: 12 })).toEqual({
      status: "ambiguous",
      chapterNumber: 12,
      candidateCount: 2,
    });
  });

  it("keeps both duplicate chapter 12 units distinct without exposing locators", () => {
    const manifest = getHoidReadingManifest("sawt");
    expect(manifest.status).toBe("ready");
    if (manifest.status !== "ready") return;

    const candidates = manifest.manifest.units.filter(unit =>
      unit.chapterNumber === 12 && typeof unit.locatorId === "string"
    );
    expect(candidates).toHaveLength(2);

    const references = candidates.map(unit => createHoidChapterReference("sawt", {
      chapterNumber: 12,
      locatorId: unit.locatorId,
    }));
    expect(references.every(result => result.status === "ready")).toBe(true);
    if (references.some(result => result.status !== "ready")) return;

    const first = references[0];
    const second = references[1];
    if (first.status !== "ready" || second.status !== "ready") return;

    expect(first.reference.labelAmbiguous).toBe(true);
    expect(second.reference.labelAmbiguous).toBe(true);
    expect(first.reference.chapterNumber).toBe(second.reference.chapterNumber);
    expect(first.reference.ordinal).not.toBe(second.reference.ordinal);
    expect(first.reference.unitId).not.toBe(second.reference.unitId);
    expect(first.reference.identityFingerprint).not.toBe(second.reference.identityFingerprint);
    expect(validateHoidChapterReference(first.reference).status).toBe("valid");
    expect(validateHoidChapterReference(second.reference).status).toBe("valid");

    const serialized = JSON.stringify([first.reference, second.reference]);
    expect(serialized).not.toContain("locatorId");
    expect(serialized).not.toContain("navigationSha256");
    expect(serialized).not.toContain("L5-023.xhtml");
    expect(serialized).not.toContain("L5-028.xhtml");
  });

  it("does not let an identity-only reference become a reading cursor or unlock", () => {
    const manifest = getHoidReadingManifest("sawt");
    if (manifest.status !== "ready") throw new Error("Synthetic manifest unavailable");
    const unit = manifest.manifest.units.find(candidate =>
      candidate.chapterNumber === 12 && typeof candidate.locatorId === "string"
    );
    if (!unit?.locatorId) throw new Error("Synthetic ambiguous locator unavailable");

    const created = createHoidChapterReference("sawt", {
      chapterNumber: 12,
      locatorId: unit.locatorId,
    });
    if (created.status !== "ready") throw new Error("Synthetic chapter reference unavailable");

    expect(validateHoidReadingCursor(created.reference)).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
    expect(cursorToLegacyReadingPosition(created.reference)).toBeNull();

    const forgedProgress = {
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "sawt", cursor: created.reference }],
      updatedAt: "2026-11-24T00:00:00.000Z",
    };
    expect(validateHoidCursorProgressSnapshot(forgedProgress)).toEqual({
      status: "invalid",
      reason: "invalid-position",
    });
  });

  it("rejects stale ordinals and fingerprints", () => {
    const created = createHoidChapterReference("tfe", { chapterNumber: 3 });
    if (created.status !== "ready") throw new Error("Synthetic reference unavailable");

    expect(validateHoidChapterReference({
      ...created.reference,
      ordinal: created.reference.ordinal + 1,
    })).toEqual({ status: "invalid", reason: "stale-reference" });

    expect(validateHoidChapterReference({
      ...created.reference,
      identityFingerprint: "0".repeat(64),
    })).toEqual({ status: "invalid", reason: "stale-reference" });
  });

  it("rejects accessor-backed references without invoking getters", () => {
    const created = createHoidChapterReference("tfe", { chapterNumber: 3 });
    if (created.status !== "ready") throw new Error("Synthetic reference unavailable");

    let invoked = false;
    const hostile = { ...created.reference } as Record<string, unknown>;
    Object.defineProperty(hostile, "identityFingerprint", {
      enumerable: true,
      configurable: true,
      get() {
        invoked = true;
        return created.reference.identityFingerprint;
      },
    });

    expect(validateHoidChapterReference(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-reference",
    });
    expect(invoked).toBe(false);
  });

  it("rejects unknown fields and malformed references", () => {
    const created = createHoidChapterReference("tfe", { chapterNumber: 3 });
    if (created.status !== "ready") throw new Error("Synthetic reference unavailable");

    expect(validateHoidChapterReference({
      ...created.reference,
      locatorId: "private-locator",
    })).toEqual({ status: "invalid", reason: "invalid-reference" });

    expect(validateHoidChapterReference({
      ...created.reference,
      authority: "progress-authorized",
    })).toEqual({ status: "invalid", reason: "invalid-reference" });
  });
});
