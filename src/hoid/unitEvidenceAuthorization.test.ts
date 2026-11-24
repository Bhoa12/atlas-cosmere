import { describe, expect, it } from "vitest";
import { createHoidChapterReference } from "./chapterReference";
import {
  createHoidUnitProgressCursor,
} from "./unitProgressCursor";
import {
  emptyHoidUnitProgressSnapshot,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  authorizeHoidUnitEvidence,
  HoidUnitEvidenceAuthorizer,
  type HoidUnitEvidencePolicy,
} from "./unitEvidenceAuthorization";

const fixedNow = () => "2026-11-24T15:00:00.000Z";

function reference(bookId: string, chapterNumber: number, unitId?: string) {
  const result = createHoidChapterReference(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (result.status !== "ready") throw new Error("Exact test reference unavailable");
  return result.reference;
}

function policy(
  bookId = "tfe",
  unlockChapter = 2,
): HoidUnitEvidencePolicy {
  return Object.freeze({
    evidenceId: "evidence.alpha",
    source: reference(bookId, 1),
    firstSafeAppearance: reference(bookId, 1),
    unlock: reference(bookId, unlockChapter),
  });
}

function snapshotAt(bookId: string, chapterNumber: number, revision = 1, unitId?: string): HoidUnitProgressSnapshot {
  const created = createHoidUnitProgressCursor(bookId, {
    chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
  });
  if (created.status !== "ready") throw new Error("Exact test cursor unavailable");
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId, cursor: created.cursor, order: 0 }),
    ]),
    updatedAt: fixedNow(),
  });
}

function completedSnapshot(bookId: string): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision: 1,
    positions: Object.freeze([
      Object.freeze({ bookId, completed: true as const, order: 0 }),
    ]),
    updatedAt: fixedNow(),
  });
}

class MemoryUnitProgressStore implements HoidUnitProgressStore {
  value: unknown = emptyHoidUnitProgressSnapshot();

  async read(): Promise<unknown> {
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    const current = validateHoidUnitProgressSnapshot(this.value);
    const candidate = validateHoidUnitProgressSnapshot(next);
    if (current.status !== "valid" || candidate.status !== "valid") return false;
    if (current.snapshot.revision !== expectedRevision) return false;
    this.value = candidate.snapshot;
    return true;
  }
}

