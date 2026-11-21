import { describe, expect, it, vi } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import type { HoidTopicAssignment, HoidTopicAssignmentValidation } from "./topicTaxonomy";
import type { HoidTrustedScreenAnswerPort } from "./trustedScreenAnswer";
import {
  createHoidTrustedTopicComparisonPresenter,
  type HoidTrustedTopicComparisonPresenterConfig,
} from "./trustedTopicComparison";

const UPDATED_AT = "2026-11-21T08:00:00.000Z";
const TEXT_ALPHA = "Afirmación editorial sintética Alfa.";
const TEXT_BETA = "Afirmación editorial sintética Beta.";

function title(bookId: string): string {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === bookId);
  if (!work) throw new Error("Unknown fixture work");
  return work.title;
}

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Fixture cursor unavailable");
  return result.cursor;
}

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Fixture manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Fixture locator unavailable");
  return unit.locatorId;
}

function snapshot(options?: {
  tfeChapter?: number;
  twokChapter?: number;
  revision?: number;
  completed?: boolean;
}) {
  const positions = options?.completed === false
    ? [
        Object.freeze({ bookId: "tfe", cursor: cursor("tfe", options?.tfeChapter ?? 3) }),
        Object.freeze({ bookId: "twok", cursor: cursor("twok", options?.twokChapter ?? 3) }),
      ]
    : [
        Object.freeze({ bookId: "tfe", completed: true as const }),
        Object.freeze({ bookId: "twok", completed: true as const }),
      ];
  return Object.freeze({
    schemaVersion: 2,
    revision: options?.revision ?? 7,
    positions: Object.freeze(positions),
    updatedAt: UPDATED_AT,
  });
}

function source(evidenceId: string, sourceBookId: string) {
  return Object.freeze({
    evidenceId,
    sourceBookId,
    sourceChapter: 1,
    locatorId: locator(sourceBookId, 1),
    unlockBookId: sourceBookId,
    unlockChapter: 2,
  });
}

function citation(evidenceId: string, sourceBookId: string) {
  return Object.freeze({
    evidenceId,
    sourceBookId,
    title: title(sourceBookId),
    chapter: 1,
    locatorId: locator(sourceBookId, 1),
  });
}

function assignment(
  subjectKind: "work" | "entity",
  subjectId: string,
  worldId: string,
  worldLabel: string,
  claimId: string,
  text: string,
  evidenceId: string,
) {
  return Object.freeze({
    schemaVersion: 1,
    id: "assignment." + subjectId,
    subjectKind,
    subjectId,
    worldId,
    worldLabel,
    topicId: "investiture-system",
    dimensionId: "mechanism",
    claimId,
    claimTextSha256: sha256Hex(text),
    evidenceIds: Object.freeze([evidenceId]),
    review: Object.freeze({
      status: "approved",
      reviewerId: "reviewer-test",
      reviewedAt: UPDATED_AT,
    }),
  });
}

function workAssignments() {
  return Object.freeze([
    assignment("work", "tfe", "world-alpha", "Mundo Alfa", "claim.alpha", TEXT_ALPHA, "evidence.alpha"),
    assignment("work", "twok", "world-beta", "Mundo Beta", "claim.beta", TEXT_BETA, "evidence.beta"),
  ]);
}

function entityAssignments() {
  return Object.freeze([
    assignment("entity", "entity.alpha", "world-alpha", "Mundo Alfa", "claim.alpha", TEXT_ALPHA, "evidence.alpha"),
    assignment("entity", "entity.beta", "world-beta", "Mundo Beta", "claim.beta", TEXT_BETA, "evidence.beta"),
  ]);
}

function receipt(assignments: readonly { id: string }[], fingerprint = "receipt-one") {
  return Object.freeze({
    receiptFingerprint: sha256Hex(fingerprint),
    assignmentFingerprint: sha256Hex("assignment-registry"),
    evidenceFingerprint: sha256Hex("evidence-registry"),
    assignmentIds: Object.freeze(assignments.map(item => item.id).sort()),
  });
}

