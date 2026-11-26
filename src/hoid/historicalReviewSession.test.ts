import { describe, expect, it } from "vitest";
import type { HoidHistoricalSourceReinspectionResult } from "./historicalSourceReinspection";
import type { HoidSourceInspectionReceipt } from "./sourceInspectionReceipts";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import { createHoidHistoricalReviewSessionController } from "./historicalReviewSession";
import type { HoidHistoricalEditorialChecklist } from "./historicalEditorialReview";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import type { HoidLocalAtomicClaimInput } from "./localReviewToAtomicClaimBridge";

const VERIFIED_AT = "2026-11-26T18:00:00.000Z";
const WORK_ID = "twok";
const manifestResult = getHoidReadingManifest(WORK_ID);
if (manifestResult.status !== "ready") throw new Error("Test reading manifest is unavailable");
const manifest = manifestResult.manifest;
const receiptBase = Object.freeze({
  schemaVersion: 1 as const,
  status: "candidate-only" as const,
  authorizationEffect: "none" as const,
  editorialEffect: "none" as const,
  summaryCreated: false as const,
  productionWritePerformed: false as const,
  workId: WORK_ID,
  editionId: manifest.editionId,
  chapterNumber: 1,
  byteLength: 512,
  documentSha256: "c".repeat(64),
  navigationSha256: manifest.navigationSha256,
  inspectedAt: VERIFIED_AT,
});
const RECEIPT: HoidSourceInspectionReceipt = Object.freeze({
  ...receiptBase,
  receiptFingerprint: sha256Hex(JSON.stringify([
    receiptBase.schemaVersion,
    receiptBase.status,
    receiptBase.authorizationEffect,
    receiptBase.editorialEffect,
    receiptBase.summaryCreated,
    receiptBase.productionWritePerformed,
    receiptBase.workId,
    receiptBase.editionId,
    receiptBase.chapterNumber,
    receiptBase.byteLength,
    receiptBase.documentSha256,
    receiptBase.navigationSha256,
    receiptBase.inspectedAt,
  ])),
});

const identity = (sourceId = "local-source-a") => ({
  sourceId,
  workId: WORK_ID,
  editionId: manifest.editionId,
});
const source = (sourceId = "local-source-a") => ({
  sourceId,
  workId: WORK_ID,
  editionId: manifest.editionId,
  sourceGroup: "roshar-epubs",
});
const inputFor = (sourceValue = source(sourceValueId()), receipt = RECEIPT) => ({
  receipt,
  source: sourceValue,
  packageCandidate: {},
  ingestion: { inspectChapterDocument: async () => ({ status: "rejected" as const, reason: "inspection-failed" as const }) },
  verifiedAt: VERIFIED_AT,
});
function sourceValueId() { return "local-source-a"; }

