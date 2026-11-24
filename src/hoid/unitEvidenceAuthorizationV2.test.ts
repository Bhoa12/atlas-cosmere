import { describe, expect, it } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import {
  authorizeHoidExactUnitEvidence,
  canonicalizeHoidExactUnitEvidencePolicy,
  type HoidExactUnitEvidencePolicy,
} from "./unitEvidenceAuthorizationV2";
import {
  emptyHoidUnitProgressSnapshot,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { HoidExactUnitEvidenceAuthorizer } from "./unitEvidenceAuthorizationV2";

const fixedNow = () => "2026-11-24T17:00:00.000Z";

function reference(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidChapterReference(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (result.status !== "ready") throw new Error("Synthetic exact reference unavailable");
  return result.reference;
}

function cursor(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidUnitProgressCursor(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (result.status !== "ready") throw new Error("Synthetic exact cursor unavailable");
  return result.cursor;
}

function snapshot(
  positions: readonly Readonly<{ bookId: string; chapterNumber?: number; unitId?: string; completed?: boolean }>[],
  revision = 1,
): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze(positions.map((position, order) => Object.freeze(
      position.completed
        ? { bookId: position.bookId, completed: true as const, order }
        : {
            bookId: position.bookId,
            cursor: cursor(position.bookId, position.chapterNumber!, position.unitId),
            order,
          },
    ))),
    updatedAt: fixedNow(),
  });
}

function crossWorkPolicy(): HoidExactUnitEvidencePolicy {
  return Object.freeze({
    schemaVersion: 2,
    evidenceId: "evidence.cross-work",
    source: reference("twok", 2),
    firstSafeAppearance: reference("edgedancer", 3),
    unlock: reference("warbreaker", 2),
  });
}

class MemoryStore implements HoidUnitProgressStore {
  value: unknown = emptyHoidUnitProgressSnapshot();
  async read(): Promise<unknown> { return this.value; }
  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    const current = validateHoidUnitProgressSnapshot(this.value);
    const candidate = validateHoidUnitProgressSnapshot(next);
    if (current.status !== "valid" || candidate.status !== "valid") return false;
    if (current.snapshot.revision !== expectedRevision) return false;
    this.value = candidate.snapshot;
    return true;
  }
}

describe("Hoid exact-unit evidence policy v2", () => {
  it("accepts independent source, first-safe and unlock works without comparing unrelated ordinals", () => {
    expect(canonicalizeHoidExactUnitEvidencePolicy(crossWorkPolicy())).toEqual(crossWorkPolicy());
  });

  it("rejects an unlock that precedes a prerequisite in the same work", () => {
    const invalid = {
      ...crossWorkPolicy(),
      source: reference("twok", 4),
      unlock: reference("twok", 3),
    };
    expect(canonicalizeHoidExactUnitEvidencePolicy(invalid)).toBeNull();
  });

  it("accepts an exact duplicate-label unlock identity without converting it to a number", () => {
    const duplicate = reference("sawt", 12, "chapter:012:unit:012");
    const policy = {
      schemaVersion: 2,
      evidenceId: "evidence.duplicate",
      source: reference("twok", 2),
      firstSafeAppearance: reference("edgedancer", 3),
      unlock: duplicate,
    };
    const canonical = canonicalizeHoidExactUnitEvidencePolicy(policy);
    expect(canonical?.unlock).toEqual(duplicate);
    expect(canonical?.unlock.labelAmbiguous).toBe(true);
    expect(canonical?.unlock.unitId).toBe("chapter:012:unit:012");
  });

  it("rejects stale references and accessor-backed policy fields", () => {
    const valid = crossWorkPolicy();
    expect(canonicalizeHoidExactUnitEvidencePolicy({
      ...valid,
      unlock: { ...valid.unlock, identityFingerprint: "0".repeat(64) },
    })).toBeNull();

    let invoked = false;
    const hostile = Object.defineProperty({}, "evidenceId", {
      enumerable: true,
      get() { invoked = true; return "evidence.cross-work"; },
    });
    expect(canonicalizeHoidExactUnitEvidencePolicy(hostile)).toBeNull();
    expect(invoked).toBe(false);
  });
});