function active(assignments: readonly { id: string }[], fingerprint = "receipt-one") {
  return Object.freeze({
    status: "active",
    assignments,
    receipt: receipt(assignments, fingerprint),
  });
}

function validation(assignments: readonly unknown[]): HoidTopicAssignmentValidation {
  const entities = assignments.filter(item =>
    (item as { subjectKind?: string }).subjectKind === "entity"
  );
  return Object.freeze({
    status: "valid",
    assignments: Object.freeze([...assignments]) as readonly HoidTopicAssignment[],
    evidenceCitations: Object.freeze([
      source("evidence.alpha", "tfe"),
      source("evidence.beta", "twok"),
    ]),
    entityFirstAppearances: Object.freeze([
      ...entities.map((item, index) => Object.freeze({
        entityId: (item as { subjectId: string }).subjectId,
        bookId: index === 0 ? "tfe" : "twok",
        chapter: index === 0 ? 1 : 4,
      })),
    ]),
  });
}

function readyClaim(claimId: string) {
  const isAlpha = claimId === "claim.alpha";
  const text = isAlpha ? TEXT_ALPHA : TEXT_BETA;
  const evidenceId = isAlpha ? "evidence.alpha" : "evidence.beta";
  const sourceBookId = isAlpha ? "tfe" : "twok";
  const citationValue = citation(evidenceId, sourceBookId);
  const presentation = Object.freeze({
    status: "ready",
    text,
    claimIds: Object.freeze([claimId]),
    evidenceIds: Object.freeze([evidenceId]),
    citations: Object.freeze([citationValue]),
    layout: "plain",
    segments: Object.freeze([
      Object.freeze({
        claimId,
        text,
        evidenceIds: Object.freeze([evidenceId]),
        citations: Object.freeze([citationValue]),
      }),
    ]),
  });
  return Object.freeze({
    status: "ready",
    depth: "brief",
    metrics: Object.freeze({
      claimCount: 1,
      evidenceCount: 1,
      workCount: 1,
      characterCount: text.length,
    }),
    presentation,
  });
}

function setup(options?: {
  progress?: unknown;
  refresh?: () => unknown | Promise<unknown>;
  assignments?: readonly unknown[];
  resolver?: () => unknown;
  validator?: (assignments: unknown) => HoidTopicAssignmentValidation;
  load?: (claimIds: readonly string[], progress: unknown) => unknown | Promise<unknown>;
  present?: (answer: unknown, depth: unknown) => unknown | Promise<unknown>;
}) {
  const progress = options?.progress ?? snapshot();
  const assignments = options?.assignments ?? workAssignments();
  const refresh = options?.refresh ?? (() => progress);
  const resolve = options?.resolver ?? (() => active(assignments as readonly { id: string }[]));
  const validate = options?.validator ?? ((value: unknown) => validation(value as readonly unknown[]));
  const load = vi.fn(options?.load ?? (async (claimIds: readonly string[]) => {
    return claimIds.map(claimId => Object.freeze({
      claimId,
      answer: Object.freeze({ claimId }),
    }));
  }));
  const present = vi.fn(options?.present ?? (async (answer: unknown) => {
    return readyClaim((answer as { claimId: string }).claimId);
  }));
  const trustedAnswerPort = Object.freeze({ present }) as unknown as HoidTrustedScreenAnswerPort;
  const refreshCurrentProgress = vi.fn(refresh);
  const resolveApprovedAssignments = vi.fn(resolve);
  const validateAssignments = vi.fn(validate);
  const config: HoidTrustedTopicComparisonPresenterConfig = {
    loadApprovedClaims: load,
    trustedAnswerPort,
    refreshCurrentProgress,
    resolveApprovedAssignments,
    validateAssignments,
  };
  const presenter = createHoidTrustedTopicComparisonPresenter(config);
  if (!presenter) throw new Error("Fixture presenter unavailable");
  const input = Object.freeze({
    topicId: "investiture-system",
    dimensionId: "mechanism",
    entries: Object.freeze([
      Object.freeze({ subjectKind: "work", subjectId: "tfe" }),
      Object.freeze({ subjectKind: "work", subjectId: "twok" }),
    ]),
  });
  return {
    presenter,
    input,
    progress,
    assignments,
    load,
    present,
    refreshCurrentProgress,
    resolveApprovedAssignments,
    validateAssignments,
  };
}

