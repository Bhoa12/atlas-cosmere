import { describe, expect, it } from "vitest";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  selectedEvidenceSatisfiesHoidBookScope,
} from "./answerScope";

describe("explicit Hoid answer book scope", () => {
  it("accepts one known work as a single-work scope", () => {
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ["tfe"] }))
      .toEqual({ mode: "single-work", bookIds: ["tfe"] });
  });

  it("canonicalizes cross-work scopes deterministically", () => {
    expect(canonicalizeHoidAnswerBookScope({ mode: "cross-work", bookIds: ["edgedancer", "twok"] }))
      .toEqual({ mode: "cross-work", bookIds: ["edgedancer", "twok"] });
  });

  it("rejects unknown works, duplicate IDs and unsupported modes", () => {
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ["unknown-work"] })).toBeNull();
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ["tfe", "tfe"] })).toBeNull();
    expect(canonicalizeHoidAnswerBookScope({ mode: "series", bookIds: ["tfe"] })).toBeNull();
  });

  it("enforces mode cardinality", () => {
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ["tfe", "woa"] })).toBeNull();
    expect(canonicalizeHoidAnswerBookScope({ mode: "cross-work", bookIds: ["tfe"] })).toBeNull();
  });

  it("rejects extra fields and symbol properties", () => {
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ["tfe"], extra: true })).toBeNull();
    const value = { mode: "single-work", bookIds: ["tfe"] } as Record<string, unknown>;
    Object.defineProperty(value, Symbol("extra"), { value: true });
    expect(canonicalizeHoidAnswerBookScope(value)).toBeNull();
  });

  it("rejects accessors without executing them", () => {
    let invoked = false;
    const value = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(value, {
      mode: { enumerable: true, value: "single-work" },
      bookIds: { enumerable: true, get: () => { invoked = true; return ["tfe"]; } },
    });
    expect(canonicalizeHoidAnswerBookScope(value)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects sparse arrays and accessor elements", () => {
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: new Array(1) })).toBeNull();
    let invoked = false;
    const ids = ["tfe"];
    Object.defineProperty(ids, "0", { enumerable: true, configurable: true, get: () => { invoked = true; return "tfe"; } });
    expect(canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ids })).toBeNull();
    expect(invoked).toBe(false);
  });

  it("keeps all claim evidence inside the scope", () => {
    const scope = canonicalizeHoidAnswerBookScope({ mode: "single-work", bookIds: ["twok"] });
    expect(claimEvidenceMatchesHoidBookScope(["twok", "twok"], scope ?? undefined)).toBe(true);
    expect(claimEvidenceMatchesHoidBookScope(["twok", "edgedancer"], scope ?? undefined)).toBe(false);
  });

  it("requires all requested works in a cross-work answer", () => {
    const scope = canonicalizeHoidAnswerBookScope({ mode: "cross-work", bookIds: ["twok", "edgedancer"] });
    expect(selectedEvidenceSatisfiesHoidBookScope(["twok"], scope ?? undefined)).toBe(false);
    expect(selectedEvidenceSatisfiesHoidBookScope(["twok", "edgedancer"], scope ?? undefined)).toBe(true);
    expect(selectedEvidenceSatisfiesHoidBookScope(["twok", "edgedancer", "tfe"], scope ?? undefined)).toBe(false);
  });

  it("does not constrain unscoped answers", () => {
    expect(claimEvidenceMatchesHoidBookScope(["twok", "edgedancer"], undefined)).toBe(true);
    expect(selectedEvidenceSatisfiesHoidBookScope(["twok"], undefined)).toBe(true);
  });
});
