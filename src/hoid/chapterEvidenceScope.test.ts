import { describe, expect, it } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { canonicalizeHoidChapterEvidenceScope } from "./chapterEvidenceScope";

function reference(chapterNumber: number) {
  const result = createHoidChapterReference("twok", { chapterNumber });
  if (result.status !== "ready") throw new Error("Referencia sintética no disponible");
  return result.reference;
}

describe("Hoid chapter evidence scope", () => {
  it("canonicalizes exact chapter references in deterministic edition order", () => {
    const third = reference(3);
    const second = reference(2);
    const result = canonicalizeHoidChapterEvidenceScope(
      [third, second],
      { mode: "single-work", bookIds: ["twok"] },
    );

    expect(result?.map(item => item.ordinal)).toEqual([2, 3]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result?.every(item => item.authority === "identity-only")).toBe(true);
  });

  it("rejects a stale identity fingerprint", () => {
    const valid = reference(2);
    const stale = { ...valid, identityFingerprint: "0".repeat(64) };
    expect(canonicalizeHoidChapterEvidenceScope(
      [stale],
      { mode: "single-work", bookIds: ["twok"] },
    )).toBeNull();
  });

  it("rejects duplicate chapter identities", () => {
    const valid = reference(2);
    expect(canonicalizeHoidChapterEvidenceScope(
      [valid, valid],
      { mode: "single-work", bookIds: ["twok"] },
    )).toBeNull();
  });

  it("requires at least one exact anchor for every work in a cross-work scope", () => {
    const valid = reference(2);
    expect(canonicalizeHoidChapterEvidenceScope(
      [valid],
      { mode: "cross-work", bookIds: ["edgedancer", "twok"] },
    )).toBeNull();
  });

  it("rejects a structurally forged ambiguous label", () => {
    const valid = reference(2);
    const ambiguous = { ...valid, labelAmbiguous: true };
    expect(canonicalizeHoidChapterEvidenceScope(
      [ambiguous],
      { mode: "single-work", bookIds: ["twok"] },
    )).toBeNull();
  });
});
