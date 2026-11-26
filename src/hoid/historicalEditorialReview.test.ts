import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import {
  buildHoidHistoricalEditorialReviewPacket,
  validateHoidHistoricalEditorialReviewDecision,
  validateHoidHistoricalEditorialReviewPacket,
  validateHoidHistoricalEditorialReviewReceipt,
  type HoidHistoricalEditorialChecklist,
} from "./historicalEditorialReview";

const WORK_ID = "twok";
const manifestResult = getHoidReadingManifest(WORK_ID);
if (manifestResult.status !== "ready") throw new Error("Expected a verified test manifest");
const EDITION_ID = manifestResult.manifest.editionId;
const NAVIGATION_SHA256 = manifestResult.manifest.navigationSha256;
const SUMMARY = "Resumen original de prueba que describe únicamente el capítulo inspeccionado, con contexto suficiente para validar el flujo editorial local sin incorporar texto del EPUB.";
const EVIDENCE = Object.freeze({
  receiptFingerprint: "a".repeat(64),
  documentSha256: "b".repeat(64),
  navigationSha256: NAVIGATION_SHA256,
  byteLength: 512,
  inspectedAt: "2026-11-26T18:00:00.000Z",
});
const DRAFT = Object.freeze({
  schemaVersion: 1,
  scope: "ephemeral-local-editorial-draft",
  workId: WORK_ID,
  editionId: EDITION_ID,
  chapterNumber: 1,
  summaryText: SUMMARY,
  originalityAttested: true,
  reviewState: "awaiting-human-editorial-review",
  sourceContentIncluded: false,
  sourceTextPersisted: false,
  productionWritePerformed: false,
  authorizationEffect: "none",
  editorialEffect: "none",
  spoilerAuthorization: "none",
});
const APPROVED_CHECKLIST: HoidHistoricalEditorialChecklist = Object.freeze({
  factualAccuracy: true,
  completeness: true,
  originality: true,
  spoilerCeiling: true,
  provenance: true,
});
const REVIEWED_AT = "2026-11-26T18:30:00.000Z";

function packet() {
  const result = buildHoidHistoricalEditorialReviewPacket(DRAFT, EVIDENCE);
  if (result.status !== "ready") throw new Error("Expected a valid local review packet");
  return result.packet;
}