describe("Hoid trusted cross-world topic comparison", () => {
  it("presents only signed, assignment-bound facts side by side", async () => {
    const fixture = setup();
    await expect(fixture.presenter.present(fixture.input)).resolves.toMatchObject({
      status: "ready",
      verifiedClaimCount: 2,
      comparison: {
        mode: "side-by-side",
        inference: "none",
        entries: [
          { subjectId: "tfe", worldId: "world-alpha", worldLabel: "Mundo Alfa", claimId: "claim.alpha", text: TEXT_ALPHA },
          { subjectId: "twok", worldId: "world-beta", worldLabel: "Mundo Beta", claimId: "claim.beta", text: TEXT_BETA },
        ],
      },
    });
    expect(fixture.load).toHaveBeenCalledWith(["claim.alpha", "claim.beta"], fixture.progress);
    expect(fixture.present).toHaveBeenCalledTimes(2);
    expect(fixture.present).toHaveBeenNthCalledWith(1, { claimId: "claim.alpha" }, "brief");
    expect(fixture.present).toHaveBeenNthCalledWith(2, { claimId: "claim.beta" }, "brief");
    expect(fixture.refreshCurrentProgress).toHaveBeenCalledTimes(2);
    expect(fixture.resolveApprovedAssignments).toHaveBeenCalledTimes(2);
  });

  it("does not accept provider prose, progress, world labels or answer objects in the request", async () => {
    const fixture = setup();
    const forged = { ...fixture.input, providerText: "Texto inventado." };
    await expect(fixture.presenter.present(forged)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-input",
    });
    expect(fixture.load).not.toHaveBeenCalled();
    expect(fixture.present).not.toHaveBeenCalled();
  });

  it("withholds before loading claims when the production assignment authority is inactive", async () => {
    const fixture = setup({ resolver: () => Object.freeze({ status: "inactive", reason: "no-topic-assignments" }) });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "assignment-authority-unavailable",
    });
    expect(fixture.load).not.toHaveBeenCalled();
  });

  it("rejects a subject that has no exact active assignment", async () => {
    const fixture = setup();
    const input = {
      ...fixture.input,
      entries: [
        { subjectKind: "work", subjectId: "tfe" },
        { subjectKind: "work", subjectId: "unknown-work" },
      ],
    };
    await expect(fixture.presenter.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "no-authorized-comparison",
    });
    expect(fixture.load).not.toHaveBeenCalled();
  });

  it("rejects a malformed assignment registry even when the resolver claims it is active", async () => {
    const fixture = setup({
      validator: () => Object.freeze({ status: "invalid", reason: "invalid-assignment" }),
    });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "assignment-authority-unavailable",
    });
    expect(fixture.load).not.toHaveBeenCalled();
  });

  it("withholds a work comparison until each compared work is explicitly completed", async () => {
    const progress = snapshot({ completed: false });
    const fixture = setup({ progress });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "no-authorized-comparison",
    });
    expect(fixture.load).not.toHaveBeenCalled();
  });


  it("binds claim text to the reviewed digest", async () => {
    const assignments = workAssignments().map(item =>
      item.subjectId === "tfe"
        ? Object.freeze({ ...item, claimTextSha256: sha256Hex("Texto sustituido.") })
        : item,
    );
    const fixture = setup({ assignments });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-claim-presentation",
    });
  });

  it("binds citations to the verified evidence registry, not just evidence IDs", async () => {
    const fixture = setup({
      validator: value => {
        const result = validation(value as readonly unknown[]);
        return Object.freeze({
          ...result,
          evidenceCitations: Object.freeze([
            Object.freeze({ ...source("evidence.alpha", "tfe"), locatorId: "invented.locator" }),
            source("evidence.beta", "twok"),
          ]),
        });
      },
    });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-claim-presentation",
    });
  });

  it("withholds when the signed presenter rejects any claim", async () => {
    const fixture = setup({
      present: async (answer: unknown) => {
        const claimId = (answer as { claimId: string }).claimId;
        return claimId === "claim.beta"
          ? Object.freeze({ status: "withheld", reason: "locked-evidence", text: "private" })
          : readyClaim(claimId);
      },
    });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "claim-presentation-withheld",
    });
  });

  it("re-reads durable progress and withholds if it changes during comparison", async () => {
    const initial = snapshot();
    const changed = snapshot({ revision: 8 });
    const fixture = setup({
      progress: initial,
      refresh: vi.fn()
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(changed),
    });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "progress-changed",
    });
  });

  it("re-resolves the assignment receipt and withholds if authority changes mid-flight", async () => {
    const assignments = workAssignments();
    const fixture = setup({
      assignments,
      resolver: vi.fn()
        .mockReturnValueOnce(active(assignments as readonly { id: string }[], "receipt-one"))
        .mockReturnValueOnce(active(assignments as readonly { id: string }[], "receipt-two")),
    });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "assignment-authority-changed",
    });
  });

  it("enforces an entity's first-safe-appearance boundary independently of evidence unlocks", async () => {
    const assignments = entityAssignments();
    const progress = snapshot({ tfeChapter: 3, twokChapter: 3, completed: false });
    const input = {
      topicId: "investiture-system",
      dimensionId: "mechanism",
      entries: [
        { subjectKind: "entity", subjectId: "entity.alpha" },
        { subjectKind: "entity", subjectId: "entity.beta" },
      ],
    };
    const fixture = setup({ assignments, progress });
    await expect(fixture.presenter.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "no-authorized-comparison",
    });
    expect(fixture.load).not.toHaveBeenCalled();
  });

  it("returns not-cross-world only after all entries have passed authorization", async () => {
    const assignments = workAssignments().map(item =>
      Object.freeze({ ...item, worldId: "world-alpha", worldLabel: "Mundo Alfa" }),
    );
    const fixture = setup({ assignments });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "not-cross-world",
    });
    expect(fixture.present).toHaveBeenCalledTimes(2);
  });

  it("rejects a receipt whose assignment IDs do not bind the active registry", async () => {
    const assignments = workAssignments();
    const fixture = setup({
      assignments,
      resolver: () => Object.freeze({
        status: "active",
        assignments,
        receipt: Object.freeze({
          ...receipt(assignments as readonly { id: string }[]),
          assignmentIds: Object.freeze(["assignment.tfe"]),
        }),
      }),
    });
    await expect(fixture.presenter.present(fixture.input)).resolves.toEqual({
      status: "withheld",
      reason: "assignment-authority-unavailable",
    });
  });

  it("does not execute accessor properties in request entries", async () => {
    const fixture = setup();
    const entry = { subjectKind: "work" as const };
    Object.defineProperty(entry, "subjectId", {
      enumerable: true,
      get() { throw new Error("must not execute"); },
    });
    const input = {
      topicId: "investiture-system",
      dimensionId: "mechanism",
      entries: [entry, { subjectKind: "work", subjectId: "twok" }],
    };
    await expect(fixture.presenter.present(input)).resolves.toEqual({
      status: "withheld",
      reason: "invalid-input",
    });
    expect(fixture.load).not.toHaveBeenCalled();
  });

  it("rejects provider adapters as configuration", () => {
    const fixture = setup();
    const invalid = createHoidTrustedTopicComparisonPresenter({
      loadApprovedClaims: fixture.load,
      trustedAnswerPort: fixture.presenter,
      refreshCurrentProgress: fixture.refreshCurrentProgress,
      provider: { complete: () => "untrusted" },
    });
    expect(invalid).toBeNull();
  });
});
