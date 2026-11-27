import { describe, expect, it } from "vitest";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewReceipt,
} from "./editorialReviewPackets";
import {
  validateHoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptSnapshot,
} from "./editorialReviewReceiptStore";
import {
  ExpoSqliteHoidEditorialReviewReceiptStore,
  type HoidEditorialReceiptSqliteRunResult,
  type HoidEditorialReceiptSqliteTransaction,
  type HoidEditorialReceiptSqliteValue,
} from "./sqliteEditorialReviewReceiptStore";
import type { HoidSqliteDatabasePort } from "./sqliteProgressStore";

type FakeRow = { schema_version: number; revision: number; payload: string };
type FakeState = { row: FakeRow | null };

const REVIEWED_AT = "2026-11-27T20:00:00.000Z";
const DRAFT_ID = "twok.chapter-001.cenn-battle";

function validReceipt(): HoidEditorialReviewReceipt {
  const draft = HOID_EDITORIAL_DRAFTS.find(item => item.id === DRAFT_ID);
  if (!draft) throw new Error("Borrador editorial de prueba no disponible");
  const packetResult = buildHoidEditorialReviewPackets([draft]);
  if (packetResult.status !== "ready" || packetResult.packets.length !== 1) {
    throw new Error("Paquete editorial de prueba no disponible");
  }
  const packet = packetResult.packets[0];
  const validation = validateHoidEditorialReviewReceipt(packet, {
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision: "approved",
    reviewerId: "local-editor-1",
    reviewedAt: REVIEWED_AT,
    checklist: {
      factualAccuracy: true,
      completeness: true,
      originality: true,
      spoilerCeiling: true,
      provenance: true,
    },
    noteCodes: ["no-issues"],
  });
  if (validation.status !== "valid") throw new Error("Recibo editorial de prueba inválido");
  return validation.receipt;
}

function makeSnapshot(
  revision: number,
  receipts: readonly unknown[],
): HoidEditorialReviewReceiptSnapshot {
  const result = validateHoidEditorialReviewReceiptSnapshot({
    schemaVersion: 1,
    revision,
    receipts,
  });
  if (result.status !== "valid") throw new Error("Snapshot de recibos inválido: " + result.reason);
  return result.snapshot;
}

function validRow(snapshot: HoidEditorialReviewReceiptSnapshot): FakeRow {
  return {
    schema_version: 1,
    revision: snapshot.revision,
    payload: JSON.stringify(snapshot),
  };
}

class FakeTransaction implements HoidEditorialReceiptSqliteTransaction {
  constructor(
    private readonly state: FakeState,
    private readonly writes: Array<{
      sql: string;
      params: readonly HoidEditorialReceiptSqliteValue[];
    }>,
  ) {}

  async execAsync(source: string): Promise<void> {
    if (!source.includes("CREATE TABLE IF NOT EXISTS hoid_editorial_review_receipts_v1")) {
      throw new Error("SQL de esquema inesperado");
    }
  }

  async getFirstAsync<T>(
    source: string,
    ..._params: HoidEditorialReceiptSqliteValue[]
  ): Promise<T | null> {
    if (!source.includes("FROM hoid_editorial_review_receipts_v1")) {
      throw new Error("SQL de lectura inesperado");
    }
    return (this.state.row ? { ...this.state.row } : null) as T | null;
  }

  async runAsync(
    source: string,
    ...params: HoidEditorialReceiptSqliteValue[]
  ): Promise<HoidEditorialReceiptSqliteRunResult> {
    this.writes.push({ sql: source, params: [...params] });
    if (source.includes("INSERT OR IGNORE INTO hoid_editorial_review_receipts_v1")) {
      if (this.state.row) return { changes: 0 };
      this.state.row = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_editorial_review_receipts_v1")) {
      const [schemaVersion, revision, payload, expectedRevision] = params;
      if (!this.state.row || this.state.row.revision !== expectedRevision) {
        return { changes: 0 };
      }
      this.state.row = {
        schema_version: Number(schemaVersion),
        revision: Number(revision),
        payload: String(payload),
      };
      return { changes: 1 };
    }

    throw new Error("SQL de escritura inesperado");
  }
}

