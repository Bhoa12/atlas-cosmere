import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import type { HoidNativeSecurityProviderTrustPort } from "./conversationSecurityAttestation";

export const HOID_NATIVE_PROVIDER_TRUST_REGISTRY_SCHEMA_VERSION = 1 as const;
export const HOID_NATIVE_PROVIDER_TRUST_REGISTRY_KIND =
  "hoid-native-provider-trust-registry" as const;

const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/u;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9.-]{2,63}$/u;
const APP_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]{2,127}$/u;
const PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;
const MAX_REGISTRY_LENGTH = 262_144;
const MAX_PROVIDER_KEYS = 128;
const MAX_REVISION_ATTEMPTS = 4;
const REGISTRY_DOMAIN_SEPARATOR = "hoid-native-provider-trust-registry-ed25519-v1";

type DataRecord = Record<string, unknown>;
type NativePlatform = "ios" | "android";
type ProviderKeyState = "active" | "revoked";

type ProviderKeyEntry = Readonly<{
  keyId: string;
  providerId: string;
  platform: NativePlatform;
  appIdentifier: string;
  publicKeyHex: string;
  state: ProviderKeyState;
}>;

type CanonicalRegistryPayload = Readonly<{
  schemaVersion: typeof HOID_NATIVE_PROVIDER_TRUST_REGISTRY_SCHEMA_VERSION;
  kind: typeof HOID_NATIVE_PROVIDER_TRUST_REGISTRY_KIND;
  trustDomainId: string;
  rootKeyId: string;
  revision: number;
  providerKeys: readonly ProviderKeyEntry[];
}>;

type CanonicalRegistry = CanonicalRegistryPayload & Readonly<{
  signatureHex: string;
}>;

export type HoidNativeSecurityTrustRegistryRootPin = Readonly<{
  trustDomainId: string;
  rootKeyId: string;
  appIdentifier: string;
  publicKeyHex: string;
  minimumRevision: number;
}>;

export type HoidNativeSecurityTrustRegistrySourcePort = Readonly<{
  /** Returns the complete canonical JSON registry as UTF-8 text. */
  readSignedRegistry(): Promise<unknown>;
}>;

export type HoidNativeSecurityTrustRegistryRevisionPort = Readonly<{
  /** Must return a durable, rollback-resistant revision for this trust domain. */
  readMinimumRevision(input: Readonly<{ trustDomainId: string }>): Promise<unknown>;
  /** Must be atomic, linearizable and durable; false means the expected revision lost the race. */
  compareAndSetMinimumRevision(input: Readonly<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>): Promise<unknown>;
}>;

export type HoidNativeSecurityTrustRegistryOptions = Readonly<{
  /** Root key and minimum revision are pinned by the application build, never read from the registry. */
  rootPin: HoidNativeSecurityTrustRegistryRootPin;
  source: HoidNativeSecurityTrustRegistrySourcePort;
  revisionStore: HoidNativeSecurityTrustRegistryRevisionPort;
}>;

const trustedPorts = new WeakSet<object>();
const signatureVerifier = createHoidNobleEd25519VerificationPort();

