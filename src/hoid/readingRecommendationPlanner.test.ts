import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import type { HoidUnitProgressSnapshot } from "./unitProgressLedger";
import {
  buildHoidReadingRecommendationPlan,
  validateHoidReadingRecommendationPlan,
} from "./readingRecommendationPlanner";

const now = "2026-11-26T02:00:00.000Z";

type PositionInput =
  | Readonly<{ bookId: string; chapterNumber: number; order?: number }>
  | Readonly<{ bookId: string; completed: true; order?: number }>;

function makeSnapshot(positions: readonly PositionInput[], revision = 7): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision,
    positions: Object.freeze(positions.map(position => {
      if ("completed" in position) {
        return Object.freeze({
          bookId: position.bookId,
          completed: true as const,
          ...(position.order === undefined ? {} : { order: position.order }),
        });
      }
      const created = createHoidUnitProgressCursor(position.bookId, {
        chapterNumber: position.chapterNumber,
      });
      if (created.status !== "ready") throw new Error("Exact progress cursor unavailable");
      return Object.freeze({
        bookId: position.bookId,
        cursor: created.cursor,
        ...(position.order === undefined ? {} : { order: position.order }),
      });
    })),
    updatedAt: revision === 0 ? null : now,
  });
}

describe("Hoid progress-aware reading recommendation planner", () => {
  it("recommends resuming the currently open chapter, never the following chapter", () => {
    const result = buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "twok", chapterNumber: 4, order: 0 },
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.plan.candidates).toHaveLength(1);
    expect(result.plan.candidates[0]).toMatchObject({
      kind: "resume-current-unit",
      reason: "unfinished-current-unit",
      workId: "twok",
      workTitle: "El Camino de los Reyes",
      chapterNumber: 4,
      ordinal: 4,
      labelMode: "numbered-chapter",
      progressOrder: 0,
    });
  });

  it("preserves the reader's explicit ledger order across multiple active works", () => {
    const result = buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "twok", chapterNumber: 8, order: 1 },
      { bookId: "warbreaker", chapterNumber: 3, order: 0 },
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.plan.candidates.map(candidate => candidate.workId)).toEqual([
      "warbreaker",
      "twok",
    ]);
  });

  it("does not recommend completed works when another work remains open", () => {
    const result = buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "tfe", completed: true, order: 0 },
      { bookId: "twok", chapterNumber: 6, order: 1 },
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.plan.candidates.map(candidate => candidate.workId)).toEqual(["twok"]);
  });

  it("returns no-active-work for an empty or fully completed ledger", () => {
    expect(buildHoidReadingRecommendationPlan({
      schemaVersion: 3,
      revision: 0,
      positions: [],
      updatedAt: null,
    })).toMatchObject({ status: "no-active-work", progressRevision: 0 });

    expect(buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "tfe", completed: true, order: 0 },
      { bookId: "twok", completed: true, order: 1 },
    ]))).toMatchObject({ status: "no-active-work", progressRevision: 7 });
  });

  it("caps output to the requested bounded number of active works", () => {
    const result = buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "twok", chapterNumber: 2, order: 0 },
      { bookId: "warbreaker", chapterNumber: 3, order: 1 },
      { bookId: "edgedancer", chapterNumber: 4, order: 2 },
    ]), { maxRecommendations: 2 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.plan.maxRecommendations).toBe(2);
    expect(result.plan.candidates).toHaveLength(2);
    expect(result.plan.candidates.map(candidate => candidate.workId)).toEqual([
      "twok",
      "warbreaker",
    ]);
  });

  it("rejects unsupported limits and corrupt progress instead of guessing", () => {
    expect(buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "twok", chapterNumber: 2 },
    ]), { maxRecommendations: 0 })).toEqual({
      status: "unavailable",
      reason: "invalid-limit",
    });
    expect(buildHoidReadingRecommendationPlan({
      schemaVersion: 3,
      revision: 1,
      positions: [{ bookId: "unknown-work", completed: true }],
      updatedAt: now,
    })).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("binds the recommendation plan to the current catalogue and progress revision", () => {
    const progress = makeSnapshot([
      { bookId: "twok", chapterNumber: 5, order: 0 },
    ]);
    const built = buildHoidReadingRecommendationPlan(progress);
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;

    expect(validateHoidReadingRecommendationPlan(built.plan, progress).status).toBe("valid");
    const changed = makeSnapshot([
      { bookId: "twok", chapterNumber: 5, order: 0 },
    ], 8);
    expect(validateHoidReadingRecommendationPlan(built.plan, changed)).toEqual({
      status: "invalid",
      reason: "stale-progress",
    });
  });

  it("rejects a tampered candidate even when the chapter still looks plausible", () => {
    const progress = makeSnapshot([
      { bookId: "twok", chapterNumber: 5, order: 0 },
    ]);
    const built = buildHoidReadingRecommendationPlan(progress);
    expect(built.status).toBe("ready");
    if (built.status !== "ready") return;

    const tampered = {
      ...built.plan,
      candidates: built.plan.candidates.map(candidate => ({
        ...candidate,
        progressOrder: 1,
      })),
    };
    expect(validateHoidReadingRecommendationPlan(tampered, progress)).toEqual({
      status: "invalid",
      reason: "fingerprint-mismatch",
    });
  });

  it("rejects accessor-backed plans without invoking their getters", () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() {
        invoked = true;
        return 1;
      },
    });
    expect(validateHoidReadingRecommendationPlan(hostile, makeSnapshot([
      { bookId: "twok", chapterNumber: 2 },
    ]))).toEqual({ status: "invalid", reason: "invalid-plan" });
    expect(invoked).toBe(false);
  });

  it("uses exact edition-bound identity and never exports the private navigation locator", () => {
    const manifest = getHoidReadingManifest("twok");
    expect(manifest.status).toBe("ready");
    const result = buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "twok", chapterNumber: 7, order: 0 },
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const candidate = result.plan.candidates[0];
    expect(candidate.reference.identityFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(candidate.reference.authority).toBe("identity-only");
    expect(candidate.reference).not.toHaveProperty("locatorId");
    expect(JSON.stringify(result.plan)).not.toContain("L1-");
    expect(JSON.stringify(result.plan)).not.toContain("locatorId");
  });

  it("does not infer a next-work order for readers with no active cursor", () => {
    const result = buildHoidReadingRecommendationPlan(makeSnapshot([
      { bookId: "tfe", completed: true, order: 0 },
    ]));
    expect(result.status).toBe("no-active-work");
  });
});
