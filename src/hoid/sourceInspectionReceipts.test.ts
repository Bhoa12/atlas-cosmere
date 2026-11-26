import { describe, expect, it } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { getHoidSourceIngestionPlan } from "./sourceIngestionPlan";
import {
  appendHoidSourceInspectionReceipt,
  createHoidEmptySourceInspectionReceiptLedger,
  createHoidSourceInspectionReceiptFromCandidate,
  recordHoidSourceInspectionReceipt,
  validateHoidSourceInspectionReceipt,
  validateHoidSourceInspectionReceiptLedger,
  type HoidSourceInspectionReceiptStorePort,
} from "./sourceInspectionReceipts";

const INSPECTED_AT = "2026-11-26T14:30:00.000Z";

function candidateFor(workId: string, overrides: Record<string, unknown> = {}) {
  const task = getHoidSourceIngestionPlan().tasks.find(item => item.workId === workId);
  if (!task) throw new Error(`No current ingestion task for ${workId}`);
  const manifestResult = getHoidReadingManifest(workId);
  if (manifestResult.status !== "ready") throw new Error(`No manifest for ${workId}`);

  return {
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
    navigationSha256: manifestResult.manifest.navigationSha256,
    packageSourceFingerprint: "b".repeat(64),
    candidateFingerprint: "c".repeat(64),
    minimumReaderChapter: task.minimumReaderChapter,
    authorizationEffect: "none",
    editorialEffect: "none",
    summaryCreated: false,
    productionWritePerformed: false,
    ...overrides,
  };
}

function receiptFor(workId = "tfe", overrides: Record<string, unknown> = {}) {
  const created = createHoidSourceInspectionReceiptFromCandidate(
    candidateFor(workId),
    INSPECTED_AT,
  );
  if (created.status !== "ready") throw new Error(`Could not create receipt: ${created.reason}`);
  return { ...created.receipt, ...overrides };
}

