import { describe, expect, it } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { getHoidReadingManifest } from "./readingManifest";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import {
  buildHoidExactUnitSpoilerDependencySet,
  evaluateHoidExactUnitSpoilerDependencies,
  validateHoidExactUnitSpoilerDependencySet,
} from "./exactUnitSpoilerDependencyGate";
import type { HoidUnitProgressSnapshot } from "./unitProgressLedger";

const now = "2026-11-26T01:00:00.000Z";

function reference(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidChapterReference(bookId, {
    chapterNumber,
    ...(unitId ? { unitId } : {}),
  });
  if (result.status !== "ready") throw new Error("Exact reference unavailable");
  return result.reference;
}

function cursor(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidUnitProgressCursor(bookId, {
    chapterNumber,
    ...(unitId ? { unitId } : {}),
  });
  if (result.status !== "ready") throw new Error("Exact cursor unavailable");
  return result.cursor;
}

function snapshot(
  positions: readonly Readonly<{
    bookId: string;
    chapterNumber?: number;
    unitId?: string;
    completed?: boolean;
  }>[],
): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision: 7,
    positions: Object.freeze(positions.map((position, order) => Object.freeze(
      position.completed
        ? { bookId: position.bookId, completed: true as const, order }
        : {
            bookId: position.bookId,
            cursor: cursor(position.bookId, position.chapterNumber!, position.unitId),
            order,
          },
    ))),
    updatedAt: now,
  });
}

function policy(overrides: Partial<{
  source: ReturnType<typeof reference>;
  firstSafeAppearance: ReturnType<typeof reference>;
  unlock: ReturnType<typeof reference>;
}> = {}) {
  return Object.freeze({
    schemaVersion: 2 as const,
    evidenceId: "evidence.alpha",
    source: overrides.source ?? reference("twok", 2),
    firstSafeAppearance: overrides.firstSafeAppearance ?? reference("edgedancer", 3),
    unlock: overrides.unlock ?? reference("warbreaker", 2),
  });
}

function dependencySet(overrides: Partial<{
  source: ReturnType<typeof reference>;
  firstSafeAppearance: ReturnType<typeof reference>;
  unlock: ReturnType<typeof reference>;
}> = {}) {
  const result = buildHoidExactUnitSpoilerDependencySet({
    claimId: "claim.alpha",
    policies: [policy(overrides)],
  });
  if (result.status !== "ready") throw new Error("Dependency set unavailable");
  return result.dependencySet;
}

