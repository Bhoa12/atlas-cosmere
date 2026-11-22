import { describe, expect, it } from "vitest";
import {
  buildHoidNativeSecurityTrustRegistrySigningMessage,
  createHoidNativeSecurityProviderTrustRegistryPort,
  isHoidNativeSecurityProviderTrustRegistryPort,
  type HoidNativeSecurityTrustRegistryRevisionPort,
  type HoidNativeSecurityTrustRegistrySourcePort,
} from "./conversationProviderTrustRegistry";
import {
  createSignedHoidTestTrustRegistry,
  HOID_TEST_TRUST_ROOT_PIN,
  type TestProviderTrustEntry,
} from "./conversationProviderTrustRegistry.testFixtures";

const ACTIVE_ENTRY: TestProviderTrustEntry = Object.freeze({
  keyId: "atlas-provider-signing-2026",
  providerId: "atlas.hoid.native",
  platform: "ios",
  appIdentifier: HOID_TEST_TRUST_ROOT_PIN.appIdentifier,
  publicKeyHex: "11".repeat(32),
  state: "active",
});

function harness(options: {
  entries?: readonly TestProviderTrustEntry[];
  revision?: number;
  initialMinimumRevision?: number | null;
  registry?: string;
  sourceThrows?: boolean;
  readThrows?: boolean;
  writeThrows?: boolean;
  casConflictOnce?: boolean;
} = {}) {
  let registry = options.registry ?? createSignedHoidTestTrustRegistry(
    options.entries ?? [ACTIVE_ENTRY],
    options.revision ?? 1,
  );
  let minimumRevision = options.initialMinimumRevision === undefined
    ? 1
    : options.initialMinimumRevision;
  let readCalls = 0;
  let writeCalls = 0;
  let conflictOnce = options.casConflictOnce === true;

  const source: HoidNativeSecurityTrustRegistrySourcePort = Object.freeze({
    readSignedRegistry: async () => {
      if (options.sourceThrows) throw new Error("source unavailable");
      return registry;
    },
  });
  const revisionStore: HoidNativeSecurityTrustRegistryRevisionPort = Object.freeze({
    readMinimumRevision: async ({ trustDomainId }) => {
      readCalls += 1;
      if (options.readThrows) throw new Error("revision witness unavailable");
      if (trustDomainId !== HOID_TEST_TRUST_ROOT_PIN.trustDomainId) {
        throw new Error("trust domain mismatch");
      }
      return minimumRevision;
    },
    compareAndSetMinimumRevision: async ({ trustDomainId, expectedRevision, nextRevision }) => {
      writeCalls += 1;
      if (options.writeThrows) throw new Error("revision witness unavailable");
      if (trustDomainId !== HOID_TEST_TRUST_ROOT_PIN.trustDomainId) return false;
      if (conflictOnce) {
        conflictOnce = false;
        minimumRevision = nextRevision;
        return false;
      }
      if (minimumRevision !== expectedRevision || nextRevision <= minimumRevision) return false;
      minimumRevision = nextRevision;
      return true;
    },
  });

  const port = createHoidNativeSecurityProviderTrustRegistryPort({
    rootPin: HOID_TEST_TRUST_ROOT_PIN,
    source,
    revisionStore,
  });

  return {
    port,
    setRegistry(value: string) { registry = value; },
    minimumRevision: () => minimumRevision,
    readCalls: () => readCalls,
    writeCalls: () => writeCalls,
  };
}

