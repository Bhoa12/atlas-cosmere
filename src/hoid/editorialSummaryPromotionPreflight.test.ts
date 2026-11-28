import { describe, expect, it, vi } from "vitest";
import {
  buildHoidEditorialReviewPackets,
  fingerprintHoidEditorialReviewDecision,
  validateHoidEditorialReviewReceipt,
} from "./editorialReviewPackets";
import { validateHoidEditorialReviewReceiptSnapshot } from "./editorialReviewReceiptStore";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { createHoidReadingCursor } from "./readingManifest";
import {
  createHoidEditorialSummaryPromotionPreflightPort,
} from "./editorialSummaryPromotionPreflight";

const REVIEWED_AT = "2026-11-27T20:00:00.000Z";
const SHA_A = "a".repeat(64);

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return result.cursor;
}

function progress(chapter = 2, revision = 1) {
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "twok", cursor: cursor("twok", chapter), order: 1 }),
    ]),
    updatedAt: revision === 0 ? null : REVIEWED_AT,
  });
}

function selectedPacket() {
  const result = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
  if (result.status !== "ready") throw new Error("Paquetes editoriales no disponibles");
  const packet = result.packets.find(item => item.draftId === "twok.chapter-001.cenn-battle");
  if (!packet) throw new Error("Paquete editorial de prueba no disponible");
  return packet;
}

function receiptFor(decision: "approved" | "revision-required" | "rejected" = "approved") {
  const packet = selectedPacket();
  const checklist = decision === "approved"
    ? {
        factualAccuracy: true,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      }
    : {
        factualAccuracy: false,
        completeness: true,
        originality: true,
        spoilerCeiling: true,
        provenance: true,
      };
  const validation = validateHoidEditorialReviewReceipt(packet, {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision,
    reviewerId: "device-local-unverified",
    reviewedAt: REVIEWED_AT,
    checklist,
    noteCodes: decision === "approved" ? ["no-issues"] : ["factual-issue"],
  });
  if (validation.status !== "valid") throw new Error("Recibo editorial de prueba inválido");
  return validation.receipt;
}

function receiptSnapshot(
  revision = 1,
  decision: "approved" | "revision-required" | "rejected" | null = "approved",
) {
  const validation = validateHoidEditorialReviewReceiptSnapshot({
    schemaVersion: 1,
    revision,
    receipts: decision === null ? [] : [receiptFor(decision)],
  });
  if (validation.status !== "valid") throw new Error("Snapshot de recibos no disponible");
  return validation.snapshot;
}

function fixture(options: Readonly<{
  progressReader?: () => Promise<unknown | null>;
  storeReader?: () => Promise<unknown>;
  sourceResult?: (request: unknown, signal: AbortSignal) => Promise<unknown>;
  sourceTimeoutMs?: number;
}> = {}) {
  const packet = selectedPacket();
  const snapshot = receiptSnapshot();
  const store = Object.freeze({
    read: options.storeReader ?? vi.fn(async () => snapshot),
    compareAndSwap: vi.fn(async () => "saved" as const),
  });
  const getFreshProgress = options.progressReader ?? vi.fn(async () => progress());
  const inspectChapter = vi.fn(async (request: unknown, config: Readonly<{ signal: AbortSignal }>) => {
    if (options.sourceResult) return options.sourceResult(request, config.signal);
    return Object.freeze({
      status: "available",
      documentSha256: packet.sourceDocumentSha256,
    });
  });
  const port = createHoidEditorialSummaryPromotionPreflightPort({
    store,
    getFreshProgress,
    sourceAccessPort: Object.freeze({ inspectChapter }),
    sourceTimeoutMs: options.sourceTimeoutMs,
  });
  return { port, packet, store, getFreshProgress, inspectChapter, snapshot };
}

