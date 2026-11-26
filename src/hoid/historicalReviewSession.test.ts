import { describe, expect, it } from "vitest";
import type { HoidHistoricalSourceReinspectionResult } from "./historicalSourceReinspection";
import { createHoidHistoricalReviewSessionController } from "./historicalReviewSession";

const VERIFIED_AT = "2026-11-26T18:00:00.000Z";
const identity = (sourceId = "local-source-a", workId = "tfe", editionId = "edition-tfe") => ({
  sourceId,
  workId,
  editionId,
});
const source = (sourceId = "local-source-a", workId = "tfe", editionId = "edition-tfe") => ({
  sourceId,
  workId,
  editionId,
  sourceGroup: "cosmere.epub",
});
const inputFor = (sourceValue = source()) => ({
  receipt: {},
  source: sourceValue,
  packageCandidate: {},
  ingestion: { inspectChapterDocument: async () => ({ status: "rejected" as const, reason: "inspection-failed" as const }) },
  verifiedAt: VERIFIED_AT,
});

const verifiedResult: HoidHistoricalSourceReinspectionResult = Object.freeze({
  status: "verified",
  attestation: Object.freeze({
    schemaVersion: 1,
    scope: "ephemeral-historical-source-reinspection",
    workId: "tfe",
    editionId: "edition-tfe",
    chapterNumber: 4,
    verifiedAt: VERIFIED_AT,
    sourceAvailability: "verified-local",
    sourceContentIncluded: false,
    sourceAccessPerformed: true,
    documentUnchanged: true,
    reviewCanStart: true,
    summaryCreated: false,
    productionWritePerformed: false,
    authorizationEffect: "none",
    editorialEffect: "none",
  }),
});

function verifiedController() {
  let calls = 0;
  const controller = createHoidHistoricalReviewSessionController(async () => {
    calls += 1;
    return verifiedResult;
  });
  return { controller, calls: () => calls };
}

async function openVerifiedHandoff() {
  const value = verifiedController();
  const lease = value.controller.beginSession(identity());
  if (!lease) throw new Error("Test session could not be opened");
  const result = await value.controller.verifyAndBind(lease, inputFor());
  if (result.status !== "ready") throw new Error("Test handoff could not be verified");
  return { ...value, lease, handoff: result.handoff };
}

