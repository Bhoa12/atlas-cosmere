import { describe, expect, it, vi } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewChecklist,
} from "./editorialReviewPackets";
import {
  getDefaultHoidEditorialReviewReceiptSnapshot,
  validateHoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptStorePort,
} from "./editorialReviewReceiptStore";
import {
  createHoidEditorialReviewSubmissionPort,
  getHoidEditorialReviewChecklistNoteCodes,
  projectHoidEditorialReviewWorkspace,
} from "./editorialReviewWorkflow";

const ALL_CHECKS: HoidEditorialReviewChecklist = Object.freeze({
  factualAccuracy: true,
  completeness: true,
  originality: true,
  spoilerCeiling: true,
  provenance: true,
});

const FACTUAL_ISSUE: HoidEditorialReviewChecklist = Object.freeze({
  ...ALL_CHECKS,
  factualAccuracy: false,
});

const packetsResult = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
if (packetsResult.status !== "ready" || packetsResult.packets.length === 0) {
  throw new Error("Editorial workflow test packets are unavailable");
}
const packet = packetsResult.packets[0];

function completedProgress(bookId: string) {
  return Object.freeze({
    schemaVersion: 2,
    revision: 1,
    positions: Object.freeze([
      Object.freeze({ bookId, completed: true, order: 1 }),
    ]),
    updatedAt: "2026-11-27T22:00:00.000Z",
  });
}

function emptyProgress() {
  return Object.freeze({
    schemaVersion: 2,
    revision: 0,
    positions: Object.freeze([]),
    updatedAt: null,
  });
}

function createStore(
  initial: unknown = getDefaultHoidEditorialReviewReceiptSnapshot(),
  behavior?: (
    expectedRevision: number,
    next: HoidEditorialReviewReceiptSnapshot,
    current: unknown,
  ) => Promise<"saved" | "conflict" | "unavailable">,
) {
  let stored = initial;
  const compareAndSwap = vi.fn(async (
    expectedRevision: number,
    next: HoidEditorialReviewReceiptSnapshot,
  ): Promise<"saved" | "conflict" | "unavailable"> => {
    if (behavior) return behavior(expectedRevision, next, stored);
    const current = validateHoidEditorialReviewReceiptSnapshot(stored);
    if (current.status !== "valid" || current.snapshot.revision !== expectedRevision) return "conflict";
    stored = next;
    return "saved";
  });
  const store: HoidEditorialReviewReceiptStorePort = {
    read: vi.fn(async () => stored),
    compareAndSwap,
  };
  return { store, compareAndSwap, getStored: () => stored };
}