class FakeSqliteDatabase implements HoidSqliteDatabasePort {
  private row: FakeRow | null = null;
  private transactionTail: Promise<void> = Promise.resolve();
  failNextTransaction: unknown = null;
  readonly writes: Array<{
    sql: string;
    params: readonly HoidEditorialReceiptSqliteValue[];
  }> = [];

  seed(row: FakeRow | null): void {
    this.row = row ? { ...row } : null;
  }

  inspect(): FakeRow | null {
    return this.row ? { ...this.row } : null;
  }

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(
    source: string,
    ..._params: HoidEditorialReceiptSqliteValue[]
  ): Promise<T | null> {
    if (!source.includes("FROM hoid_editorial_review_receipts_v1")) {
      throw new Error("Lectura fuera del contrato");
    }
    return (this.row ? { ...this.row } : null) as T | null;
  }

  async runAsync(
    _source: string,
    ..._params: HoidEditorialReceiptSqliteValue[]
  ): Promise<HoidEditorialReceiptSqliteRunResult> {
    throw new Error("Las escrituras deben usar una transacción exclusiva");
  }

  async withExclusiveTransactionAsync(
    task: (transaction: HoidEditorialReceiptSqliteTransaction) => Promise<void>,
  ): Promise<void> {
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>(resolve => { release = resolve; });
    await previous;

    const staged: FakeState = { row: this.row ? { ...this.row } : null };
    try {
      if (this.failNextTransaction !== null) {
        const failure = this.failNextTransaction;
        this.failNextTransaction = null;
        throw failure;
      }
      await task(new FakeTransaction(staged, this.writes));
      this.row = staged.row;
    } finally {
      release();
    }
  }
}

