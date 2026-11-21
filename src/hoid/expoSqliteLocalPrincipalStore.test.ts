import { describe, expect, it } from "vitest";
import {
  HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
  HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
  type HoidLocalPrincipalIdentityRecord,
} from "./localPrincipalIdentity";
import {
  createExpoSqliteHoidLocalPrincipalStore,
  HOID_SQLITE_LOCAL_PRINCIPAL_TABLE,
} from "./expoSqliteLocalPrincipalStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type IdentityRow = Readonly<{ schema_version: number; principal_id: string }>;

class MemoryTransaction implements HoidSqliteTransactionPort {
  constructor(private readonly state: { row: IdentityRow | null }) {}
  async execAsync(_source: string): Promise<void> {}
  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (!source.includes(HOID_SQLITE_LOCAL_PRINCIPAL_TABLE)) throw new Error("Unexpected SELECT");
    return this.state.row as T | null;
  }
  async runAsync(source: string, ...params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult> {
    if (!source.includes("INSERT OR IGNORE INTO " + HOID_SQLITE_LOCAL_PRINCIPAL_TABLE)) {
      throw new Error("Unexpected SQL write");
    }
    if (this.state.row) return { changes: 0 };
    this.state.row = Object.freeze({
      schema_version: Number(params[0]),
      principal_id: String(params[1]),
    });
    return { changes: 1 };
  }
}

class MemoryDatabase implements HoidSqliteDatabasePort {
  state: { row: IdentityRow | null } = { row: null };
  failNextInitialization = false;
  private queue: Promise<void> = Promise.resolve();

  async execAsync(_source: string): Promise<void> {}
  async getFirstAsync<T>(source: string): Promise<T | null> {
    return new MemoryTransaction(this.state).getFirstAsync<T>(source);
  }
  async runAsync(source: string, ...params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult> {
    return new MemoryTransaction(this.state).runAsync(source, ...params);
  }
  withExclusiveTransactionAsync(
    task: (transaction: HoidSqliteTransactionPort) => Promise<void>,
  ): Promise<void> {
    const operation = this.queue.then(async () => {
      if (this.failNextInitialization) {
        this.failNextInitialization = false;
        throw new Error("temporary transaction failure");
      }
      const draft = { row: this.state.row };
      await task(new MemoryTransaction(draft));
      this.state = draft;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

const candidate: HoidLocalPrincipalIdentityRecord = Object.freeze({
  schemaVersion: HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
  kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
  principalId: "hlp1_" + "ab".repeat(24),
});

describe("Expo SQLite Hoid local principal store", () => {
  it("creates the identity table and returns null when no identity exists", async () => {
    const database = new MemoryDatabase();
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await expect(store.read()).resolves.toBeNull();
  });

  it("atomically creates the singleton identity", async () => {
    const database = new MemoryDatabase();
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await expect(store.createIfAbsent(candidate)).resolves.toBe("created");
    await expect(store.read()).resolves.toEqual(candidate);
  });

  it("does not replace an existing identity", async () => {
    const database = new MemoryDatabase();
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await store.createIfAbsent(candidate);
    const other = Object.freeze({ ...candidate, principalId: "hlp1_" + "cd".repeat(24) });
    await expect(store.createIfAbsent(other)).resolves.toBe("exists");
    await expect(store.read()).resolves.toEqual(candidate);
  });

  it("serializes concurrent create-if-absent operations", async () => {
    const database = new MemoryDatabase();
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    const other = Object.freeze({ ...candidate, principalId: "hlp1_" + "cd".repeat(24) });
    const results = await Promise.all([
      store.createIfAbsent(candidate),
      store.createIfAbsent(other),
    ]);
    expect(results.filter(result => result === "created")).toHaveLength(1);
    expect(results.filter(result => result === "exists")).toHaveLength(1);
  });

  it("returns a fail-closed marker for a malformed persisted row", async () => {
    const database = new MemoryDatabase();
    database.state.row = Object.freeze({ schema_version: 1, principal_id: "display-name" });
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await expect(store.read()).resolves.toEqual({ invalidIdentityRecord: true });
  });

  it("retries table initialization after a transient failure", async () => {
    const database = new MemoryDatabase();
    database.failNextInitialization = true;
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await expect(store.read()).rejects.toThrow("temporary transaction failure");
    await expect(store.read()).resolves.toBeNull();
  });

  it("rejects malformed candidate records before issuing a write", async () => {
    const database = new MemoryDatabase();
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await expect(store.createIfAbsent({
      ...candidate,
      principalId: "visible-name",
    } as HoidLocalPrincipalIdentityRecord)).rejects.toThrow(TypeError);
    expect(database.state.row).toBeNull();
  });

  it("keeps identity reads isolated from conversation-history rows", async () => {
    const database = new MemoryDatabase();
    const store = createExpoSqliteHoidLocalPrincipalStore(database);
    await store.createIfAbsent(candidate);
    expect(database.state.row?.principal_id).toBe(candidate.principalId);
    expect(HOID_SQLITE_LOCAL_PRINCIPAL_TABLE).toBe("hoid_local_principal_identity_v1");
  });
});