describe("Hoid exact-unit evidence authorization v2", () => {
  it("requires all three cross-work prerequisites to be completed", () => {
    const policy = crossWorkPolicy();
    const ready = snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]);
    expect(authorizeHoidExactUnitEvidence(ready, policy)).toMatchObject({
      status: "authorized",
      evidenceId: policy.evidenceId,
      completedRequirements: [
        { role: "source", bookId: "twok", ordinal: 2, completion: "ordinal-prefix" },
        { role: "firstSafeAppearance", bookId: "edgedancer", ordinal: 3, completion: "ordinal-prefix" },
        { role: "unlock", bookId: "warbreaker", ordinal: 2, completion: "ordinal-prefix" },
      ],
    });
  });

  it("fails closed if the first-safe work has not been started", () => {
    const result = authorizeHoidExactUnitEvidence(snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]), crossWorkPolicy());
    expect(result).toMatchObject({
      status: "locked",
      reason: "work-not-started",
      lockedRole: "firstSafeAppearance",
      bookId: "edgedancer",
    });
  });

  it("does not count an open unlock unit as completed", () => {
    const result = authorizeHoidExactUnitEvidence(snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 2 },
    ]), crossWorkPolicy());
    expect(result).toMatchObject({
      status: "locked",
      reason: "unlock-not-reached",
      lockedRole: "unlock",
      bookId: "warbreaker",
      requiredOrdinal: 2,
      completedThroughOrdinal: 1,
    });
  });

  it("requires the source unit itself to be completed even if another work is complete", () => {
    const result = authorizeHoidExactUnitEvidence(snapshot([
      { bookId: "twok", chapterNumber: 2 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]), crossWorkPolicy());
    expect(result).toMatchObject({
      status: "locked",
      reason: "required-unit-not-completed",
      lockedRole: "source",
      completedThroughOrdinal: 1,
    });
  });

  it("does not let explicit completion of one work skip another prerequisite", () => {
    const result = authorizeHoidExactUnitEvidence(snapshot([
      { bookId: "twok", completed: true },
      { bookId: "edgedancer", chapterNumber: 4 },
    ]), crossWorkPolicy());
    expect(result).toMatchObject({
      status: "locked",
      reason: "work-not-started",
      lockedRole: "unlock",
      bookId: "warbreaker",
    });
  });

  it("keeps an exact duplicate unlock locked while that exact unit is open", () => {
    const duplicatePolicy = {
      schemaVersion: 2,
      evidenceId: "evidence.duplicate",
      source: reference("twok", 2),
      firstSafeAppearance: reference("edgedancer", 3),
      unlock: reference("sawt", 12, "chapter:012:unit:012"),
    };
    const result = authorizeHoidExactUnitEvidence(snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "sawt", chapterNumber: 12, unitId: "chapter:012:unit:012" },
    ]), duplicatePolicy);
    expect(result).toMatchObject({
      status: "locked",
      reason: "unlock-not-reached",
      lockedRole: "unlock",
      bookId: "sawt",
      requiredOrdinal: 12,
      completedThroughOrdinal: 11,
    });
  });

  it("requires explicit work completion or a verified ordinal prefix", () => {
    const result = authorizeHoidExactUnitEvidence(snapshot([
      { bookId: "twok", completed: true },
      { bookId: "edgedancer", completed: true },
      { bookId: "warbreaker", completed: true },
    ]), crossWorkPolicy());
    expect(result).toMatchObject({
      status: "authorized",
      completedRequirements: [
        { completion: "explicit-work-completion" },
        { completion: "explicit-work-completion" },
        { completion: "explicit-work-completion" },
      ],
    });
  });

  it("rejects malformed snapshots", () => {
    expect(authorizeHoidExactUnitEvidence({ schemaVersion: 3 }, crossWorkPolicy()))
      .toEqual({ status: "invalid", reason: "invalid-snapshot" });
  });

  it("refreshes durable progress before authorizing through the coordinator", async () => {
    const store = new MemoryStore();
    store.value = snapshot([
      { bookId: "twok", chapterNumber: 3 },
      { bookId: "edgedancer", chapterNumber: 4 },
      { bookId: "warbreaker", chapterNumber: 3 },
    ]);
    const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
    const authorizer = new HoidExactUnitEvidenceAuthorizer(coordinator);
    expect((await authorizer.authorize(crossWorkPolicy())).status).toBe("authorized");
  });

  it("fails closed when durable progress is unavailable", async () => {
    const coordinator = new HoidUnitProgressCoordinator({
      read: async () => { throw new Error("offline"); },
      compareAndSwap: async () => false,
    }, fixedNow);
    const authorizer = new HoidExactUnitEvidenceAuthorizer(coordinator);
    expect(await authorizer.authorize(crossWorkPolicy())).toEqual({
      status: "unavailable",
      reason: "progress-unavailable",
    });
  });
});
