import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidReadingManifest } from "./readingManifest";
import { validateHoidSourceInspectionReceiptLedger } from "./sourceInspectionReceipts";

/**
 * A local receipt is only a digest-backed record that a chapter document was
 * inspected. It does not retain the EPUB or XHTML bytes, so it cannot begin an
 * editorial review by itself. The reader must select the local source again.
 */
export type HoidSourceInspectionReviewQueueItem = Readonly<{
  workId: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  editionId: string;
  chapterNumber: number;
  inspectedAt: string;
  stage: "awaiting-source-reselection";
  sourceAvailability: "not-checked";
  sourceReselectionRequired: true;
  reviewCanStart: false;
  reviewBlockReason: "receipt-does-not-contain-source-content";
  summaryCreated: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  editorialEffect: "none";
}>;

export type HoidSourceInspectionReviewQueue = Readonly<{
  schemaVersion: 1;
  scope: "device-local-review-handoff";
  sourceContentIncluded: false;
  sourceAccessPerformed: false;
  authorizationEffect: "none";
  editorialEffect: "none";
  productionWritePerformed: false;
  /** There are deliberately no approve, reject, publish or unlock operations. */
  availableActions: readonly [];
  items: readonly HoidSourceInspectionReviewQueueItem[];
}>;

export type HoidSourceInspectionReviewQueueResult =
  | Readonly<{
      status: "ready";
      queue: HoidSourceInspectionReviewQueue;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-ledger"
        | "manifest-unavailable"
        | "chapter-not-uniquely-verifiable";
    }>;

/**
 * Project the device-local receipt ledger into a minimal editorial handoff.
 *
 * This is deliberately not an approval queue: it cannot create summaries,
 * start source review, promote claims, write production knowledge, alter
 * reading progress, or authorize narrative answers. Every item requires the
 * reader to reselect the EPUB and run a fresh local inspection.
 */
export function projectHoidSourceInspectionReviewQueue(
  ledgerInput: unknown,
): HoidSourceInspectionReviewQueueResult {
  const validation = validateHoidSourceInspectionReceiptLedger(ledgerInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-ledger" });
  }

  const items: HoidSourceInspectionReviewQueueItem[] = [];
  for (const receipt of validation.ledger.receipts) {
    const work = HOID_SOURCE_BIBLIOGRAPHY.find(candidate => candidate.id === receipt.workId);
    if (!work) {
      return Object.freeze({ status: "unavailable", reason: "invalid-ledger" });
    }

    const manifestResult = getHoidReadingManifest(receipt.workId);
    if (manifestResult.status !== "ready" ||
        manifestResult.manifest.editionId !== receipt.editionId ||
        manifestResult.manifest.navigationSha256 !== receipt.navigationSha256) {
      return Object.freeze({ status: "unavailable", reason: "manifest-unavailable" });
    }

    const matchingUnits = manifestResult.manifest.units.filter(
      unit => unit.chapterNumber === receipt.chapterNumber && typeof unit.locatorId === "string",
    );
    if (matchingUnits.length !== 1) {
      return Object.freeze({
        status: "unavailable",
        reason: "chapter-not-uniquely-verifiable",
      });
    }

    items.push(Object.freeze({
      workId: work.id,
      title: work.title,
      sourceGroup: work.sourceGroup,
      editionId: receipt.editionId,
      chapterNumber: receipt.chapterNumber,
      inspectedAt: receipt.inspectedAt,
      stage: "awaiting-source-reselection",
      sourceAvailability: "not-checked",
      sourceReselectionRequired: true,
      reviewCanStart: false,
      reviewBlockReason: "receipt-does-not-contain-source-content",
      summaryCreated: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    }));
  }

  return Object.freeze({
    status: "ready",
    queue: Object.freeze({
      schemaVersion: 1,
      scope: "device-local-review-handoff",
      sourceContentIncluded: false,
      sourceAccessPerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
      productionWritePerformed: false,
      availableActions: Object.freeze([]) as readonly [],
      items: Object.freeze(items),
    }),
  });
}
