import { describe, expect, it } from "vitest";
import {
  buildHoidSpoilerDependencySet,
  evaluateHoidSpoilerDependencies,
  validateHoidSpoilerDependencySet,
} from "./spoilerDependencyGate";

function buildSet() {
  const result = buildHoidSpoilerDependencySet({
    schemaVersion: 1,
    kind: "cross-work-explanation",
    id: "cross-work.example-connection",
    requirements: [
      { bookId: "twok", completedThroughChapter: 22 },
      { bookId: "tfe", completedThroughChapter: 9 },
    ],
  });
  if (result.status !== "ready") throw new Error("Expected a valid dependency set");
  return result.dependencySet;
}

describe("Hoid cross-work spoiler dependency gate", () => {
  it("builds a deterministic, sorted contract bound to two distinct works", () => {
    const first = buildSet();
    const second = buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.example-connection",
      requirements: [
        { bookId: "tfe", completedThroughChapter: 9 },
        { bookId: "twok", completedThroughChapter: 22 },
      ],
    });
    expect(second.status).toBe("ready");
    if (second.status !== "ready") return;
    expect(first).toEqual(second.dependencySet);
    expect(first.requirements.map(item => item.bookId)).toEqual(["tfe", "twok"]);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.requirements)).toBe(true);
  });

  it("rejects a single-work set because it cannot represent a cross-work explanation", () => {
    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.single",
      requirements: [{ bookId: "twok", completedThroughChapter: 22 }],
    })).toEqual({ status: "invalid", reason: "invalid-requirement-count" });
  });

  it("rejects duplicate work requirements rather than choosing one watermark", () => {
    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.duplicate",
      requirements: [
        { bookId: "twok", completedThroughChapter: 21 },
        { bookId: "twok", completedThroughChapter: 22 },
      ],
    })).toEqual({ status: "invalid", reason: "duplicate-work" });
  });

  it("rejects works outside the fixed bibliography", () => {
    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.unknown",
      requirements: [
        { bookId: "twok", completedThroughChapter: 22 },
        { bookId: "not-a-cosmere-work", completedThroughChapter: 1 },
      ],
    })).toEqual({ status: "invalid", reason: "unknown-work" });
  });

  it("rejects chapter labels that are ambiguous in the edition manifest", () => {
    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.ambiguous",
      requirements: [
        { bookId: "twok", completedThroughChapter: 22 },
        { bookId: "sawt", completedThroughChapter: 12 },
      ],
    })).toEqual({ status: "invalid", reason: "ambiguous-chapter" });
  });

  it("rejects chapters that are outside the verified reading manifest", () => {
    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.out-of-range",
      requirements: [
        { bookId: "twok", completedThroughChapter: 76 },
        { bookId: "tfe", completedThroughChapter: 9 },
      ],
    })).toEqual({ status: "invalid", reason: "chapter-not-found" });
  });

  it("rejects malformed chapter watermarks and extra requirement fields", () => {
    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.invalid-chapter",
      requirements: [
        { bookId: "twok", completedThroughChapter: 0 },
        { bookId: "tfe", completedThroughChapter: 9 },
      ],
    })).toEqual({ status: "invalid", reason: "invalid-chapter" });

    expect(buildHoidSpoilerDependencySet({
      schemaVersion: 1,
      kind: "cross-work-explanation",
      id: "cross-work.extra-field",
      requirements: [
        { bookId: "twok", completedThroughChapter: 22, locatorId: "forged" },
        { bookId: "tfe", completedThroughChapter: 9 },
      ],
    })).toEqual({ status: "invalid", reason: "invalid-requirements" });
  });

  it("rejects accessor-backed contracts without invoking getters", () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      schemaVersion: { enumerable: true, value: 1 },
      kind: { enumerable: true, value: "cross-work-explanation" },
      id: { enumerable: true, value: "cross-work.hostile" },
      requirements: {
        enumerable: true,
        get() {
          invoked = true;
          return [
            { bookId: "twok", completedThroughChapter: 22 },
            { bookId: "tfe", completedThroughChapter: 9 },
          ];
        },
      },
    });
    expect(buildHoidSpoilerDependencySet(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
    expect(invoked).toBe(false);
  });

  it("validates a set by rebuilding its canonical fingerprint", () => {
    const dependencySet = buildSet();
    expect(validateHoidSpoilerDependencySet(dependencySet)).toMatchObject({
      status: "valid",
      dependencySet,
    });
    expect(validateHoidSpoilerDependencySet({
      ...dependencySet,
      fingerprint: "a".repeat(64),
    })).toEqual({ status: "invalid", reason: "fingerprint-mismatch" });
  });

  it("withholds a cross-work explanation until every required work reaches its own watermark", () => {
    const result = evaluateHoidSpoilerDependencies(buildSet(), [
      { bookId: "twok", chapter: 22 },
    ]);
    expect(result).toMatchObject({
      status: "withheld",
      reason: "prerequisite-not-reached",
      missingRequirementCount: 1,
    });
  });

  it("withholds when one required book is one chapter short", () => {
    expect(evaluateHoidSpoilerDependencies(buildSet(), [
      { bookId: "tfe", chapter: 9 },
      { bookId: "twok", chapter: 21 },
    })).toMatchObject({
      status: "withheld",
      missingRequirementCount: 1,
    });
  });

  it("authorizes only when all independent work watermarks are satisfied", () => {
    const dependencySet = buildSet();
    expect(evaluateHoidSpoilerDependencies(dependencySet, [
      { bookId: "twok", chapter: 22 },
      { bookId: "tfe", chapter: 9 },
    ])).toEqual({
      status: "ready",
      dependencyFingerprint: dependencySet.fingerprint,
    });
  });

  it("accepts explicit completion for a required work without borrowing another work's progress", () => {
    const dependencySet = buildSet();
    expect(evaluateHoidSpoilerDependencies(dependencySet, [
      { bookId: "twok", completed: true },
      { bookId: "tfe", chapter: 9 },
    ])).toEqual({
      status: "ready",
      dependencyFingerprint: dependencySet.fingerprint,
    });
  });

  it("rejects contradictory or duplicate progress instead of silently normalizing it", () => {
    expect(evaluateHoidSpoilerDependencies(buildSet(), [
      { bookId: "twok", chapter: 22 },
      { bookId: "twok", completed: true },
      { bookId: "tfe", chapter: 9 },
    ])).toEqual({ status: "invalid", reason: "invalid-progress" });
  });

  it("rejects progress beyond an edition's verified chapter range", () => {
    expect(evaluateHoidSpoilerDependencies(buildSet(), [
      { bookId: "twok", chapter: 76 },
      { bookId: "tfe", chapter: 9 },
    ])).toEqual({ status: "invalid", reason: "invalid-progress" });
  });

  it("does not treat array order or a missing work position as evidence of completion", () => {
    const dependencySet = buildSet();
    expect(evaluateHoidSpoilerDependencies(dependencySet, [
      { bookId: "tfe", chapter: 9 },
    ])).toMatchObject({ status: "withheld", missingRequirementCount: 1 });
    expect(evaluateHoidSpoilerDependencies(dependencySet, [
      { bookId: "tfe", chapter: 9 },
      { bookId: "twok", chapter: 22 },
    ])).toMatchObject({ status: "ready" });
  });

  it("keeps the gate independent of promotion and production writes", () => {
    const result = evaluateHoidSpoilerDependencies(buildSet(), [
      { bookId: "tfe", chapter: 9 },
      { bookId: "twok", chapter: 22 },
    ]);
    expect(result.status).toBe("ready");
    expect(result).not.toHaveProperty("promotionAllowed");
    expect(result).not.toHaveProperty("productionWritePerformed");
  });
});