describe("Hoid native provider trust registry", () => {
  it("creates a runtime-recognized port and resolves only a root-signed active key", async () => {
    const test = harness();
    expect(isHoidNativeSecurityProviderTrustRegistryPort(test.port)).toBe(true);
    const result = await test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    );
    expect(result).toEqual({
      keyId: ACTIVE_ENTRY.keyId,
      providerId: ACTIVE_ENTRY.providerId,
      platform: ACTIVE_ENTRY.platform,
      appIdentifier: ACTIVE_ENTRY.appIdentifier,
      publicKeyHex: ACTIVE_ENTRY.publicKeyHex,
    });
  });

  it("rejects a structurally identical caller-created trust port", () => {
    expect(isHoidNativeSecurityProviderTrustRegistryPort(Object.freeze({
      readPinnedProviderKey: async () => ACTIVE_ENTRY,
    }))).toBe(false);
  });

  it("returns no key for an unknown key identifier", async () => {
    const test = harness();
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      "unknown-provider-key",
    )).resolves.toBeNull();
  });

  it("does not return a revoked provider key", async () => {
    const test = harness({
      entries: [{ ...ACTIVE_ENTRY, state: "revoked" }],
    });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).resolves.toBeNull();
  });

  it("does not return a key scoped to another application", async () => {
    const test = harness({
      entries: [{ ...ACTIVE_ENTRY, appIdentifier: "com.example.other" }],
    });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).resolves.toBeNull();
  });

  it("does not return a key scoped to another platform", async () => {
    const test = harness({
      entries: [{ ...ACTIVE_ENTRY, platform: "android" }],
    });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      "ios",
      ACTIVE_ENTRY.keyId,
    )).resolves.toBeNull();
  });

  it("rejects a registry whose root signature has been modified", async () => {
    const signed = createSignedHoidTestTrustRegistry([ACTIVE_ENTRY]);
    const parsed = JSON.parse(signed) as Record<string, unknown>;
    parsed.signatureHex = "00".repeat(64);
    const test = harness({ registry: JSON.stringify(parsed) });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("rejects a registry from another trust domain", async () => {
    const signed = createSignedHoidTestTrustRegistry([ACTIVE_ENTRY]);
    const parsed = JSON.parse(signed) as Record<string, unknown>;
    parsed.trustDomainId = "another.domain";
    const test = harness({ registry: JSON.stringify(parsed) });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("rejects a registry signed under a different root key identifier", async () => {
    const signed = createSignedHoidTestTrustRegistry([ACTIVE_ENTRY]);
    const parsed = JSON.parse(signed) as Record<string, unknown>;
    parsed.rootKeyId = "another-root";
    const test = harness({ registry: JSON.stringify(parsed) });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("rejects whitespace and alternate JSON representations", async () => {
    const signed = createSignedHoidTestTrustRegistry([ACTIVE_ENTRY]);
    const test = harness({ registry: " " + signed });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("rejects duplicate JSON properties before signature verification", async () => {
    const test = harness({
      registry: "{\"schemaVersion\":1,\"schemaVersion\":1}",
    });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("rejects duplicate provider key identifiers", () => {
    const message = buildHoidNativeSecurityTrustRegistrySigningMessage({
      schemaVersion: 1,
      kind: "hoid-native-provider-trust-registry",
      trustDomainId: HOID_TEST_TRUST_ROOT_PIN.trustDomainId,
      rootKeyId: HOID_TEST_TRUST_ROOT_PIN.rootKeyId,
      revision: 1,
      providerKeys: [
        ACTIVE_ENTRY,
        { ...ACTIVE_ENTRY, providerId: "atlas.hoid.other" },
      ],
    });
    expect(message).toBeNull();
  });

  it("rejects unsorted provider key entries", () => {
    const second: TestProviderTrustEntry = {
      ...ACTIVE_ENTRY,
      keyId: "atlas-provider-signing-2027",
      providerId: "atlas.hoid.zed",
      publicKeyHex: "22".repeat(32),
    };
    const message = buildHoidNativeSecurityTrustRegistrySigningMessage({
      schemaVersion: 1,
      kind: "hoid-native-provider-trust-registry",
      trustDomainId: HOID_TEST_TRUST_ROOT_PIN.trustDomainId,
      rootKeyId: HOID_TEST_TRUST_ROOT_PIN.rootKeyId,
      revision: 1,
      providerKeys: [second, ACTIVE_ENTRY],
    });
    expect(message).toBeNull();
  });

  it("rejects a registry below the durable minimum revision", async () => {
    const test = harness({ revision: 1, initialMinimumRevision: 2 });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow(/rollback/u);
  });

  it("advances and re-reads the durable revision floor for a newer signed registry", async () => {
    const test = harness({ revision: 2, initialMinimumRevision: 1 });
    const result = await test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    );
    expect(result).not.toBeNull();
    expect(test.minimumRevision()).toBe(2);
    expect(test.writeCalls()).toBe(1);
    expect(test.readCalls()).toBe(2);
  });

  it("re-reads the floor after a concurrent CAS winner", async () => {
    const test = harness({
      revision: 2,
      initialMinimumRevision: 1,
      casConflictOnce: true,
    });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).resolves.not.toBeNull();
    expect(test.minimumRevision()).toBe(2);
    expect(test.readCalls()).toBe(2);
  });

  it("fails closed when the revision floor is uninitialized", async () => {
    const test = harness({ initialMinimumRevision: null });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("fails closed when the revision witness is unavailable", async () => {
    const test = harness({ readThrows: true });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("fails closed when the revision floor cannot be advanced durably", async () => {
    const test = harness({
      revision: 2,
      initialMinimumRevision: 1,
      writeThrows: true,
    });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("fails closed when the registry source is unavailable", async () => {
    const test = harness({ sourceThrows: true });
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("re-reads and honors a newly published revocation instead of caching old keys", async () => {
    const test = harness();
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).resolves.not.toBeNull();
    test.setRegistry(createSignedHoidTestTrustRegistry(
      [{ ...ACTIVE_ENTRY, state: "revoked" }],
      2,
    ));
    await expect(test.port.readPinnedProviderKey(
      ACTIVE_ENTRY.providerId,
      ACTIVE_ENTRY.platform,
      ACTIVE_ENTRY.keyId,
    )).resolves.toBeNull();
    expect(test.minimumRevision()).toBe(2);
  });

  it("rejects invalid provider lookup arguments", async () => {
    const test = harness();
    await expect(test.port.readPinnedProviderKey(
      "../provider",
      "ios",
      ACTIVE_ENTRY.keyId,
    )).rejects.toThrow();
  });

  it("rejects source and revision ports with extra or accessor properties", () => {
    const source = Object.freeze({
      readSignedRegistry: async () => createSignedHoidTestTrustRegistry([ACTIVE_ENTRY]),
      unexpected: true,
    });
    const revisionStore = Object.freeze({
      readMinimumRevision: async () => 1,
      compareAndSetMinimumRevision: async () => true,
    });
    expect(() => createHoidNativeSecurityProviderTrustRegistryPort({
      rootPin: HOID_TEST_TRUST_ROOT_PIN,
      source,
      revisionStore,
    })).toThrow();
  });
});
