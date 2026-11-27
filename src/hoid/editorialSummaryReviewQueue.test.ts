import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { buildHoidEditorialReviewPackets } from "./editorialReviewPackets";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidEditorialSummaryReviewQueue } from "./editorialSummaryReviewQueue";

const reviewedAt = "2026-11-27T20:00:00.000Z";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return result.cursor;
}

function snapshot(
  positions: readonly Record<string, unknown>[],
  revision = 1,
) {
  return {
    schemaVersion: 2,
    revision,
    positions,
    updatedAt: revision === 0 ? null : reviewedAt,
  };
}

function draft(id: string) {
  const value = HOID_EDITORIAL_DRAFTS.find(item => item.id === id);
  if (!value) throw new Error("Borrador de prueba no disponible: " + id);
  return value;
}

function packetFor(id: string) {
  const result = buildHoidEditorialReviewPackets([draft(id)]);
  if (result.status !== "ready" || result.packets.length !== 1) {
    throw new Error("No se pudo construir el paquete editorial de prueba");
  }
  return result.packets[0];
}

function approvalReceipt(id: string) {
  const packet = packetFor(id);
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision: "approved",
    reviewerId: "local-editor-1",
    reviewedAt,
    checklist: {
      factualAccuracy: true,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
  };
}

function revisionReceipt(id: string) {
  const packet = packetFor(id);
  return {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision: "revision-required",
    reviewerId: "local-editor-1",
    reviewedAt,
    checklist: {
      factualAccuracy: false,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["factual-issue"],
  };
}

describe("Hoid progress-bound editorial summary review queue", () => {
  it("fails closed when the cursor snapshot cannot be validated", () => {
    expect(projectHoidEditorialSummaryReviewQueue(
      HOID_EDITORIAL_DRAFTS,
      [],
      null,
    )).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("does not show a chapter-one summary while chapter one is still open", () => {
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft("twok.chapter-001.cenn-battle")],
      [],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 1), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items).toEqual([]);
    expect(result.queue.counts).toEqual({
      total: 0,
      pendingReview: 0,
      approvedAwaitingSourcePromotion: 0,
      revisionRequired: 0,
      rejected: 0,
    });
    expect(JSON.stringify(result.queue)).not.toContain("withheld");
  });

  it("shows a chapter-one summary only after the cursor advances to chapter two", () => {
    const selected = draft("twok.chapter-001.cenn-battle");
    const result = projectHoidEditorialSummaryReviewQueue(
      [selected],
      [],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0]).toMatchObject({
      draftId: selected.id,
      workId: "twok",
      title: "El Camino de los Reyes",
      chapterNumber: 1,
      unlockChapter: 1,
      status: "pending-review",
      reviewerTrust: "not-reviewed",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("does not reveal a chapter-two draft while chapter two is the open cursor", () => {
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft("twok.chapter-002.kaladin-slave-caravan")],
      [],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items).toEqual([]);
  });

  it("reveals chapter-two metadata only after the cursor advances to chapter three", () => {
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft("twok.chapter-002.kaladin-slave-caravan")],
      [],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 3), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items.map(item => item.chapterNumber)).toEqual([2]);
  });

  it("keeps future works absent when their cursors are not in the progress snapshot", () => {
    const result = projectHoidEditorialSummaryReviewQueue(
      [
        draft("twok.chapter-001.cenn-battle"),
        draft("edgedancer.chapter-001.lift-departure"),
      ],
      [],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items.map(item => item.workId)).toEqual(["twok"]);
    expect(JSON.stringify(result.queue)).not.toContain("edgedancer.chapter-001");
  });

  it("unlocks all drafts for an explicitly completed work without counting other works", () => {
    const selected = HOID_EDITORIAL_DRAFTS.filter(item => item.evidenceUnlock.bookId === "twok");
    const result = projectHoidEditorialSummaryReviewQueue(
      selected,
      [],
      snapshot([{ bookId: "twok", completed: true, order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items).toHaveLength(selected.length);
    expect(result.queue.items.every(item => item.workId === "twok")).toBe(true);
  });

  it("maps a valid local approval to awaiting trusted promotion, never production", () => {
    const id = "twok.chapter-001.cenn-battle";
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft(id)],
      [approvalReceipt(id)],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items[0]).toMatchObject({
      status: "approved-awaiting-source-promotion",
      reviewedAt,
      checklistPassedCount: 5,
      reviewerTrust: "unverified-local-label",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(result.queue.counts.approvedAwaitingSourcePromotion).toBe(1);
  });

  it("preserves revision-required decisions without turning them into approvals", () => {
    const id = "twok.chapter-001.cenn-battle";
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft(id)],
      [revisionReceipt(id)],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.queue.items[0].status).toBe("revision-required");
    expect(result.queue.items[0].checklistPassedCount).toBe(4);
    expect(result.queue.counts.revisionRequired).toBe(1);
  });

  it("rejects orphaned and duplicate receipts instead of silently ignoring them", () => {
    const id = "twok.chapter-001.cenn-battle";
    const receipt = approvalReceipt(id);
    const progress = snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]);
    expect(projectHoidEditorialSummaryReviewQueue(
      [draft(id)],
      [{ ...receipt, packetId: "unknown-packet" }],
      progress,
    )).toEqual({ status: "invalid", reason: "orphan-receipt" });
    expect(projectHoidEditorialSummaryReviewQueue(
      [draft(id)],
      [receipt, receipt],
      progress,
    )).toEqual({ status: "invalid", reason: "duplicate-receipt" });
  });

  it("rejects malformed or mismatched review receipts", () => {
    const id = "twok.chapter-001.cenn-battle";
    const receipt = { ...approvalReceipt(id), summarySha256: "0".repeat(64) };
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft(id)],
      [receipt],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result).toEqual({ status: "invalid", reason: "invalid-receipt" });
  });

  it("rejects accessor-bearing receipt arrays without executing the accessor", () => {
    const receipts: unknown[] = [];
    let invoked = false;
    Object.defineProperty(receipts, "0", {
      enumerable: true,
      get: () => {
        invoked = true;
        return approvalReceipt("twok.chapter-001.cenn-battle");
      },
    });
    receipts.length = 1;
    const result = projectHoidEditorialSummaryReviewQueue(
      [draft("twok.chapter-001.cenn-battle")],
      receipts,
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result).toEqual({ status: "invalid", reason: "invalid-receipts" });
    expect(invoked).toBe(false);
  });

  it("returns no summary text, source text, locator, digest, path or URI", () => {
    const selected = draft("twok.chapter-001.cenn-battle");
    const result = projectHoidEditorialSummaryReviewQueue(
      [selected],
      [],
      snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const serialized = JSON.stringify(result.queue);
    expect(Object.keys(result.queue.items[0]).sort()).toEqual([
      "draftId", "packetId", "workId", "title", "chapterNumber", "unlockChapter",
      "editionId", "status", "reviewedAt", "checklistPassedCount", "reviewerTrust",
      "noteCodes", "promotionAllowed", "productionWritePerformed",
    ].sort());
    expect(result.queue.items[0]).not.toHaveProperty("summary");
    expect(result.queue.items[0]).not.toHaveProperty("sourceText");
    expect(result.queue.items[0]).not.toHaveProperty("locatorId");
    expect(result.queue.items[0]).not.toHaveProperty("documentSha256");
    for (const forbidden of [
      selected.summary,
      selected.evidenceSource.locatorId,
      selected.sourceIntegrity.documentSha256,
      "summarySha256",
      "sourceDocumentSha256",
      "file://",
      "content://",
      "<html",
    ]) expect(serialized).not.toContain(forbidden);
    expect(result.queue).toMatchObject({
      sourceTextIncluded: false,
      summaryTextIncluded: false,
      futureDraftsIncluded: false,
      localSourceAccessPerformed: false,
      localAvailability: "not-audited",
      providerEgress: "none",
      reviewerIdentityAuthority: "not-authenticated-by-local-receipt",
      promotionAllowed: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      progressEffect: "none",
      spoilerUnlockEffect: "none",
    });
  });

  it("returns a deterministic immutable fingerprint for the same progress and receipts", () => {
    const selected = [draft("twok.chapter-001.cenn-battle")];
    const progress = snapshot([{ bookId: "twok", cursor: cursor("twok", 2), order: 1 }], 4);
    const first = projectHoidEditorialSummaryReviewQueue(selected, [], progress);
    const second = projectHoidEditorialSummaryReviewQueue(selected, [], progress);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(first.queue.fingerprint).toBe(second.queue.fingerprint);
    expect(Object.isFrozen(first.queue)).toBe(true);
    expect(Object.isFrozen(first.queue.items)).toBe(true);
    expect(Object.isFrozen(first.queue.items[0])).toBe(true);
  });
});