describe("Hoid local historical editorial review packets", () => {
  it("builds a chapter-bound packet from an original session draft and source receipt metadata", () => {
    const result = buildHoidHistoricalEditorialReviewPacket(DRAFT, EVIDENCE);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.packet).toMatchObject({
      workId: WORK_ID,
      editionId: EDITION_ID,
      chapterNumber: 1,
      declaredSpoilerCeilingChapter: 1,
      summaryText: SUMMARY,
      sourceEvidence: EVIDENCE,
      status: "pending-human-review",
      sourceTextIncluded: false,
      sourceTextPersisted: false,
      providerEgress: "none",
      promotionAllowed: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      spoilerAuthorization: "none",
    });
    expect(Object.isFrozen(result.packet)).toBe(true);
  });

  it("rejects malformed drafts, XHTML-like content and source file references", () => {
    expect(buildHoidHistoricalEditorialReviewPacket({ ...DRAFT, originalityAttested: false }, EVIDENCE))
      .toMatchObject({ status: "invalid", reason: "invalid-draft" });
    expect(buildHoidHistoricalEditorialReviewPacket({ ...DRAFT, summaryText: "<html>copied</html>" }, EVIDENCE))
      .toMatchObject({ status: "invalid", reason: "invalid-draft" });
    expect(buildHoidHistoricalEditorialReviewPacket({ ...DRAFT, summaryText: "file:///private/book.epub" }, EVIDENCE))
      .toMatchObject({ status: "invalid", reason: "invalid-draft" });
  });

  it("rejects unknown works, mismatched editions and ambiguous chapter identities", () => {
    expect(buildHoidHistoricalEditorialReviewPacket({ ...DRAFT, workId: "unknown-work" }, EVIDENCE))
      .toMatchObject({ status: "invalid", reason: "unknown-work" });
    expect(buildHoidHistoricalEditorialReviewPacket({ ...DRAFT, editionId: "other-edition" }, EVIDENCE))
      .toMatchObject({ status: "invalid", reason: "manifest-mismatch" });
    expect(buildHoidHistoricalEditorialReviewPacket({ ...DRAFT, chapterNumber: 0 }, EVIDENCE))
      .toMatchObject({ status: "invalid", reason: "invalid-draft" });
  });

  it("requires source evidence to match the edition navigation fingerprint", () => {
    expect(buildHoidHistoricalEditorialReviewPacket(DRAFT, {
      ...EVIDENCE,
      navigationSha256: "c".repeat(64),
    })).toMatchObject({ status: "invalid", reason: "invalid-source-evidence" });
  });

  it("detects packet tampering and does not expose source locators or paths", () => {
    const value = packet();
    expect(validateHoidHistoricalEditorialReviewPacket(value).status).toBe("valid");
    expect(validateHoidHistoricalEditorialReviewPacket({
      ...value,
      summaryText: "Un resumen distinto que no coincide con la huella original.",
    })).toMatchObject({ status: "invalid", reason: "invalid-packet" });
    const serialized = JSON.stringify(value);
    for (const forbidden of ["locatorId", "navigationHref", "file://", "sourcePassage", "archivePath"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("records a local approval only when every editorial checklist item passes", () => {
    const result = validateHoidHistoricalEditorialReviewDecision(packet(), {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
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
  });

  it("rejects approval with an incomplete checklist or issue note", () => {
    expect(validateHoidHistoricalEditorialReviewDecision(packet(), {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: { ...APPROVED_CHECKLIST, spoilerCeiling: false },
      noteCodes: ["no-issues"],
    })).toMatchObject({ status: "invalid", reason: "incomplete-approval" });
    expect(validateHoidHistoricalEditorialReviewDecision(packet(), {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["factual-issue"],
    })).toMatchObject({ status: "invalid", reason: "incomplete-approval" });
  });

  it("supports revision and rejection without treating either as approval", () => {
    const revision = validateHoidHistoricalEditorialReviewDecision(packet(), {
      decision: "revision-required",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: { ...APPROVED_CHECKLIST, completeness: false },
      noteCodes: ["completeness-issue"],
    });
    expect(revision).toMatchObject({
      status: "valid",
      outcome: "revision-required",
      promotionAllowed: false,
    });
    const rejected = validateHoidHistoricalEditorialReviewDecision(packet(), {
      decision: "rejected",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: { ...APPROVED_CHECKLIST, originality: false },
      noteCodes: ["originality-issue"],
    });
    expect(rejected).toMatchObject({ status: "valid", outcome: "rejected", promotionAllowed: false });
  });

  it("rejects invalid reviewer labels, timestamps, checklists and duplicate notes", () => {
    const base = {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    };
    expect(validateHoidHistoricalEditorialReviewDecision(packet(), { ...base, reviewerLabel: "local editor" }))
      .toMatchObject({ status: "invalid", reason: "invalid-reviewer" });
    expect(validateHoidHistoricalEditorialReviewDecision(packet(), { ...base, reviewedAt: "yesterday" }))
      .toMatchObject({ status: "invalid", reason: "invalid-date" });
    expect(validateHoidHistoricalEditorialReviewDecision(packet(), { ...base, checklist: {} }))
      .toMatchObject({ status: "invalid", reason: "invalid-checklist" });
    expect(validateHoidHistoricalEditorialReviewDecision(packet(), { ...base, noteCodes: ["no-issues", "no-issues"] }))
      .toMatchObject({ status: "invalid", reason: "invalid-checklist" });
  });

  it("revalidates a local receipt against the exact packet and preserves its non-trusted status", () => {
    const value = packet();
    const decision = validateHoidHistoricalEditorialReviewDecision(value, {
      decision: "approved",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: APPROVED_CHECKLIST,
      noteCodes: ["no-issues"],
    });
    if (decision.status !== "valid") throw new Error("Expected local review receipt");
    expect(validateHoidHistoricalEditorialReviewReceipt(value, decision.receipt)).toMatchObject({
      status: "valid",
      outcome: "approved-awaiting-trusted-promotion",
      promotionAllowed: false,
    });
    expect(validateHoidHistoricalEditorialReviewReceipt(value, {
      ...decision.receipt,
      promotionAllowed: true,
    })).toMatchObject({ status: "invalid", reason: "packet-mismatch" });
  });

  it("rejects a receipt replayed against a different packet", () => {
    const first = packet();
    const secondResult = buildHoidHistoricalEditorialReviewPacket({
      ...DRAFT,
      summaryText: SUMMARY + " Una precisión adicional.",
    }, EVIDENCE);
    if (secondResult.status !== "ready") throw new Error("Expected second packet");
    const decision = validateHoidHistoricalEditorialReviewDecision(first, {
      decision: "revision-required",
      reviewerLabel: "local-editor",
      reviewedAt: REVIEWED_AT,
      checklist: { ...APPROVED_CHECKLIST, factualAccuracy: false },
      noteCodes: ["factual-issue"],
    });
    if (decision.status !== "valid") throw new Error("Expected review receipt");
    expect(validateHoidHistoricalEditorialReviewReceipt(secondResult.packet, decision.receipt))
      .toMatchObject({ status: "invalid", reason: "packet-mismatch" });
  });
});