describe("Hoid session-bound historical review workspace", () => {
  it("rejects malformed source-session identities", () => {
    const controller = createHoidHistoricalReviewSessionController();
    expect(controller.beginSession({ ...identity(), sourceId: "file:///private/book.epub" })).toBeNull();
    expect(controller.beginSession({ ...identity(), extra: true })).toBeNull();
    expect(controller.beginSession(Object.create({ ...identity() }))).toBeNull();
  });

  it("creates one active lease bound to the selected source, work and edition", () => {
    const controller = createHoidHistoricalReviewSessionController();
    const lease = controller.beginSession(identity());
    expect(lease).toMatchObject({ scope: "hoid-local-source-session", generation: expect.any(Number) });
    expect(controller.isCurrent(lease)).toBe(true);
  });

  it("refuses to inspect a source that differs from the active session", async () => {
    const value = verifiedController();
    const lease = value.controller.beginSession(identity());
    if (!lease) throw new Error("Test session could not be opened");
    const result = await value.controller.verifyAndBind(lease, inputFor(source("another-source")));
    expect(result).toEqual({ status: "rejected", reason: "session-source-mismatch" });
    expect(value.calls()).toBe(0);
  });

  it("binds a verified handoff to the active source session without exposing source identifiers", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    expect(controller.isCurrent(lease)).toBe(true);
    expect(handoff).toMatchObject({
      scope: "session-bound-local-editorial-handoff",
      workId: "tfe",
      editionId: "edition-tfe",
      chapterNumber: 4,
      sourceAvailability: "verified-local",
      sourceContentIncluded: false,
      sourceTextPersisted: false,
      reviewWorkspaceAvailable: true,
      authorizationEffect: "none",
      editorialEffect: "none",
      spoilerAuthorization: "none",
    });
    expect(JSON.stringify(handoff)).not.toContain("local-source-a");
    expect(Object.isFrozen(handoff)).toBe(true);
  });

  it("propagates changed documents without creating a review handoff", async () => {
    const controller = createHoidHistoricalReviewSessionController(async () => ({
      status: "changed",
      reason: "document-digest-mismatch",
      existingReceiptPreserved: true,
      sourceAccessPerformed: true,
      sourceContentIncluded: false,
      reviewCanStart: false,
      summaryCreated: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    }));
    const lease = controller.beginSession(identity());
    if (!lease) throw new Error("Test session could not be opened");
    expect(await controller.verifyAndBind(lease, inputFor())).toEqual({
      status: "changed",
      reason: "document-digest-mismatch",
    });
  });

  it("propagates rejected inspections without enabling the workspace", async () => {
    const controller = createHoidHistoricalReviewSessionController(async () => ({
      status: "rejected",
      reason: "manifest-unavailable",
      sourceAccessPerformed: false,
      sourceContentIncluded: false,
      reviewCanStart: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    }));
    const lease = controller.beginSession(identity());
    if (!lease) throw new Error("Test session could not be opened");
    expect(await controller.verifyAndBind(lease, inputFor())).toEqual({
      status: "rejected",
      reason: "manifest-unavailable",
    });
  });

  it("does not let a late verification complete after a source switch", async () => {
    let resolveVerification: ((value: HoidHistoricalSourceReinspectionResult) => void) | null = null;
    const pending = new Promise<HoidHistoricalSourceReinspectionResult>(resolve => {
      resolveVerification = resolve;
    });
    const controller = createHoidHistoricalReviewSessionController(() => pending);
    const firstLease = controller.beginSession(identity());
    if (!firstLease) throw new Error("First test session could not be opened");
    const verification = controller.verifyAndBind(firstLease, inputFor());
    controller.beginSession(identity("local-source-b"));
    if (!resolveVerification) throw new Error("Deferred verifier was not initialized");
    resolveVerification(verifiedResult);
    expect(await verification).toEqual({ status: "stale-session" });
  });

  it("invalidates handoffs and drafts when the source is released", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    const saved = controller.saveDraft(handoff, "Resumen original suficientemente extenso para una prueba local de revisión editorial.", true);
    expect(saved.status).toBe("saved-in-memory");
    controller.invalidate(lease);
    expect(controller.isCurrent(lease)).toBe(false);
    expect(controller.getDraft(handoff)).toBeNull();
    expect(controller.saveDraft(handoff, "Otro resumen original suficientemente extenso para una prueba.", true)).toEqual({
      status: "rejected",
      reason: "stale-session",
    });
  });

  it("requires an explicit originality attestation before accepting a draft", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    expect(controller.saveDraft(handoff, "Resumen original suficientemente extenso para una prueba local.", false)).toEqual({
      status: "rejected",
      reason: "originality-not-confirmed",
    });
  });

  it("keeps a valid original summary in memory only and marks it non-authorizing", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    const summary = "Resumen original suficientemente extenso para una prueba local de revisión editorial.";
    const result = controller.saveDraft(handoff, summary, true);
    expect(result.status).toBe("saved-in-memory");
    expect(result).toMatchObject({
      draft: {
        summaryText: summary,
        originalityAttested: true,
        reviewState: "awaiting-human-editorial-review",
        sourceContentIncluded: false,
        sourceTextPersisted: false,
        productionWritePerformed: false,
        authorizationEffect: "none",
        editorialEffect: "none",
        spoilerAuthorization: "none",
      },
    });
    expect(controller.getDraft(handoff)?.summaryText).toBe(summary);
    expect(Object.keys(controller).sort()).toEqual([
      "beginSession",
      "discardDraft",
      "getDraft",
      "invalidate",
      "isCurrent",
      "saveDraft",
      "verifyAndBind",
    ]);
  });

  it("rejects XHTML, file references and summaries outside the bounded length", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    expect(controller.saveDraft(handoff, "<html>protected text</html>", true)).toMatchObject({
      status: "rejected",
      reason: "invalid-summary",
    });
    expect(controller.saveDraft(handoff, "file:///private/book.epub", true)).toMatchObject({
      status: "rejected",
      reason: "invalid-summary",
    });
    expect(controller.saveDraft(handoff, "demasiado corto", true)).toMatchObject({
      status: "rejected",
      reason: "invalid-summary",
    });
    expect(controller.saveDraft(handoff, "x".repeat(3_001), true)).toMatchObject({
      status: "rejected",
      reason: "invalid-summary",
    });
  });

  it("allows an active reviewer to discard an in-memory draft", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, "Resumen original suficientemente extenso para una prueba local de revisión.", true);
    expect(controller.discardDraft(handoff)).toBe(true);
    expect(controller.getDraft(handoff)).toBeNull();
  });

  it("does not allow an older lease to invalidate a newer source session", () => {
    const controller = createHoidHistoricalReviewSessionController();
    const oldLease = controller.beginSession(identity());
    const newLease = controller.beginSession(identity("local-source-b"));
    if (!oldLease || !newLease) throw new Error("Test sessions could not be opened");
    controller.invalidate(oldLease);
    expect(controller.isCurrent(newLease)).toBe(true);
  });

  it("invalidates all session state when a newer session begins", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    controller.beginSession(identity("local-source-b"));
    expect(controller.isCurrent(lease)).toBe(false);
    expect(controller.getDraft(handoff)).toBeNull();
  });

  it("does not expose persistence, provider, approval or publication operations", () => {
    const controller = createHoidHistoricalReviewSessionController();
    expect(Object.keys(controller).sort()).toEqual([
      "beginSession",
      "discardDraft",
      "getDraft",
      "invalidate",
      "isCurrent",
      "saveDraft",
      "verifyAndBind",
    ]);
  });
});