describe("Hoid source-bound editorial summary promotion preflight", () => {
  it("verifies one approved summary against its exact local chapter document", async () => {
    const value = fixture();
    const result = await value.port.audit({ packetId: value.packet.packetId });

    expect(result).toMatchObject({
      status: "ready-for-authenticated-review",
      packetId: value.packet.packetId,
      draftId: value.packet.draftId,
      workId: "twok",
      chapterNumber: 1,
      sourceDocumentVerified: true,
      reviewerIdentity: "unverified-local",
      promotionAllowed: false,
      productionWritePerformed: false,
      answerAuthorizationEffect: "none",
      spoilerUnlockEffect: "none",
    });
    expect(value.inspectChapter).toHaveBeenCalledTimes(1);
    expect(value.inspectChapter).toHaveBeenCalledWith(
      {
        bookId: value.packet.source.bookId,
        editionId: value.packet.source.editionId,
        navigationSha256: value.packet.source.navigationSha256,
        chapterNumber: value.packet.source.chapter,
        locatorId: value.packet.source.locatorId,
        expectedDocumentSha256: value.packet.sourceDocumentSha256,
      },
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(value.store.compareAndSwap).not.toHaveBeenCalled();
  });

  it("returns only safe metadata and never exposes the summary, locator or document digest", async () => {
    const value = fixture();
    const result = await value.port.audit({ packetId: value.packet.packetId });
    expect(result.status).toBe("ready-for-authenticated-review");
    if (result.status !== "ready-for-authenticated-review") return;
    expect(Object.keys(result).sort()).toEqual([
      "status", "packetId", "draftId", "workId", "chapterNumber", "editionId",
      "progressRevision", "progressFingerprint", "receiptFingerprint", "reviewDecisionFingerprint", "sourceDocumentVerified",
      "reviewerIdentity", "promotionAllowed", "productionWritePerformed",
      "answerAuthorizationEffect", "spoilerUnlockEffect",
    ].sort());
    const serialized = JSON.stringify(result);
    expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.reviewDecisionFingerprint).toBe(
      fingerprintHoidEditorialReviewDecision(receiptFor()),
    );
    expect(serialized).not.toContain(value.packet.summary);
    expect(serialized).not.toContain(value.packet.source.locatorId);
    expect(serialized).not.toContain(value.packet.sourceDocumentSha256);
    expect(serialized).not.toContain("file://");
    expect(serialized).not.toContain("content://");
  });

  it("rejects malformed and accessor-backed requests without invoking getters", async () => {
    const value = fixture();
    let invoked = false;
    const request = Object.defineProperty({}, "packetId", {
      enumerable: true,
      get() {
        invoked = true;
        return value.packet.packetId;
      },
    });

    expect(await value.port.audit(request)).toMatchObject({
      status: "blocked",
      reason: "invalid-request",
    });
    expect(invoked).toBe(false);
    expect(value.getFreshProgress).not.toHaveBeenCalled();
  });

  it("blocks when progress cannot be loaded or validated", async () => {
    const value = fixture({ progressReader: vi.fn(async () => null) });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "progress-unavailable",
    });
    expect(value.inspectChapter).not.toHaveBeenCalled();
  });

  it("does not inspect a chapter that has not passed the completed-through cursor boundary", async () => {
    const value = fixture({ progressReader: vi.fn(async () => progress(1)) });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "chapter-not-yet-unlocked",
    });
    expect(value.inspectChapter).not.toHaveBeenCalled();
  });

  it("requires exactly one locally approved receipt", async () => {
    const empty = receiptSnapshot(1, null);
    const value = fixture({ storeReader: vi.fn(async () => empty) });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "receipt-not-approved",
    });
    expect(value.inspectChapter).not.toHaveBeenCalled();
  });

  it("does not treat a correction or rejection receipt as approval", async () => {
    const correction = receiptSnapshot(1, "revision-required");
    const value = fixture({ storeReader: vi.fn(async () => correction) });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "receipt-not-approved",
    });
    expect(value.inspectChapter).not.toHaveBeenCalled();
  });

  it("blocks if the exact private EPUB source is not currently loaded", async () => {
    const value = fixture({
      sourceResult: async () => Object.freeze({ status: "unavailable", reason: "source-not-loaded" }),
    });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "source-unavailable",
    });
  });

  it("blocks a source digest that differs from the verified chapter allowlist", async () => {
    const value = fixture({
      sourceResult: async () => Object.freeze({ status: "available", documentSha256: SHA_A }),
    });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "source-digest-mismatch",
    });
  });

  it("rejects source adapters that attempt to return extra fields or chapter text", async () => {
    const value = fixture({
      sourceResult: async () => Object.freeze({
        status: "available",
        documentSha256: valueDigest(),
        xhtml: "<html>private text</html>",
      }),
    });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "source-access-failed",
    });
  });

  it("aborts a source inspection that exceeds the configured deadline", async () => {
    let aborted = false;
    const value = fixture({
      sourceTimeoutMs: 5,
      sourceResult: async (_request, signal) => new Promise(resolve => {
        signal.addEventListener("abort", () => {
          aborted = true;
          resolve({ status: "unavailable", reason: "cancelled" });
        }, { once: true });
      }),
    });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "source-timeout",
    });
    expect(aborted).toBe(true);
  });

  it("discards the result if progress changes while the source is being inspected", async () => {
    let reads = 0;
    const value = fixture({
      progressReader: vi.fn(async () => {
        reads += 1;
        return progress(2, reads);
      }),
    });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "progress-changed",
    });
    expect(value.inspectChapter).toHaveBeenCalledTimes(1);
  });

  it("discards the result if the receipt snapshot changes during source inspection", async () => {
    let reads = 0;
    const value = fixture({
      storeReader: vi.fn(async () => {
        reads += 1;
        return receiptSnapshot(reads);
      }),
    });
    expect(await value.port.audit({ packetId: value.packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "receipts-changed",
    });
  });

  it("blocks when the source-access port is absent or malformed", async () => {
    const packet = selectedPacket();
    const store = Object.freeze({
      read: vi.fn(async () => receiptSnapshot()),
      compareAndSwap: vi.fn(async () => "saved" as const),
    });
    const port = createHoidEditorialSummaryPromotionPreflightPort({
      store,
      getFreshProgress: async () => progress(),
      sourceAccessPort: Object.freeze({ inspectChapter: "not-a-function" }),
    });
    expect(await port.audit({ packetId: packet.packetId })).toMatchObject({
      status: "blocked",
      reason: "source-access-port-invalid",
    });
  });

  it("never writes receipts or production data during preflight", async () => {
    const value = fixture();
    await value.port.audit({ packetId: value.packet.packetId });
    expect(value.store.compareAndSwap).not.toHaveBeenCalled();
  });
});

function valueDigest(): string {
  return selectedPacket().sourceDocumentSha256;
}
