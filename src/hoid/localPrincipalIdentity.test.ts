import { describe, expect, it, vi } from "vitest";
import {
  getOrCreateHoidLocalPrincipalIdentity,
  HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
  HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
  HOID_LOCAL_PRINCIPAL_RANDOM_BYTES,
  isHoidLocalPrincipalId,
  type HoidLocalPrincipalIdentityRecord,
  type HoidLocalPrincipalIdentityStorePort,
  type HoidSecureRandomPort,
} from "./localPrincipalIdentity";

const expectedId = "hlp1_" + "01".repeat(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES);

class MemoryIdentityStore implements HoidLocalPrincipalIdentityStorePort {
  record: unknown | null = null;
  failRead = false;
  failCreate = false;
  createCalls = 0;

  async read(): Promise<unknown | null> {
    if (this.failRead) throw new Error("read failed");
    return this.record;
  }

  async createIfAbsent(record: HoidLocalPrincipalIdentityRecord): Promise<"created" | "exists"> {
    this.createCalls += 1;
    if (this.failCreate) throw new Error("write failed");
    if (this.record !== null) return "exists";
    this.record = Object.freeze({ ...record });
    return "created";
  }
}

function randomSource(bytes = new Uint8Array(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES).fill(1)): HoidSecureRandomPort {
  return Object.freeze({ randomBytes: vi.fn(async (length: number) => {
    expect(length).toBe(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES);
    return bytes;
  }) });
}

describe("Hoid local principal identity provisioning", () => {
  it("creates a stable-format opaque identity from injected random bytes", async () => {
    const store = new MemoryIdentityStore();
    const result = await getOrCreateHoidLocalPrincipalIdentity(store, randomSource());
    expect(result).toEqual({ status: "ready", principalId: expectedId, created: true });
    expect(store.record).toEqual({
      schemaVersion: HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
      kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
      principalId: expectedId,
    });
  });

  it("reuses an existing identity without requiring or invoking randomness", async () => {
    const store = new MemoryIdentityStore();
    store.record = Object.freeze({
      schemaVersion: 1,
      kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
      principalId: expectedId,
    });
    const source = randomSource();
    const result = await getOrCreateHoidLocalPrincipalIdentity(store, source);
    expect(result).toEqual({ status: "ready", principalId: expectedId, created: false });
    expect(source.randomBytes).not.toHaveBeenCalled();
  });

  it("converges concurrent first-run provisioning on the atomically stored winner", async () => {
    const store = new MemoryIdentityStore();
    const first = randomSource();
    const second = randomSource(new Uint8Array(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES).fill(2));
    const results = await Promise.all([
      getOrCreateHoidLocalPrincipalIdentity(store, first),
      getOrCreateHoidLocalPrincipalIdentity(store, second),
    ]);
    expect(results.every(result => result.status === "ready")).toBe(true);
    if (results[0].status !== "ready" || results[1].status !== "ready") return;
    expect(results[0].principalId).toBe(results[1].principalId);
    expect(store.createCalls).toBe(2);
  });

  it("returns invalid-record and never overwrites malformed persisted identity", async () => {
    const store = new MemoryIdentityStore();
    const malformed = Object.freeze({ principalId: "Carlos", schemaVersion: 1 });
    store.record = malformed;
    const result = await getOrCreateHoidLocalPrincipalIdentity(store, randomSource());
    expect(result).toEqual({ status: "invalid-record" });
    expect(store.record).toBe(malformed);
    expect(store.createCalls).toBe(0);
  });

  it("does not derive identity from a display name or email", async () => {
    expect(isHoidLocalPrincipalId("Carlos")).toBe(false);
    expect(isHoidLocalPrincipalId("carlos@example.com")).toBe(false);
    expect(isHoidLocalPrincipalId(expectedId)).toBe(true);
  });

  it("rejects a random source with accessor-backed methods without invoking getters", async () => {
    let invoked = false;
    const hostile = Object.defineProperty({}, "randomBytes", {
      enumerable: true,
      get: () => {
        invoked = true;
        return async () => new Uint8Array(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES).fill(1);
      },
    });
    const result = await getOrCreateHoidLocalPrincipalIdentity(new MemoryIdentityStore(), hostile);
    expect(result).toEqual({ status: "invalid-input", reason: "invalid-random-source" });
    expect(invoked).toBe(false);
  });

  it("rejects a random source that returns the wrong number of bytes", async () => {
    const result = await getOrCreateHoidLocalPrincipalIdentity(
      new MemoryIdentityStore(),
      randomSource(new Uint8Array(8).fill(1)),
    );
    expect(result).toEqual({ status: "invalid-random-output" });
  });

  it("rejects an all-zero random output as a broken entropy source", async () => {
    const result = await getOrCreateHoidLocalPrincipalIdentity(
      new MemoryIdentityStore(),
      randomSource(new Uint8Array(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES)),
    );
    expect(result).toEqual({ status: "invalid-random-output" });
  });

  it("returns unavailable when the store cannot be read", async () => {
    const store = new MemoryIdentityStore();
    store.failRead = true;
    expect(await getOrCreateHoidLocalPrincipalIdentity(store, randomSource()))
      .toEqual({ status: "unavailable" });
  });

  it("returns unavailable when atomic creation fails", async () => {
    const store = new MemoryIdentityStore();
    store.failCreate = true;
    expect(await getOrCreateHoidLocalPrincipalIdentity(store, randomSource()))
      .toEqual({ status: "unavailable" });
  });

  it("requires an exact store contract", async () => {
    expect(await getOrCreateHoidLocalPrincipalIdentity({}, randomSource()))
      .toEqual({ status: "invalid-input", reason: "invalid-store" });
  });

  it("requires an exact secure-random contract only when provisioning is needed", async () => {
    const store = new MemoryIdentityStore();
    expect(await getOrCreateHoidLocalPrincipalIdentity(store, {}))
      .toEqual({ status: "invalid-input", reason: "invalid-random-source" });
  });

  it("rejects an identity row that changes between create and verification", async () => {
    const store = new MemoryIdentityStore();
    store.createIfAbsent = async () => {
      store.record = Object.freeze({
        schemaVersion: 1,
        kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
        principalId: "hlp1_" + "ff".repeat(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES),
      });
      return "created";
    };
    const result = await getOrCreateHoidLocalPrincipalIdentity(store, randomSource());
    expect(result).toEqual({
      status: "ready",
      principalId: "hlp1_" + "ff".repeat(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES),
      created: false,
    });
  });
});