function exactRecord(value: unknown, allowedKeys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalRootPin(value: unknown): HoidNativeSecurityTrustRegistryRootPin | null {
  const record = exactRecord(value, [
    "trustDomainId",
    "rootKeyId",
    "appIdentifier",
    "publicKeyHex",
    "minimumRevision",
  ]);
  if (
    !record ||
    typeof record.trustDomainId !== "string" ||
    !DOMAIN_PATTERN.test(record.trustDomainId) ||
    typeof record.rootKeyId !== "string" ||
    !KEY_ID_PATTERN.test(record.rootKeyId) ||
    typeof record.appIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(record.appIdentifier) ||
    typeof record.publicKeyHex !== "string" ||
    !PUBLIC_KEY_PATTERN.test(record.publicKeyHex) ||
    typeof record.minimumRevision !== "number" ||
    !Number.isSafeInteger(record.minimumRevision) ||
    record.minimumRevision < 1
  ) return null;

  return Object.freeze({
    trustDomainId: record.trustDomainId,
    rootKeyId: record.rootKeyId,
    appIdentifier: record.appIdentifier,
    publicKeyHex: record.publicKeyHex,
    minimumRevision: record.minimumRevision,
  });
}

function canonicalProviderKey(value: unknown): ProviderKeyEntry | null {
  const record = exactRecord(value, [
    "keyId",
    "providerId",
    "platform",
    "appIdentifier",
    "publicKeyHex",
    "state",
  ]);
  if (
    !record ||
    typeof record.keyId !== "string" ||
    !KEY_ID_PATTERN.test(record.keyId) ||
    typeof record.providerId !== "string" ||
    !PROVIDER_ID_PATTERN.test(record.providerId) ||
    (record.platform !== "ios" && record.platform !== "android") ||
    typeof record.appIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(record.appIdentifier) ||
    typeof record.publicKeyHex !== "string" ||
    !PUBLIC_KEY_PATTERN.test(record.publicKeyHex) ||
    (record.state !== "active" && record.state !== "revoked")
  ) return null;

  return Object.freeze({
    keyId: record.keyId,
    providerId: record.providerId,
    platform: record.platform,
    appIdentifier: record.appIdentifier,
    publicKeyHex: record.publicKeyHex,
    state: record.state,
  });
}

function providerSortKey(entry: ProviderKeyEntry): string {
  return [
    entry.providerId,
    entry.platform,
    entry.appIdentifier,
    entry.keyId,
  ].join("\u0000");
}

function canonicalProviderKeys(value: unknown): readonly ProviderKeyEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PROVIDER_KEYS) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== value.length + 1 ||
      !ownKeys.includes("length") ||
      ownKeys.some(key =>
        key !== "length" &&
        (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) ||
          Number(key) >= value.length)
      )
    ) return null;

    const entries: ProviderKeyEntry[] = [];
    const keyIds = new Set<string>();
    let previousSortKey = "";
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const entry = canonicalProviderKey(descriptor.value);
      if (!entry || keyIds.has(entry.keyId)) return null;
      const sortKey = providerSortKey(entry);
      if (index > 0 && sortKey <= previousSortKey) return null;
      keyIds.add(entry.keyId);
      previousSortKey = sortKey;
      entries.push(entry);
    }
    return Object.freeze(entries);
  } catch {
    return null;
  }
}

function canonicalPayload(value: unknown): CanonicalRegistryPayload | null {
  const record = exactRecord(value, [
    "schemaVersion",
    "kind",
    "trustDomainId",
    "rootKeyId",
    "revision",
    "providerKeys",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_NATIVE_PROVIDER_TRUST_REGISTRY_SCHEMA_VERSION ||
    record.kind !== HOID_NATIVE_PROVIDER_TRUST_REGISTRY_KIND ||
    typeof record.trustDomainId !== "string" ||
    !DOMAIN_PATTERN.test(record.trustDomainId) ||
    typeof record.rootKeyId !== "string" ||
    !KEY_ID_PATTERN.test(record.rootKeyId) ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1
  ) return null;

  const providerKeys = canonicalProviderKeys(record.providerKeys);
  if (!providerKeys) return null;
  return Object.freeze({
    schemaVersion: HOID_NATIVE_PROVIDER_TRUST_REGISTRY_SCHEMA_VERSION,
    kind: HOID_NATIVE_PROVIDER_TRUST_REGISTRY_KIND,
    trustDomainId: record.trustDomainId,
    rootKeyId: record.rootKeyId,
    revision: record.revision,
    providerKeys,
  });
}

/**
 * Canonical root-signature message for registry publishers and conformance tests.
 * The private root signing key must remain outside the application repository.
 */
export function buildHoidNativeSecurityTrustRegistrySigningMessage(
  value: unknown,
): string | null {
  const payload = canonicalPayload(value);
  if (!payload) return null;
  return JSON.stringify([
    REGISTRY_DOMAIN_SEPARATOR,
    payload.schemaVersion,
    payload.kind,
    payload.trustDomainId,
    payload.rootKeyId,
    payload.revision,
    payload.providerKeys.map(entry => [
      entry.keyId,
      entry.providerId,
      entry.platform,
      entry.appIdentifier,
      entry.publicKeyHex,
      entry.state,
    ]),
  ]);
}

function parseCanonicalRegistry(value: unknown): CanonicalRegistry | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_REGISTRY_LENGTH
  ) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    const record = exactRecord(parsed, [
      "schemaVersion",
      "kind",
      "trustDomainId",
      "rootKeyId",
      "revision",
      "providerKeys",
      "signatureHex",
    ]);
    if (!record || typeof record.signatureHex !== "string" ||
      !SIGNATURE_PATTERN.test(record.signatureHex)) return null;

    const payload = canonicalPayload({
      schemaVersion: record.schemaVersion,
      kind: record.kind,
      trustDomainId: record.trustDomainId,
      rootKeyId: record.rootKeyId,
      revision: record.revision,
      providerKeys: record.providerKeys,
    });
    if (!payload) return null;

    const registry: CanonicalRegistry = Object.freeze({
      ...payload,
      signatureHex: record.signatureHex,
    });
    return JSON.stringify(registry) === value ? registry : null;
  } catch {
    return null;
  }
}