describe("Hoid progress-scoped editorial review workflow", () => {
  it("shows original staging summaries only for packets inside completed reading progress", () => {
    const result = projectHoidEditorialReviewWorkspace(
      HOID_EDITORIAL_DRAFTS,
      [],
      completedProgress(packet.unlock.bookId),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.sourceTextIncluded).toBe(false);
    expect(result.futureDraftsIncluded).toBe(false);
    expect(result.providerEgress).toBe("none");
    expect(result.authorizationEffect).toBe("none");
    expect(result.spoilerUnlockEffect).toBe("none");
    expect(result.items.some(item => item.packetId === packet.packetId)).toBe(true);
    expect(result.items.every(item => item.workId === packet.source.bookId)).toBe(true);
    expect(result.items.find(item => item.packetId === packet.packetId)?.summary).toBe(packet.summary);
  });

  it("returns no summaries when progress is empty or invalid", () => {
    const empty = projectHoidEditorialReviewWorkspace(HOID_EDITORIAL_DRAFTS, [], emptyProgress());
    expect(empty.status).toBe("ready");
    if (empty.status === "ready") {
      expect(empty.items).toEqual([]);
      expect(empty.summaryTextIncluded).toBe(false);
    }

    const invalid = projectHoidEditorialReviewWorkspace(HOID_EDITORIAL_DRAFTS, [], {
      schemaVersion: 2,
      revision: 0,
      positions: [],
      updatedAt: null,
      unexpected: true,
    });
    expect(invalid.status).toBe("unavailable");
  });

  it("saves a complete local approval without persisting the summary or source locator", async () => {
    const fake = createStore();
    const onSnapshot = vi.fn();
    const port = createHoidEditorialReviewSubmissionPort({
      store: fake.store,
      getFreshProgress: async () => completedProgress(packet.unlock.bookId),
      onSnapshot,
      now: () => new Date("2026-11-27T22:00:00.000Z"),
    });

    const result = await port.submit({
      packetId: packet.packetId,
      decision: "approved",
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"],
    });

    expect(result).toBe("saved");
    expect(fake.compareAndSwap).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(1);

    const stored = fake.getStored() as HoidEditorialReviewReceiptSnapshot;
    expect(stored.revision).toBe(1);
    expect(stored.receipts).toHaveLength(1);
    expect(stored.receipts[0]).toMatchObject({
      packetId: packet.packetId,
      decision: "approved",
      reviewerId: "device-local-unverified",
    });
    expect(Object.keys(stored.receipts[0]).sort()).toEqual([
      "checklist",
      "decision",
      "draftId",
      "noteCodes",
      "packetId",
      "reviewedAt",
      "reviewerId",
      "schemaVersion",
      "sourceDocumentSha256",
      "summarySha256",
    ]);
    expect(JSON.stringify(stored)).not.toContain(packet.summary);
    expect(JSON.stringify(stored)).not.toContain(packet.source.locatorId);
    expect(JSON.stringify(stored)).not.toContain("sourceText");
    const validatedReceipt = validateHoidEditorialReviewReceipt(packet, stored.receipts[0]);
    expect(validatedReceipt.status).toBe("valid");
    if (validatedReceipt.status === "valid") {
      expect(validatedReceipt.outcome).toBe("approved-awaiting-source-promotion");
      expect(validatedReceipt.promotionAllowed).toBe(false);
    }
  });

  it("rejects approval when any checklist item is false", async () => {
    const fake = createStore();
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => completedProgress(packet.unlock.bookId) });
    const result = await port.submit({
      packetId: packet.packetId,
      decision: "approved",
      checklist: FACTUAL_ISSUE,
      noteCodes: ["no-issues"],
    });

    expect(result).toBe("invalid");
    expect(fake.compareAndSwap).not.toHaveBeenCalled();
  });

  it("stores a revision request with issue codes derived from unchecked criteria", async () => {
    const fake = createStore();
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => completedProgress(packet.unlock.bookId) });
    const noteCodes = getHoidEditorialReviewChecklistNoteCodes(FACTUAL_ISSUE);
    expect(noteCodes).toEqual(["factual-issue"]);

    const result = await port.submit({
      packetId: packet.packetId,
      decision: "revision-required",
      checklist: FACTUAL_ISSUE,
      noteCodes,
    });
    expect(result).toBe("saved");
    const stored = fake.getStored() as HoidEditorialReviewReceiptSnapshot;
    expect(stored.receipts[0].decision).toBe("revision-required");
    expect(stored.receipts[0].noteCodes).toEqual(["factual-issue"]);
  });

  it("refuses to review a packet after the progress ceiling moves backwards", async () => {
    const fake = createStore();
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => emptyProgress() });
    const result = await port.submit({
      packetId: packet.packetId,
      decision: "approved",
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"],
    });

    expect(result).toBe("not-eligible");
    expect(fake.compareAndSwap).not.toHaveBeenCalled();
  });

  it("returns conflict rather than overwriting a concurrent receipt update", async () => {
    const fake = createStore(
      getDefaultHoidEditorialReviewReceiptSnapshot(),
      async () => "conflict",
    );
    const compareAndSwap = fake.compareAndSwap;
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => completedProgress(packet.unlock.bookId) });
    const result = await port.submit({
      packetId: packet.packetId,
      decision: "approved",
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"],
    });

    expect(result).toBe("conflict");
    expect(compareAndSwap).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the stored receipt snapshot is corrupt", async () => {
    const fake = createStore({ schemaVersion: 99, revision: 0, receipts: [] });
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => completedProgress(packet.unlock.bookId) });
    const result = await port.submit({
      packetId: packet.packetId,
      decision: "approved",
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"],
    });

    expect(result).toBe("unavailable");
    expect(fake.compareAndSwap).not.toHaveBeenCalled();
  });

  it("fails closed when the live progress reader is unavailable", async () => {
    const fake = createStore();
    const getFreshProgress = vi.fn(async () => null);
    const port = createHoidEditorialReviewSubmissionPort({
      store: fake.store,
      getFreshProgress,
    });
    const result = await port.submit({
      packetId: packet.packetId,
      decision: "approved",
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"],
    });

    expect(result).toBe("unavailable");
    expect(getFreshProgress).toHaveBeenCalledTimes(1);
    expect(fake.store.read).not.toHaveBeenCalled();
    expect(fake.compareAndSwap).not.toHaveBeenCalled();
  });

  it("does not call the persistence port for accessor-bearing submissions", async () => {
    const fake = createStore();
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => completedProgress(packet.unlock.bookId) });
    let invoked = false;
    const input = {
      decision: "approved",
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"],
    };
    Object.defineProperty(input, "packetId", {
      enumerable: true,
      get: () => {
        invoked = true;
        return packet.packetId;
      },
    });

    const result = await port.submit(input as never);
    expect(result).toBe("invalid");
    expect(invoked).toBe(false);
    expect(fake.store.read).not.toHaveBeenCalled();
  });

  it("does not create a second receipt for a packet already reviewed", async () => {
    const fake = createStore();
    const port = createHoidEditorialReviewSubmissionPort({ store: fake.store, getFreshProgress: async () => completedProgress(packet.unlock.bookId) });
    const submission = {
      packetId: packet.packetId,
      decision: "approved" as const,
      checklist: ALL_CHECKS,
      noteCodes: ["no-issues"] as const,
    };
    expect(await port.submit(submission)).toBe("saved");
    expect(await port.submit(submission)).toBe("not-eligible");
    const stored = fake.getStored() as HoidEditorialReviewReceiptSnapshot;
    expect(stored.receipts).toHaveLength(1);
    expect(stored.revision).toBe(1);
  });
});