describe("Hoid device-local source inspection receipts", () => {
  it("creates a metadata-only receipt from the current candidate-only task", () => {
    const created = createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe"),
      INSPECTED_AT,
    );

    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;
    const manifest = getHoidReadingManifest("tfe");
    const task = getHoidSourceIngestionPlan().tasks.find(item => item.workId === "tfe");
    expect(manifest.status).toBe("ready");
    expect(task).toBeDefined();
    expect(created.receipt).toMatchObject({
      schemaVersion: 1,
      workId: "tfe",
      editionId: manifest.status === "ready" ? manifest.manifest.editionId : "",
      chapterNumber: task?.chapterNumber,
      byteLength: 512,
      inspectedAt: INSPECTED_AT,
    });
    expect(Object.keys(created.receipt).sort()).toEqual([
      "authorizationEffect",
      "byteLength",
      "chapterNumber",
      "documentSha256",
      "editionId",
      "editorialEffect",
      "inspectedAt",
      "navigationSha256",
      "productionWritePerformed",
      "receiptFingerprint",
      "schemaVersion",
      "status",
      "summaryCreated",
      "workId",
    ]);
  });

  it("does not store source text, URI, filename, archive path, locator or provider payload", () => {
    const created = createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe"),
      INSPECTED_AT,
    );
    expect(created.status).toBe("ready");
    if (created.status !== "ready") return;

    const serialized = JSON.stringify(created.receipt);
    for (const forbidden of [
      '"summary":',
      "sourceId",
      "file://",
      "displayName",
      "navigationHref",
      "locatorId",
      "packageSourceFingerprint",
      "candidateFingerprint",
      "privateEpubBytes",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("rejects a candidate for a task that is no longer current", () => {
    const created = createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe", { chapterNumber: 13 }),
      INSPECTED_AT,
    );
    expect(created).toEqual({ status: "rejected", reason: "stale-task" });
  });

  it("rejects candidate locator, edition and navigation mismatches", () => {
    expect(createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe", { locatorId: "nav:forged" }),
      INSPECTED_AT,
    )).toMatchObject({ status: "rejected", reason: "manifest-mismatch" });

    expect(createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe", { editionId: "other-edition" }),
      INSPECTED_AT,
    )).toMatchObject({ status: "rejected", reason: "manifest-mismatch" });

    expect(createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe", { navigationSha256: "d".repeat(64) }),
      INSPECTED_AT,
    )).toMatchObject({ status: "rejected", reason: "manifest-mismatch" });
  });

  it("rejects candidates that claim authorization, editorial approval or production writes", () => {
    for (const overrides of [
      { authorizationEffect: "granted" },
      { editorialEffect: "approved" },
      { summaryCreated: true },
      { productionWritePerformed: true },
    ]) {
      expect(createHoidSourceInspectionReceiptFromCandidate(
        candidateFor("tfe", overrides),
        INSPECTED_AT,
      ).status).toBe("rejected");
    }
  });

  it("rejects malformed candidates and non-canonical timestamps", () => {
    const candidate = candidateFor("tfe");
    Object.defineProperty(candidate, "documentSha256", {
      enumerable: true,
      get: () => "a".repeat(64),
    });
    expect(createHoidSourceInspectionReceiptFromCandidate(candidate, INSPECTED_AT).status)
      .toBe("rejected");
    expect(createHoidSourceInspectionReceiptFromCandidate(candidateFor("tfe"), "2026-11-26"))
      .toEqual({ status: "rejected", reason: "invalid-timestamp" });
  });

  it("validates a receipt against the exact current edition manifest", () => {
    const receipt = receiptFor("tfe");
    expect(validateHoidSourceInspectionReceipt(receipt).status).toBe("valid");

    expect(validateHoidSourceInspectionReceipt({
      ...receipt,
      editionId: "other-edition",
    })).toMatchObject({ status: "invalid", reason: "manifest-mismatch" });
  });

  it("rejects ambiguous chapter identities and unknown works", () => {
    const receipt = receiptFor("tfe");
    expect(validateHoidSourceInspectionReceipt({
      ...receipt,
      workId: "unknown-work",
    })).toMatchObject({ status: "invalid", reason: "unknown-work" });

    const elantrisManifest = getHoidReadingManifest("elantris");
    expect(elantrisManifest.status).toBe("ready");
    expect(validateHoidSourceInspectionReceipt({
      ...receipt,
      workId: "elantris",
      editionId: elantrisManifest.status === "ready" ? elantrisManifest.manifest.editionId : "",
      navigationSha256: elantrisManifest.status === "ready" ? elantrisManifest.manifest.navigationSha256 : "",
      chapterNumber: 48,
    })).toMatchObject({ status: "invalid", reason: "invalid-chapter" });
  });

  it("rejects malformed hashes, timestamps and byte lengths", () => {
    const receipt = receiptFor("tfe");
    expect(validateHoidSourceInspectionReceipt({ ...receipt, documentSha256: "not-a-hash" }))
      .toMatchObject({ status: "invalid", reason: "invalid-digest" });
    expect(validateHoidSourceInspectionReceipt({ ...receipt, inspectedAt: "tomorrow" }))
      .toMatchObject({ status: "invalid", reason: "invalid-timestamp" });
    expect(validateHoidSourceInspectionReceipt({ ...receipt, byteLength: 0 }))
      .toMatchObject({ status: "invalid", reason: "invalid-byte-length" });
    expect(validateHoidSourceInspectionReceipt({ ...receipt, receiptFingerprint: "f".repeat(64) }))
      .toMatchObject({ status: "invalid", reason: "invalid-fingerprint" });
  });

  it("starts with a canonical empty ledger and appends with one monotonic revision", () => {
    const empty = createHoidEmptySourceInspectionReceiptLedger();
    expect(validateHoidSourceInspectionReceiptLedger(empty).status).toBe("valid");

    const added = recordHoidSourceInspectionReceipt(empty, receiptFor("tfe"));
    expect(added.status).toBe("added");
    if (added.status !== "added") return;
    expect(added.ledger.revision).toBe(1);
    expect(added.ledger.receipts).toHaveLength(1);
    expect(added.ledger.authorizationEffect).toBe("none");
    expect(added.ledger.editorialEffect).toBe("none");
    expect(validateHoidSourceInspectionReceiptLedger(added.ledger).status).toBe("valid");
  });

  it("is idempotent for the same inspected document and does not increment the revision", () => {
    const first = recordHoidSourceInspectionReceipt(
      createHoidEmptySourceInspectionReceiptLedger(),
      receiptFor("tfe"),
    );
    if (first.status !== "added") throw new Error("Expected first receipt to be added");

    const second = recordHoidSourceInspectionReceipt(first.ledger, receiptFor("tfe", {
      inspectedAt: "2026-11-26T14:31:00.000Z",
    }));
    expect(second.status).toBe("unchanged");
    if (second.status === "unchanged") expect(second.ledger.revision).toBe(1);
  });

  it("preserves the original receipt when the same chapter later has different bytes", () => {
    const first = recordHoidSourceInspectionReceipt(
      createHoidEmptySourceInspectionReceiptLedger(),
      receiptFor("tfe"),
    );
    if (first.status !== "added") throw new Error("Expected first receipt to be added");

    const recreated = createHoidSourceInspectionReceiptFromCandidate(
      candidateFor("tfe", { documentSha256: "d".repeat(64) }),
      "2026-11-26T14:31:00.000Z",
    );
    expect(recreated.status).toBe("ready");
    if (recreated.status !== "ready") return;
    expect(recordHoidSourceInspectionReceipt(first.ledger, recreated.receipt).status)
      .toBe("conflict");
    expect(first.ledger.receipts[0].documentSha256).toBe("a".repeat(64));
  });

  it("rejects duplicate keys and non-canonical receipt ordering", () => {
    const first = recordHoidSourceInspectionReceipt(
      createHoidEmptySourceInspectionReceiptLedger(),
      receiptFor("tfe"),
    );
    if (first.status !== "added") throw new Error("Expected first receipt to be added");
    const second = recordHoidSourceInspectionReceipt(first.ledger, receiptFor("twok"));
    if (second.status !== "added") throw new Error("Expected second receipt to be added");

    const duplicated = {
      ...second.ledger,
      receipts: [second.ledger.receipts[0], second.ledger.receipts[0]],
    };
    expect(validateHoidSourceInspectionReceiptLedger(duplicated))
      .toMatchObject({ status: "invalid", reason: "duplicate-receipt" });

    const reversed = { ...second.ledger, receipts: [...second.ledger.receipts].reverse() };
    expect(validateHoidSourceInspectionReceiptLedger(reversed))
      .toMatchObject({ status: "invalid", reason: "non-canonical-order" });
  });

  it("rejects tampered ledger fingerprints and accessor-backed records", () => {
    const ledger = createHoidEmptySourceInspectionReceiptLedger();
    expect(validateHoidSourceInspectionReceiptLedger({
      ...ledger,
      fingerprint: "0".repeat(64),
    })).toMatchObject({ status: "invalid", reason: "invalid-fingerprint" });

    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "schemaVersion", { enumerable: true, get: () => 1 });
    expect(validateHoidSourceInspectionReceiptLedger(accessor).status).toBe("invalid");
  });

  it("appends through the store port without exposing the receipt payload", async () => {
    let stored: unknown = createHoidEmptySourceInspectionReceiptLedger();
    let revision = 0;
    const store: HoidSourceInspectionReceiptStorePort = {
      async read() { return stored; },
      async compareAndSwap(expectedRevision, next) {
        if (expectedRevision !== revision) return "conflict";
        stored = next;
        revision = next.revision;
        return "saved";
      },
    };

    const result = await appendHoidSourceInspectionReceipt(
      store,
      candidateFor("tfe") as never,
      INSPECTED_AT,
    );
    expect(result).toEqual({ status: "saved", receiptCount: 1 });
    expect(JSON.stringify(stored)).not.toContain('"summary":');
  });

  it("does not overwrite an invalid persisted ledger", async () => {
    let writes = 0;
    const store: HoidSourceInspectionReceiptStorePort = {
      async read() { return { schemaVersion: 99 }; },
      async compareAndSwap() { writes += 1; return "saved"; },
    };
    const result = await appendHoidSourceInspectionReceipt(
      store,
      candidateFor("tfe") as never,
      INSPECTED_AT,
    );
    expect(result.status).toBe("unavailable");
    expect(writes).toBe(0);
  });
});