describe("Expo SQLite Hoid editorial review receipt store", () => {
  it("initializes a canonical empty snapshot without account identity", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    const validation = validateHoidEditorialReviewReceiptSnapshot(await store.read());

    expect(validation.status).toBe("valid");
    if (validation.status === "valid") {
      expect(validation.snapshot.revision).toBe(0);
      expect(validation.snapshot.receipts).toEqual([]);
    }
    expect(database.inspect()?.revision).toBe(0);
  });

  it("persists a validated receipt and reads it through a new store instance", async () => {
    const database = new FakeSqliteDatabase();
    const first = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await first.read();

    const next = makeSnapshot(1, [validReceipt()]);
    expect(await first.compareAndSwap(0, next)).toBe("saved");

    const second = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    const validation = validateHoidEditorialReviewReceiptSnapshot(await second.read());
    expect(validation.status).toBe("valid");
    if (validation.status === "valid") {
      expect(validation.snapshot.revision).toBe(1);
      expect(validation.snapshot.receipts).toHaveLength(1);
      expect(validation.snapshot.receipts[0].decision).toBe("approved");
    }
  });

  it("rejects stale writers without overwriting the latest receipt set", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await store.read();
    expect(await store.compareAndSwap(0, makeSnapshot(1, [validReceipt()]))).toBe("saved");

    expect(await store.compareAndSwap(0, makeSnapshot(1, []))).toBe("conflict");
    expect(database.inspect()?.payload).toContain('"decision":"approved"');
  });

  it("allows only one of two concurrent writers at the same revision", async () => {
    const database = new FakeSqliteDatabase();
    const first = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    const second = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await Promise.all([first.read(), second.read()]);

    const results = await Promise.all([
      first.compareAndSwap(0, makeSnapshot(1, [validReceipt()])),
      second.compareAndSwap(0, makeSnapshot(1, [])),
    ]);
    expect(results.filter(result => result === "saved")).toHaveLength(1);
    expect(results.filter(result => result === "conflict")).toHaveLength(1);
    expect(database.inspect()?.revision).toBe(1);
  });

  it("rejects orphaned, duplicate and mismatched receipts before writing", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await store.read();
    const receipt = validReceipt();

    expect(await store.compareAndSwap(0, {
      schemaVersion: 1,
      revision: 1,
      receipts: [{ ...receipt, packetId: "unknown-packet" }],
    })).toBe("unavailable");
    expect(await store.compareAndSwap(0, {
      schemaVersion: 1,
      revision: 1,
      receipts: [receipt, receipt],
    })).toBe("unavailable");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("rejects malformed snapshots and skipped revisions before writing", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await store.read();

    expect(await store.compareAndSwap(0, {
      schemaVersion: 1,
      revision: 2,
      receipts: [],
    })).toBe("unavailable");
    expect(await store.compareAndSwap(0, {
      schemaVersion: 2,
      revision: 1,
      receipts: [],
    } as unknown as HoidEditorialReviewReceiptSnapshot)).toBe("unavailable");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("does not turn corrupt persisted JSON into an empty snapshot", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 1, revision: 4, payload: "{not-json" });
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);

    const validation = validateHoidEditorialReviewReceiptSnapshot(await store.read());
    expect(validation.status).toBe("invalid");
    expect(database.inspect()?.payload).toBe("{not-json");
  });

  it("does not overwrite unsupported schema or SQL-envelope mismatches", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 99, revision: 0, payload: "{}" });
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    expect(validateHoidEditorialReviewReceiptSnapshot(await store.read()).status).toBe("invalid");
    expect(await store.compareAndSwap(0, makeSnapshot(1, []))).toBe("unavailable");
    expect(database.inspect()?.schema_version).toBe(99);

    database.seed({ schema_version: 1, revision: 7, payload: JSON.stringify(makeSnapshot(6, [])) });
    const second = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    expect(validateHoidEditorialReviewReceiptSnapshot(await second.read()).status).toBe("invalid");
    expect(database.inspect()?.revision).toBe(7);
  });

  it("maps SQLite lock contention to conflict and other failures to unavailable", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await store.read();
    database.failNextTransaction = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });
    expect(await store.compareAndSwap(0, makeSnapshot(1, []))).toBe("conflict");

    database.failNextTransaction = new Error("disk I/O failure");
    expect(await store.compareAndSwap(0, makeSnapshot(1, []))).toBe("unavailable");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("uses bound SQL parameters and writes only through the exclusive transaction", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await store.read();
    expect(await store.compareAndSwap(0, makeSnapshot(1, [validReceipt()]))).toBe("saved");

    const update = database.writes.find(write =>
      write.sql.includes("UPDATE hoid_editorial_review_receipts_v1"),
    );
    expect(update?.sql).toContain("WHERE id = 1 AND revision = ?");
    expect(update?.sql).not.toContain("local-editor-1");
    expect(update?.params[2]).toContain('"reviewerId":"local-editor-1"');
  });

  it("persists receipt metadata but never summary text, source text, locator or URI", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);
    await store.read();
    expect(await store.compareAndSwap(0, makeSnapshot(1, [validReceipt()]))).toBe("saved");

    const draft = HOID_EDITORIAL_DRAFTS.find(item => item.id === DRAFT_ID);
    if (!draft) throw new Error("Borrador editorial de prueba no disponible");
    const payload = database.inspect()?.payload ?? "";
    expect(payload).not.toContain(draft.summary);
    expect(payload).not.toContain(draft.evidenceSource.locatorId);
    expect(payload).not.toContain("<html");
    expect(payload).not.toContain("file://");
    expect(payload).not.toContain("content://");
    expect(payload).toContain(draft.summaryIntegrity.sha256);
    expect(payload).toContain(draft.sourceIntegrity.documentSha256);
  });

  it("permits a retry after the initial schema transaction fails", async () => {
    const database = new FakeSqliteDatabase();
    database.failNextTransaction = new Error("temporary schema failure");
    const store = new ExpoSqliteHoidEditorialReviewReceiptStore(database);

    expect(await store.compareAndSwap(0, makeSnapshot(1, []))).toBe("unavailable");
    expect(await store.compareAndSwap(0, makeSnapshot(1, []))).toBe("saved");
    expect(database.inspect()?.revision).toBe(1);
  });
});