const verifiedResult: HoidHistoricalSourceReinspectionResult = Object.freeze({
  status: "verified",
  attestation: Object.freeze({
    schemaVersion: 1,
    scope: "ephemeral-historical-source-reinspection",
    workId: WORK_ID,
    editionId: manifest.editionId,
    chapterNumber: 1,
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

async function openVerifiedHandoff(receipt: HoidSourceInspectionReceipt = RECEIPT) {
  const value = verifiedController();
  const lease = value.controller.beginSession(identity());
  if (!lease) throw new Error("Test session could not be opened");
  const result = await value.controller.verifyAndBind(lease, inputFor(source(), receipt));
  if (result.status !== "ready") throw new Error("Test handoff could not be verified");
  return { ...value, lease, handoff: result.handoff };
}

const SUMMARY = "Resumen original suficientemente extenso para una prueba local de revisión editorial con detalles adicionales y contexto.";
const APPROVED_CHECKLIST: HoidHistoricalEditorialChecklist = Object.freeze({
  factualAccuracy: true,
  completeness: true,
  originality: true,
  spoilerCeiling: true,
  provenance: true,
});

const VERIFIED_DOCUMENT_SHA256 = getVerifiedChapterDocumentSha256(
  WORK_ID,
  manifest.editionId,
  manifest.navigationSha256,
  1,
);
if (!VERIFIED_DOCUMENT_SHA256) throw new Error("Verified chapter fixture is unavailable");
const VERIFIED_RECEIPT_BASE = Object.freeze({
  ...receiptBase,
  documentSha256: VERIFIED_DOCUMENT_SHA256,
});
const VERIFIED_RECEIPT: HoidSourceInspectionReceipt = Object.freeze({
  ...VERIFIED_RECEIPT_BASE,
  receiptFingerprint: sha256Hex(JSON.stringify([
    VERIFIED_RECEIPT_BASE.schemaVersion,
    VERIFIED_RECEIPT_BASE.status,
    VERIFIED_RECEIPT_BASE.authorizationEffect,
    VERIFIED_RECEIPT_BASE.editorialEffect,
    VERIFIED_RECEIPT_BASE.summaryCreated,
    VERIFIED_RECEIPT_BASE.productionWritePerformed,
    VERIFIED_RECEIPT_BASE.workId,
    VERIFIED_RECEIPT_BASE.editionId,
    VERIFIED_RECEIPT_BASE.chapterNumber,
    VERIFIED_RECEIPT_BASE.byteLength,
    VERIFIED_RECEIPT_BASE.documentSha256,
    VERIFIED_RECEIPT_BASE.navigationSha256,
    VERIFIED_RECEIPT_BASE.inspectedAt,
  ])),
});
const ATOMIC_CLAIM: HoidLocalAtomicClaimInput = Object.freeze({
  subjectId: "synthetic-test-subject",
  subjectKind: "character",
  assertionKind: "interpretation",
  intent: "explain",
  statement: "Afirmación sintética de prueba para comprobar el acceso a la conversión atómica desde una sesión activa.",
});

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

  it("rejects an invalid or wrong-edition receipt before invoking the inspection port", async () => {
    const value = verifiedController();
    const lease = value.controller.beginSession(identity());
    if (!lease) throw new Error("Test session could not be opened");
    expect(await value.controller.verifyAndBind(lease, { ...inputFor(), receipt: {} }))
      .toEqual({ status: "rejected", reason: "invalid-receipt" });
    expect(await value.controller.verifyAndBind(lease, {
      ...inputFor(),
      receipt: { ...RECEIPT, editionId: "wrong-edition" },
    })).toEqual({ status: "rejected", reason: "invalid-receipt" });
    expect(value.calls()).toBe(0);
  });

  it("binds a verified handoff to the active source session without exposing source identifiers", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    expect(controller.isCurrent(lease)).toBe(true);
    expect(handoff).toMatchObject({
      scope: "session-bound-local-editorial-handoff",
      workId: WORK_ID,
      editionId: manifest.editionId,
      chapterNumber: 1,
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

  it("rejects a verified-shaped result whose attestation is incomplete or authorizing", async () => {
    const controller = createHoidHistoricalReviewSessionController(async () => ({
      ...verifiedResult,
      attestation: Object.freeze({
        ...verifiedResult.attestation,
        sourceContentIncluded: true,
      }),
    } as unknown as HoidHistoricalSourceReinspectionResult));
    const lease = controller.beginSession(identity());
    if (!lease) throw new Error("Test session could not be opened");
    expect(await controller.verifyAndBind(lease, inputFor())).toEqual({
      status: "rejected",
      reason: "attestation-session-mismatch",
    });
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
    let resolveVerification!: (value: HoidHistoricalSourceReinspectionResult) => void;
    const pending = new Promise<HoidHistoricalSourceReinspectionResult>(resolve => {
      resolveVerification = resolve;
    });
    const controller = createHoidHistoricalReviewSessionController(() => pending);
    const firstLease = controller.beginSession(identity());
    if (!firstLease) throw new Error("First test session could not be opened");
    const verification = controller.verifyAndBind(firstLease, inputFor());
    controller.beginSession(identity("local-source-b"));
    resolveVerification(verifiedResult);
    expect(await verification).toEqual({ status: "stale-session" });
  });

  it("invalidates handoffs and drafts when the source is released", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    const saved = controller.saveDraft(handoff, SUMMARY, true);
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
    expect(controller.saveDraft(handoff, SUMMARY, false)).toEqual({
      status: "rejected",
      reason: "originality-not-confirmed",
    });
  });

  it("keeps a valid original summary in memory only and marks it non-authorizing", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    const result = controller.saveDraft(handoff, SUMMARY, true);
    expect(result.status).toBe("saved-in-memory");
    expect(result).toMatchObject({
      draft: {
        summaryText: SUMMARY,
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
    expect(controller.getDraft(handoff)?.summaryText).toBe(SUMMARY);
  });

  it("creates a chapter-bound review packet from the current draft and exact receipt evidence", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, SUMMARY, true);
    const result = controller.buildReviewPacket(handoff);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.packet).toMatchObject({
      workId: WORK_ID,
      editionId: manifest.editionId,
      chapterNumber: 1,
      declaredSpoilerCeilingChapter: 1,
      summaryText: SUMMARY,
      sourceEvidence: {
        receiptFingerprint: RECEIPT.receiptFingerprint,
        documentSha256: RECEIPT.documentSha256,
        navigationSha256: RECEIPT.navigationSha256,
      },
      status: "pending-human-review",
      providerEgress: "none",
      promotionAllowed: false,
      spoilerAuthorization: "none",
    });
    expect(JSON.stringify(result.packet)).not.toContain("local-source-a");
  });

  it("records only an explicitly checked local decision and never authorizes production", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    const result = controller.recordReviewDecision(handoff, built.packet, {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: VERIFIED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    });
    expect(result).toMatchObject({
      status: "valid",
      outcome: "approved-awaiting-trusted-promotion",
      promotionAllowed: false,
      productionWritePerformed: false,
      receipt: {
        reviewerIdentityAuthority: "unverified-local-label",
        trustLevel: "local-unverified",
        authorizationEffect: "none",
        spoilerAuthorization: "none",
      },
    });
    expect(controller.getReviewReceipt(built.packet)).toEqual(result.status === "valid" ? result.receipt : null);
  });

  it("does not accept an old packet after the draft is edited or replaced", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    controller.saveDraft(handoff, SUMMARY + " Una precisión adicional.", true);
    expect(controller.recordReviewDecision(handoff, built.packet, {
      decision: "revision-required",
      reviewerLabel: "local-editor",
      reviewedAt: VERIFIED_AT,
      checklist: { ...APPROVED_CHECKLIST, completeness: false },
      noteCodes: ["completeness-issue"],
    })).toMatchObject({ status: "invalid", reason: "invalid-packet" });
    expect(controller.getReviewReceipt(built.packet)).toBeNull();
  });



  it("creates an atomic claim candidate only through the exact active reviewed handoff", async () => {
    const { controller, handoff } = await openVerifiedHandoff(VERIFIED_RECEIPT);
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    const reviewed = controller.recordReviewDecision(handoff, built.packet, {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: VERIFIED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    });
    if (reviewed.status !== "valid") throw new Error("Local review was not recorded");

    const result = controller.buildAtomicClaimCandidate(handoff, built.packet, ATOMIC_CLAIM);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.candidate).toMatchObject({
      stage: "awaiting-independent-claim-review",
      sourceReviewTrust: "local-unverified",
      providerEgress: "none",
      promotionAllowed: false,
      productionWritePerformed: false,
      spoilerAuthorization: "none",
    });
    expect(result.candidate.claimDraft.evidence[0].unlock).toEqual({
      bookId: WORK_ID,
      chapter: 1,
    });
  });

  it("requires a local approval receipt before building an atomic claim candidate", async () => {
    const { controller, handoff } = await openVerifiedHandoff(VERIFIED_RECEIPT);
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");

    expect(controller.buildAtomicClaimCandidate(handoff, built.packet, ATOMIC_CLAIM)).toMatchObject({
      status: "invalid",
      reason: "invalid-source-review-receipt",
      promotionAllowed: false,
    });
  });

  it("rejects a review packet when it is presented with a different handoff", async () => {
    const value = verifiedController();
    const lease = value.controller.beginSession(identity());
    if (!lease) throw new Error("Test session could not be opened");
    const first = await value.controller.verifyAndBind(lease, inputFor(source(), VERIFIED_RECEIPT));
    const second = await value.controller.verifyAndBind(lease, inputFor(source(), VERIFIED_RECEIPT));
    if (first.status !== "ready" || second.status !== "ready") throw new Error("Test handoffs were not created");
    value.controller.saveDraft(first.handoff, SUMMARY, true);
    const built = value.controller.buildReviewPacket(first.handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    value.controller.recordReviewDecision(first.handoff, built.packet, {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: VERIFIED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    });

    expect(value.controller.buildAtomicClaimCandidate(second.handoff, built.packet, ATOMIC_CLAIM)).toMatchObject({
      status: "invalid",
      reason: "packet-handoff-mismatch",
      promotionAllowed: false,
    });
  });

  it("invalidates atomic claim candidate creation when the source session ends", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff(VERIFIED_RECEIPT);
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    controller.recordReviewDecision(handoff, built.packet, {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: VERIFIED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    });
    controller.invalidate(lease);

    expect(controller.buildAtomicClaimCandidate(handoff, built.packet, ATOMIC_CLAIM)).toMatchObject({
      status: "invalid",
      reason: "stale-session",
      promotionAllowed: false,
    });
  });

  it("invalidates review packets and local decisions when the source session ends", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    controller.recordReviewDecision(handoff, built.packet, {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: VERIFIED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    });
    controller.invalidate(lease);
    expect(controller.getReviewReceipt(built.packet)).toBeNull();
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

  it("allows an active reviewer to discard an in-memory draft and its packet", async () => {
    const { controller, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    expect(controller.discardDraft(handoff)).toBe(true);
    expect(controller.getDraft(handoff)).toBeNull();
    expect(controller.getReviewReceipt(built.packet)).toBeNull();
  });

  it("does not let an older lease invalidate a newer source session", () => {
    const controller = createHoidHistoricalReviewSessionController();
    const oldLease = controller.beginSession(identity());
    const newLease = controller.beginSession(identity("local-source-b"));
    if (!oldLease || !newLease) throw new Error("Test sessions could not be opened");
    controller.invalidate(oldLease);
    expect(controller.isCurrent(newLease)).toBe(true);
  });

  it("invalidates all session state when a newer session begins", async () => {
    const { controller, lease, handoff } = await openVerifiedHandoff();
    controller.saveDraft(handoff, SUMMARY, true);
    const built = controller.buildReviewPacket(handoff);
    if (built.status !== "ready") throw new Error("Review packet was not created");
    controller.beginSession(identity("local-source-b"));
    expect(controller.isCurrent(lease)).toBe(false);
    expect(controller.getDraft(handoff)).toBeNull();
    expect(controller.getReviewReceipt(built.packet)).toBeNull();
  });

  it("exposes no persistence or provider egress operations", () => {
    const controller = createHoidHistoricalReviewSessionController();
    expect(Object.keys(controller).sort()).toEqual([
      "beginSession",
      "buildReviewPacket",
      "discardDraft",
      "getDraft",
      "getReviewReceipt",
      "invalidate",
      "isCurrent",
      "recordReviewDecision",
      "saveDraft",
      "verifyAndBind",
    ]);
  });
});
