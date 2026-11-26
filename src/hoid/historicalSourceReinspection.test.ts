import { describe, expect, it } from "vitest";
import type {
  HoidEpubChapterInspectionCandidate,
  HoidEpubPackageInspectionCandidate,
  HoidEpubInspectionResult,
} from "./epubIngestion";
import { getHoidReadingManifest } from "./readingManifest";
import { getHoidSourceIngestionPlan } from "./sourceIngestionPlan";
import { createHoidSourceInspectionReceiptFromCandidate } from "./sourceInspectionReceipts";
import {
  reinspectHoidHistoricalSourceChapter,
  type HoidHistoricalChapterInspectionPort,
} from "./historicalSourceReinspection";

const INSPECTED_AT = "2026-11-26T16:00:00.000Z";
const VERIFIED_AT = "2026-11-26T17:00:00.000Z";
const DOCUMENT_SHA = "a".repeat(64);
const PACKAGE_SHA = "b".repeat(64);
const CANDIDATE_SHA = "c".repeat(64);

function fixture() {
  const task = getHoidSourceIngestionPlan().tasks.find(item => item.workId === "tfe");
  if (!task) throw new Error("The test requires the verified El Imperio Final manifest task");
  const manifestResult = getHoidReadingManifest(task.workId);
  if (manifestResult.status !== "ready") throw new Error("The test manifest is unavailable");
  const manifest = manifestResult.manifest;

  const receiptCandidate = {
    schemaVersion: 1,
    status: "candidate-only",
    workId: task.workId,
    title: task.title,
    chapterNumber: task.chapterNumber,
    editionId: task.editionId,
    sourceGroup: task.sourceGroup,
    locatorId: task.locatorId,
    navigationHref: task.navigationHref,
    byteLength: 512,
    documentSha256: DOCUMENT_SHA,
    navigationSha256: manifest.navigationSha256,
    packageSourceFingerprint: PACKAGE_SHA,
    candidateFingerprint: CANDIDATE_SHA,
    minimumReaderChapter: task.minimumReaderChapter,
    authorizationEffect: "none",
    editorialEffect: "none",
    summaryCreated: false,
    productionWritePerformed: false,
  };
  const receiptResult = createHoidSourceInspectionReceiptFromCandidate(
    receiptCandidate,
    INSPECTED_AT,
  );
  if (receiptResult.status !== "ready") {
    throw new Error("Could not create test receipt: " + receiptResult.reason);
  }

  const source = Object.freeze({
    sourceId: "local-source-341",
    workId: task.workId,
    editionId: task.editionId,
    sourceGroup: task.sourceGroup,
  });
  const packageCandidate: HoidEpubPackageInspectionCandidate = Object.freeze({
    status: "candidate-only",
    sourceId: source.sourceId,
    workId: task.workId,
    declaredEditionId: task.editionId,
    sourceGroup: task.sourceGroup,
    editionBinding: "catalogue-navigation-digest-match",
    packageVersion: "3.0",
    title: task.title,
    language: "es",
    uniqueIdentifier: "urn:hoid:test:341",
    archiveEntryCount: 20,
    manifestItemCount: 12,
    spineItemCount: 12,
    navigationEntryCount: 11,
    navigationXhtmlTargetCount: 11,
    archiveInventorySha256: "1".repeat(64),
    mimetypeSha256: "2".repeat(64),
    containerDocumentSha256: "3".repeat(64),
    packageDocumentSha256: "4".repeat(64),
    navigationDocumentSha256: manifest.navigationSha256,
    sourceFingerprint: PACKAGE_SHA,
  });
  const chapterCandidate: HoidEpubChapterInspectionCandidate = Object.freeze({
    status: "candidate-only",
    workId: task.workId,
    declaredEditionId: task.editionId,
    sourceGroup: task.sourceGroup,
    navigationHref: task.navigationHref,
    byteLength: 512,
    documentSha256: DOCUMENT_SHA,
    navigationDocumentSha256: manifest.navigationSha256,
    packageSourceFingerprint: PACKAGE_SHA,
    candidateFingerprint: CANDIDATE_SHA,
  });

  const state: {
    result: HoidEpubInspectionResult<HoidEpubChapterInspectionCandidate>;
    shouldThrow: boolean;
    calls: Array<{ packageCandidate: unknown; navigationHref: unknown }>;
  } = {
    result: Object.freeze({ status: "candidate", candidate: chapterCandidate }),
    shouldThrow: false,
    calls: [],
  };
  const ingestion: HoidHistoricalChapterInspectionPort = {
    inspectChapterDocument: async (candidate, href) => {
      state.calls.push({ packageCandidate: candidate, navigationHref: href });
      if (state.shouldThrow) throw new Error("local source unavailable");
      return state.result;
    },
  };

  return {
    task,
    source,
    packageCandidate,
    receipt: receiptResult.receipt,
    chapterCandidate,
    state,
    ingestion,
    input: {
      receipt: receiptResult.receipt,
      source,
      packageCandidate,
      ingestion,
      verifiedAt: VERIFIED_AT,
    },
  };
}