describe("Hoid exact-unit evidence authorization", () => {
  it("does not count the currently open unit as completed", () => {
    const result = authorizeHoidUnitEvidence(snapshotAt("tfe", 2), policy());
    expect(result).toMatchObject({
      status: "locked",
      reason: "unlock-not-reached",
      progressRevision: 1,
      completedThroughOrdinal: 1,
    });
  });

  it("authorizes only after the exact unlock unit is in the completed prefix", () => {
    const result = authorizeHoidUnitEvidence(snapshotAt("tfe", 3), policy());
    expect(result).toMatchObject({
      status: "authorized",
      evidenceId: "evidence.alpha",
      bookId: "tfe",
      progressRevision: 1,
      completedThroughOrdinal: 2,
      explicitlyCompleted: false,
    });
  });

  it("keeps an exact duplicated chapter locked while that unit is open", () => {
    const duplicate = reference("sawt", 12, "chapter:012:unit:012");
    const duplicatePolicy: HoidUnitEvidencePolicy = Object.freeze({
      evidenceId: "sawt.duplicate",
      source: reference("sawt", 11),
      firstSafeAppearance: reference("sawt", 10),
      unlock: duplicate,
    });
    const cursor = createHoidUnitProgressCursor("sawt", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:012",
    });
    if (cursor.status !== "ready") throw new Error("First exact duplicate cursor unavailable");
    const snapshot: HoidUnitProgressSnapshot = Object.freeze({
      schemaVersion: 3,
      revision: 1,
      positions: Object.freeze([
        Object.freeze({ bookId: "sawt", cursor: cursor.cursor, order: 0 }),
      ]),
      updatedAt: fixedNow(),
    });

    expect(authorizeHoidUnitEvidence(snapshot, duplicatePolicy)).toMatchObject({
      status: "locked",
      reason: "unlock-not-reached",
      completedThroughOrdinal: 11,
    });
  });

  it("does not collapse a duplicated chapter into a numeric permission", () => {
    const duplicate = reference("sawt", 12, "chapter:012:unit:012");
    const duplicatePolicy: HoidUnitEvidencePolicy = Object.freeze({
      evidenceId: "sawt.duplicate",
      source: reference("sawt", 11),
      firstSafeAppearance: reference("sawt", 10),
      unlock: duplicate,
    });
    const result = authorizeHoidUnitEvidence(snapshotAt("sawt", 12, 1, "chapter:012:unit:012"), duplicatePolicy);
    expect(result.status).toBe("invalid");
  });

  it("requires explicit whole-work completion to authorize all remaining units", () => {
    expect(authorizeHoidUnitEvidence(completedSnapshot("tfe"), policy()))
      .toMatchObject({
        status: "authorized",
        explicitlyCompleted: true,
        completedThroughOrdinal: null,
      });
  });

  it("keeps evidence locked when the reader has not started its work", () => {
    expect(authorizeHoidUnitEvidence(emptyHoidUnitProgressSnapshot(), policy()))
      .toMatchObject({ status: "locked", reason: "work-not-started" });
  });

  it("rejects policies whose source, first appearance and unlock cross works", () => {
    expect(authorizeHoidUnitEvidence(snapshotAt("tfe", 3), {
      ...policy(),
      unlock: reference("warbreaker", 2),
    })).toEqual({ status: "invalid", reason: "invalid-policy" });
  });

  it("rejects an unlock that precedes the evidence source", () => {
    expect(authorizeHoidUnitEvidence(snapshotAt("tfe", 3), {
      ...policy("tfe", 1),
      source: reference("tfe", 2),
    })).toEqual({ status: "invalid", reason: "invalid-policy" });
  });

  it("rejects an unlock that precedes first safe appearance", () => {
    expect(authorizeHoidUnitEvidence(snapshotAt("tfe", 3), {
      ...policy("tfe", 1),
      firstSafeAppearance: reference("tfe", 2),
    })).toEqual({ status: "invalid", reason: "invalid-policy" });
  });

  it("rejects stale edition fingerprints", () => {
    const valid = policy();
    const stale = Object.freeze({
      ...valid,
      unlock: Object.freeze({
        ...valid.unlock,
        identityFingerprint: "0".repeat(64),
      }),
    });
    expect(authorizeHoidUnitEvidence(snapshotAt("tfe", 3), stale))
      .toEqual({ status: "invalid", reason: "invalid-policy" });
  });

  it("rejects a malformed or duplicated-book snapshot", () => {
    const valid = snapshotAt("tfe", 3);
    const malformed = {
      ...valid,
      positions: [
        ...valid.positions,
        { bookId: "tfe", completed: true },
      ],
    };
    expect(authorizeHoidUnitEvidence(malformed, policy()))
      .toEqual({ status: "invalid", reason: "invalid-snapshot" });
  });

  it("rejects accessor-backed policy fields without invoking the getter", () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "evidenceId", {
      enumerable: true,
      get() {
        invoked = true;
        return "evidence.alpha";
      },
    });
    expect(authorizeHoidUnitEvidence(snapshotAt("tfe", 3), hostile))
      .toEqual({ status: "invalid", reason: "invalid-policy" });
    expect(invoked).toBe(false);
  });

  it("rejects unexpected policy properties", () => {
    expect(authorizeHoidUnitEvidence(snapshotAt("tfe", 3), {
      ...policy(),
      readingPosition: { bookId: "tfe", chapter: 999 },
    })).toEqual({ status: "invalid", reason: "invalid-policy" });
  });
});

describe("HoidUnitEvidenceAuthorizer", () => {
  it("refreshes durable progress before authorizing and observes external regressions", async () => {
    const store = new MemoryUnitProgressStore();
    store.value = snapshotAt("tfe", 3, 1);
    const coordinator = new HoidUnitProgressCoordinator(store, fixedNow);
    expect((await coordinator.initialize()).status).toBe("ready");
    const authorizer = new HoidUnitEvidenceAuthorizer(coordinator);
    let invalidations = 0;
    authorizer.subscribe(() => { invalidations += 1; });

    store.value = snapshotAt("tfe", 2, 2);
    const result = await authorizer.authorize(policy());

    expect(result).toMatchObject({
      status: "locked",
      reason: "unlock-not-reached",
      progressRevision: 2,
      completedThroughOrdinal: 1,
    });
    expect(invalidations).toBe(1);
  });

  it("fails closed when the durable coordinator is unavailable", async () => {
    const store = new MemoryUnitProgressStore();
    const coordinator = new HoidUnitProgressCoordinator({
      read: async () => { throw new Error("offline"); },
      compareAndSwap: async () => false,
    }, fixedNow);
    const authorizer = new HoidUnitEvidenceAuthorizer(coordinator);

    expect(await authorizer.authorize(policy())).toEqual({
      status: "unavailable",
      reason: "progress-unavailable",
    });
  });
});