describe("Hoid exact-unit spoiler dependency gate", () => {
  it("builds a deterministic exact-unit set across three works without exposing progress", () => {
    const first = dependencySet();
    const second = buildHoidExactUnitSpoilerDependencySet({
      claimId: "claim.alpha",
      policies: [policy({
        unlock: reference("warbreaker", 2),
        source: reference("twok", 2),
        firstSafeAppearance: reference("edgedancer", 3),
      })],
    });
    expect(second.status).toBe("ready");
    if (second.status !== "ready") return;
    expect(first).toEqual(second.dependencySet);
    expect(first.workCount).toBe(3);
    expect(first.requirements).toHaveLength(3);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(first)).not.toContain("progress");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.requirements)).toBe(true);
  });

  it("retains multiple prerequisites in the same work rather than collapsing their identities", () => {
    const result = buildHoidExactUnitSpoilerDependencySet({
      claimId: "claim.multi",
      policies: [
        policy({ source: reference("twok", 2) }),
        Object.freeze({
          schemaVersion: 2,
          evidenceId: "evidence.beta",
          source: reference("twok", 4),
          firstSafeAppearance: reference("edgedancer", 3),
          unlock: reference("warbreaker", 2),
        }),
      ],
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.dependencySet.requirements).toHaveLength(6);
    expect(result.dependencySet.workCount).toBe(3);
  });

  it("rejects duplicate evidence policies and malformed/accessor-backed inputs", () => {
    expect(buildHoidExactUnitSpoilerDependencySet({
      claimId: "claim.duplicate",
      policies: [policy(), policy()],
    })).toEqual({ status: "invalid", reason: "duplicate-evidence" });

    let invoked = false;
    const hostile = Object.defineProperty({}, "policies", {
      enumerable: true,
      get() {
        invoked = true;
        return [policy()];
      },
    });
    Object.defineProperty(hostile, "claimId", { enumerable: true, value: "claim.hostile" });
    expect(buildHoidExactUnitSpoilerDependencySet(hostile)).toEqual({
      status: "invalid",
      reason: "invalid-shape",
    });
    expect(invoked).toBe(false);
  });

  it("rejects stale references and altered dependency fingerprints", () => {
    const set = dependencySet();
    const first = set.requirements[0];
    const tampered = {
      ...set,
      requirements: set.requirements.map((item, index) =>
        index === 0
          ? { ...item, reference: { ...item.reference, identityFingerprint: "a".repeat(64) } }
          : item,
      ),
    };
    expect(validateHoidExactUnitSpoilerDependencySet(tampered)).toEqual({
      status: "invalid",
      reason: "stale-reference",
    });
    expect(validateHoidExactUnitSpoilerDependencySet({
      ...set,
      fingerprint: "b".repeat(64),
    })).toEqual({ status: "invalid", reason: "fingerprint-mismatch" });
    expect(first).toBeDefined();
  });

  it("withholds until every exact prerequisite is completed, not merely opened", () => {
    const set = dependencySet();
    const openedAtRequiredChapter = evaluateHoidExactUnitSpoilerDependencies(set, snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 2 },
    ]));
    expect(openedAtRequiredChapter).toMatchObject({
      status: "withheld",
      reason: "prerequisite-not-completed",
      missingRequirementCount: 1,
      progressRevision: 7,
    });

    const completedAll = evaluateHoidExactUnitSpoilerDependencies(set, snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]));
    expect(completedAll).toMatchObject({
      status: "ready",
      workCount: 3,
      progressRevision: 7,
    });
  });

  it("does not borrow progress from one work for a missing prerequisite in another", () => {
    const result = evaluateHoidExactUnitSpoilerDependencies(dependencySet(), snapshot([
      { bookId: "twok", chapterNumber: 20 },
      { bookId: "edgedancer", chapterNumber: 20 },
    ]));
    expect(result).toMatchObject({
      status: "withheld",
      missingRequirementCount: 1,
    });
  });

  it("accepts explicit completion as the only whole-work completion attestation", () => {
    const result = evaluateHoidExactUnitSpoilerDependencies(dependencySet(), snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", completed: true },
    ]));
    expect(result.status).toBe("ready");
  });

  it("supports duplicate visible chapter labels only through exact unit references", () => {
    const manifest = getHoidReadingManifest("sawt");
    expect(manifest.status).toBe("ready");
    if (manifest.status !== "ready") return;
    const duplicates = manifest.manifest.units.filter(unit => unit.chapterNumber === 12);
    expect(duplicates.length).toBeGreaterThan(1);
    const exact = reference("sawt", 12, duplicates[0].id);
    expect(exact.labelAmbiguous).toBe(true);
    const set = dependencySet({ firstSafeAppearance: exact });
    expect(validateHoidExactUnitSpoilerDependencySet(set).status).toBe("valid");
  });

  it("fails closed on corrupt or duplicate-work progress snapshots", () => {
    const set = dependencySet();
    expect(evaluateHoidExactUnitSpoilerDependencies(set, {
      schemaVersion: 3,
      revision: 1,
      positions: [],
      updatedAt: null,
    })).toEqual({ status: "invalid", reason: "invalid-progress" });

    const duplicate = snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "twok", chapterNumber: 4 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]);
    expect(evaluateHoidExactUnitSpoilerDependencies(set, duplicate)).toEqual({
      status: "invalid",
      reason: "invalid-progress",
    });
  });
});