describe("Hoid exact historical source reinspection", () => {
  it("re-verifies the exact historical chapter against the selected local edition", async () => {
    const value = fixture();
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result).toMatchObject({
      status: "verified",
      attestation: {
        scope: "ephemeral-historical-source-reinspection",
        workId: value.task.workId,
        editionId: value.task.editionId,
        chapterNumber: value.task.chapterNumber,
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
      },
    });
    expect(value.state.calls).toHaveLength(1);
    expect(value.state.calls[0].packageCandidate).toBe(value.packageCandidate);
    expect(value.state.calls[0].navigationHref).toBe(value.task.navigationHref);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects a receipt whose fingerprint or metadata has been tampered with", async () => {
    const value = fixture();
    const result = await reinspectHoidHistoricalSourceChapter({
      ...value.input,
      receipt: { ...value.receipt, documentSha256: "d".repeat(64) },
    });
    expect(result).toMatchObject({ status: "rejected", reason: "invalid-receipt" });
    expect(value.state.calls).toHaveLength(0);
  });

  it("requires the explicitly selected source to match the receipt work and edition", async () => {
    const value = fixture();
    const result = await reinspectHoidHistoricalSourceChapter({
      ...value.input,
      source: { ...value.source, editionId: "unregistered-edition" },
    });
    expect(result).toMatchObject({ status: "rejected", reason: "invalid-source-descriptor" });
    expect(value.state.calls).toHaveLength(0);
  });

  it("requires the package candidate to match the receipt's edition and navigation digest", async () => {
    const value = fixture();
    const result = await reinspectHoidHistoricalSourceChapter({
      ...value.input,
      packageCandidate: {
        ...value.packageCandidate,
        navigationDocumentSha256: "0".repeat(64),
      },
    });
    expect(result).toMatchObject({ status: "rejected", reason: "package-candidate-mismatch" });
    expect(value.state.calls).toHaveLength(0);
  });

  it("blocks review when the reselected chapter document digest has changed", async () => {
    const value = fixture();
    value.state.result = Object.freeze({
      status: "candidate",
      candidate: Object.freeze({
        ...value.chapterCandidate,
        documentSha256: "d".repeat(64),
      }),
    });
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result).toMatchObject({
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
    });
  });

  it("blocks review when byte length differs even if the digest is reported unchanged", async () => {
    const value = fixture();
    value.state.result = Object.freeze({
      status: "candidate",
      candidate: Object.freeze({
        ...value.chapterCandidate,
        byteLength: 513,
      }),
    });
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result).toMatchObject({
      status: "changed",
      reason: "document-length-mismatch",
      existingReceiptPreserved: true,
      reviewCanStart: false,
    });
  });

  it("fails closed when the ingestion adapter rejects the chapter", async () => {
    const value = fixture();
    value.state.result = Object.freeze({
      status: "rejected",
      reason: "chapter-not-in-navigation",
    });
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result).toMatchObject({ status: "rejected", reason: "inspection-rejected" });
  });

  it("rejects malformed or extra-field chapter candidates", async () => {
    const value = fixture();
    value.state.result = Object.freeze({
      status: "candidate",
      candidate: Object.freeze({
        ...value.chapterCandidate,
        sourceText: "must-not-be-returned",
      }) as unknown as HoidEpubChapterInspectionCandidate,
    });
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result).toMatchObject({ status: "rejected", reason: "chapter-candidate-mismatch" });
  });

  it("does not call the local source adapter when the operation is already cancelled", async () => {
    const value = fixture();
    const controller = new AbortController();
    controller.abort();
    const result = await reinspectHoidHistoricalSourceChapter({
      ...value.input,
      signal: controller.signal,
    });
    expect(result).toMatchObject({ status: "rejected", reason: "cancelled" });
    expect(value.state.calls).toHaveLength(0);
  });

  it("converts source adapter exceptions into a closed rejection", async () => {
    const value = fixture();
    value.state.shouldThrow = true;
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result).toMatchObject({ status: "rejected", reason: "inspection-failed" });
  });

  it("rejects non-canonical verification timestamps", async () => {
    const value = fixture();
    const result = await reinspectHoidHistoricalSourceChapter({
      ...value.input,
      verifiedAt: "2026-11-26",
    });
    expect(result).toMatchObject({ status: "rejected", reason: "invalid-timestamp" });
    expect(value.state.calls).toHaveLength(0);
  });

  it("returns no source text, locator, file identifier, digest or persistence capability", async () => {
    const value = fixture();
    const result = await reinspectHoidHistoricalSourceChapter(value.input);
    expect(result.status).toBe("verified");
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "documentSha256",
      "navigationSha256",
      "candidateFingerprint",
      "navigationHref",
      "sourceId",
      "file://",
      "<html",
      "sourceText",
      "compareAndSwap",
      "approve",
      "publish",
    ]) expect(serialized).not.toContain(forbidden);
  });
});
