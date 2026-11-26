import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { getHoidSourceIngestionPlan } from "./sourceIngestionPlan";
import {
  createHoidEmptySourceInspectionReceiptLedger,
  createHoidSourceInspectionReceiptFromCandidate,
  recordHoidSourceInspectionReceipt,
} from "./sourceInspectionReceipts";
import { projectHoidSourceInspectionReviewQueue } from "./sourceInspectionReviewQueue";

const INSPECTED_AT = "2026-11-26T16:00:00.000Z";

function receiptFor(workId: string, inspectedAt = INSPECTED_AT) {
  const task = getHoidSourceIngestionPlan().tasks.find(item => item.workId === workId);
  if (!task) throw new Error(`No current ingestion task for ${workId}`);
  const manifest = getHoidReadingManifest(workId);
  if (manifest.status !== "ready") throw new Error(`No manifest for ${workId}`);

  const candidate = {
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
    documentSha256: "a".repeat(64),
    navigationSha256: manifest.manifest.navigationSha256,
    packageSourceFingerprint: "b".repeat(64),
    candidateFingerprint: "c".repeat(64),
    minimumReaderChapter: task.minimumReaderChapter,
    authorizationEffect: "none",
    editorialEffect: "none",
    summaryCreated: false,
    productionWritePerformed: false,
  };
  const created = createHoidSourceInspectionReceiptFromCandidate(candidate, inspectedAt);
  if (created.status !== "ready") throw new Error(`Could not create receipt: ${created.reason}`);
  return created.receipt;
}

function ledgerFor(...workIds: string[]) {
  let ledger = createHoidEmptySourceInspectionReceiptLedger();
  for (const [index, workId] of workIds.entries()) {
    const added = recordHoidSourceInspectionReceipt(
      ledger,
      receiptFor(workId, `2026-11-26T16:0${index}:00.000Z`),
    );
    if (added.status !== "added") throw new Error(`Could not append ${workId}: ${added.status}`);
    ledger = added.ledger;
  }
  return ledger;
}

describe("Hoid metadata-only source inspection review handoff", () => {
  it("projects an empty valid ledger to an empty, non-authorizing queue", () => {
    const result = projectHoidSourceInspectionReviewQueue(
      createHoidEmptySourceInspectionReceiptLedger(),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items).toEqual([]);
    expect(result.queue.availableActions).toEqual([]);
    expect(result.queue).toMatchObject({
      sourceContentIncluded: false,
      sourceAccessPerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
      productionWritePerformed: false,
    });
  });

  it("maps a valid receipt to its exact catalogue work, edition and chapter", () => {
    const result = projectHoidSourceInspectionReviewQueue(ledgerFor("tfe"));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0]).toMatchObject({
      workId: "tfe",
      title: "El Imperio Final",
      editionId: getHoidReadingManifest("tfe").status === "ready"
        ? getHoidReadingManifest("tfe").manifest.editionId
        : "",
      chapterNumber: getHoidSourceIngestionPlan().tasks.find(item => item.workId === "tfe")?.chapterNumber,
      stage: "awaiting-source-reselection",
      sourceAvailability: "not-checked",
    });
  });

  it("never treats a receipt as sufficient to begin editorial review", () => {
    const result = projectHoidSourceInspectionReviewQueue(ledgerFor("tfe"));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items[0]).toMatchObject({
      sourceReselectionRequired: true,
      reviewCanStart: false,
      reviewBlockReason: "receipt-does-not-contain-source-content",
      summaryCreated: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    });
    expect(result.queue.availableActions).toEqual([]);
  });

  it("does not expose source bytes, XHTML, hashes, locators, paths or filenames", () => {
    const result = projectHoidSourceInspectionReviewQueue(ledgerFor("tfe"));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const serialized = JSON.stringify(result.queue);
    for (const forbidden of [
      "documentSha256",
      "navigationSha256",
      "receiptFingerprint",
      "locatorId",
      "navigationHref",
      "packageSourceFingerprint",
      "candidateFingerprint",
      "file://",
      ".epub",
      "privateEpubBytes",
      "<html",
      "summaryText",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("preserves canonical receipt order across multiple works", () => {
    const result = projectHoidSourceInspectionReviewQueue(ledgerFor("twok", "tfe"));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items.map(item => item.workId)).toEqual(["tfe", "twok"]);
  });

  it("does not turn an invalid or tampered ledger into an empty queue", () => {
    const ledger = ledgerFor("tfe");
    const result = projectHoidSourceInspectionReviewQueue({
      ...ledger,
      fingerprint: "0".repeat(64),
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-ledger" });
  });

  it("fails closed when the receipt no longer matches the edition manifest", () => {
    const ledger = ledgerFor("tfe");
    const receipt = ledger.receipts[0];
    const changedReceipt = { ...receipt, editionId: "unregistered-edition" };
    const result = projectHoidSourceInspectionReviewQueue({
      ...ledger,
      receipts: [changedReceipt],
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-ledger" });
  });

  it("keeps all queue items candidate-only and never adds approval capabilities", () => {
    const result = projectHoidSourceInspectionReviewQueue(ledgerFor("tfe", "twok"));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items.every(item =>
      item.stage === "awaiting-source-reselection" &&
      item.reviewCanStart === false &&
      item.authorizationEffect === "none" &&
      item.editorialEffect === "none" &&
      item.summaryCreated === false &&
      item.productionWritePerformed === false
    )).toBe(true);
    expect(Object.keys(result.queue).sort()).toEqual([
      "authorizationEffect",
      "availableActions",
      "editorialEffect",
      "items",
      "productionWritePerformed",
      "schemaVersion",
      "scope",
      "sourceAccessPerformed",
      "sourceContentIncluded",
    ]);
  });
});