type AsyncMethod<T> = (input: T) => Promise<unknown>;

function resolveAsyncMethod<T>(
  value: unknown,
  methodName: string,
  expectedKeys: readonly string[],
): AsyncMethod<T> | null {
  const record = exactRecord(value, expectedKeys);
  if (!record || typeof record[methodName] !== "function") return null;
  const method = record[methodName] as AsyncMethod<T>;
  return (input: T) => method.call(value, input);
}

function resolveNoArgumentAsyncMethod(
  value: unknown,
  methodName: string,
  expectedKeys: readonly string[],
): (() => Promise<unknown>) | null {
  const record = exactRecord(value, expectedKeys);
  if (!record || typeof record[methodName] !== "function") return null;
  const method = record[methodName] as () => Promise<unknown>;
  return () => method.call(value);
}

type CanonicalDependencies = Readonly<{
  readSignedRegistry: () => Promise<unknown>;
  readMinimumRevision: AsyncMethod<{ trustDomainId: string }>;
  compareAndSetMinimumRevision: AsyncMethod<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>;
}>;

function canonicalDependencies(
  sourceInput: unknown,
  revisionStoreInput: unknown,
): CanonicalDependencies | null {
  const readSignedRegistry = resolveNoArgumentAsyncMethod(
    sourceInput,
    "readSignedRegistry",
    ["readSignedRegistry"],
  );
  const revisionKeys = ["readMinimumRevision", "compareAndSetMinimumRevision"];
  const readMinimumRevision = resolveAsyncMethod<{ trustDomainId: string }>(
    revisionStoreInput,
    "readMinimumRevision",
    revisionKeys,
  );
  const compareAndSetMinimumRevision = resolveAsyncMethod<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>(
    revisionStoreInput,
    "compareAndSetMinimumRevision",
    revisionKeys,
  );
  if (!readSignedRegistry || !readMinimumRevision || !compareAndSetMinimumRevision) return null;

  return Object.freeze({
    readSignedRegistry,
    readMinimumRevision,
    compareAndSetMinimumRevision,
  });
}

async function persistRegistryRevision(
  rootPin: HoidNativeSecurityTrustRegistryRootPin,
  registryRevision: number,
  dependencies: CanonicalDependencies,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_REVISION_ATTEMPTS; attempt += 1) {
    const current = await dependencies.readMinimumRevision({
      trustDomainId: rootPin.trustDomainId,
    });
    if (
      typeof current !== "number" ||
      !Number.isSafeInteger(current) ||
      current < rootPin.minimumRevision
    ) throw new Error("Trust registry revision floor is unavailable or invalid");

    if (registryRevision < current) {
      throw new Error("Trust registry rollback detected");
    }
    if (registryRevision === current) return;

    const updated = await dependencies.compareAndSetMinimumRevision({
      trustDomainId: rootPin.trustDomainId,
      expectedRevision: current,
      nextRevision: registryRevision,
    });
    if (typeof updated !== "boolean") {
      throw new Error("Trust registry revision store returned an invalid result");
    }
    // Re-read after every successful CAS. A true result is not trusted until
    // the durable floor reports the exact revision that was just advanced.
  }
  throw new Error("Trust registry revision could not be durably advanced");
}

async function readVerifiedRegistry(
  rootPin: HoidNativeSecurityTrustRegistryRootPin,
  dependencies: CanonicalDependencies,
): Promise<CanonicalRegistry> {
  const raw = await dependencies.readSignedRegistry();
  const registry = parseCanonicalRegistry(raw);
  if (
    !registry ||
    registry.trustDomainId !== rootPin.trustDomainId ||
    registry.rootKeyId !== rootPin.rootKeyId ||
    registry.revision < rootPin.minimumRevision
  ) throw new Error("Invalid or untrusted provider registry");

  const message = buildHoidNativeSecurityTrustRegistrySigningMessage({
    schemaVersion: registry.schemaVersion,
    kind: registry.kind,
    trustDomainId: registry.trustDomainId,
    rootKeyId: registry.rootKeyId,
    revision: registry.revision,
    providerKeys: registry.providerKeys,
  });
  if (!message) throw new Error("Invalid provider registry signing payload");

  const signatureValid = await signatureVerifier.verify({
    publicKeyHex: rootPin.publicKeyHex,
    message,
    signatureHex: registry.signatureHex,
  });
  if (signatureValid !== true) throw new Error("Provider registry root signature invalid");

  await persistRegistryRevision(rootPin, registry.revision, dependencies);
  return registry;
}

/**
 * Creates the only trust-port implementation accepted by the native attestation
 * verifier. The root pin is supplied out of band by the trusted application
 * build; registry updates are root-signed and constrained by a durable revision
 * floor. This factory does not itself provide a hardware-backed revision store.
 */
export function createHoidNativeSecurityProviderTrustRegistryPort(
  optionsInput: unknown,
): HoidNativeSecurityProviderTrustPort {
  const options = exactRecord(optionsInput, ["rootPin", "source", "revisionStore"]);
  if (!options) throw new TypeError("Invalid Hoid provider trust registry options");

  const rootPin = canonicalRootPin(options.rootPin);
  const dependencies = canonicalDependencies(options.source, options.revisionStore);
  if (!rootPin || !dependencies) {
    throw new TypeError("Hoid provider trust registry dependencies are invalid");
  }

  const port: HoidNativeSecurityProviderTrustPort = Object.freeze({
    async readPinnedProviderKey(
      providerId: string,
      platform: NativePlatform,
      keyId: string,
    ): Promise<unknown> {
      if (
        typeof providerId !== "string" ||
        !PROVIDER_ID_PATTERN.test(providerId) ||
        (platform !== "ios" && platform !== "android") ||
        typeof keyId !== "string" ||
        !KEY_ID_PATTERN.test(keyId)
      ) throw new TypeError("Invalid provider trust lookup");

      const registry = await readVerifiedRegistry(rootPin, dependencies);
      const entry = registry.providerKeys.find(candidate =>
        candidate.keyId === keyId &&
        candidate.providerId === providerId &&
        candidate.platform === platform &&
        candidate.appIdentifier === rootPin.appIdentifier
      );
      if (!entry || entry.state !== "active") return null;

      return Object.freeze({
        keyId: entry.keyId,
        providerId: entry.providerId,
        platform: entry.platform,
        appIdentifier: entry.appIdentifier,
        publicKeyHex: entry.publicKeyHex,
      });
    },
  });
  trustedPorts.add(port as object);
  return port;
}

/** Runtime identity check; a structurally identical caller-created object is not trusted. */
export function isHoidNativeSecurityProviderTrustRegistryPort(
  value: unknown,
): value is HoidNativeSecurityProviderTrustPort {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    trustedPorts.has(value);
}
