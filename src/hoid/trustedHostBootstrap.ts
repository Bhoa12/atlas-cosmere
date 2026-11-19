import type { HoidReviewerTrustRootKey } from "./editorialReviewSignatures";
import type { HoidTrustRegistryRevisionStorePort } from "./trustRegistryRevisionStore";
import { sha256Hex } from "./sha256";

export type HoidTrustedHostBootstrapConfiguration = Readonly<{
  schemaVersion: 1;
  configurationId: string;
  trustDomainId: string;
  rootKey: HoidReviewerTrustRootKey;
  minimumRegistryRevision: number;
  allowedRepositoryFullNames: readonly string[];
  provisionedAt: string;
  expiresAt: string;
}>;

export type HoidTrustedHostBootstrapPort = Readonly<{
  /** Read a root key and initial revision pinned out of band by the host. */
  readPinnedConfiguration(): Promise<unknown>;
}>;

export type HoidTrustedHostBootstrapValidation =
  | Readonly<{
      status: "valid";
      configuration: HoidTrustedHostBootstrapConfiguration;
      configurationFingerprint: string;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-configuration"
        | "invalid-configuration-id"
        | "invalid-trust-domain"
        | "invalid-root-key"
        | "invalid-minimum-revision"
        | "invalid-repository-scope"
        | "repository-not-authorized"
        | "invalid-provisioning-time"
        | "configuration-expired"
        | "configuration-lifetime-exceeded";
    }>;

export type HoidTrustedHostBootstrapLoadResult =
  | Readonly<{
      status: "ready";
      configuration: HoidTrustedHostBootstrapConfiguration;
      configurationFingerprint: string;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "bootstrap-port-unavailable"
        | "bootstrap-read-failed"
        | "bootstrap-not-provisioned"
        | "bootstrap-invalid";
      validationReason?: Extract<HoidTrustedHostBootstrapValidation, { status: "invalid" }>["reason"];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidTrustedHostRevisionStoreCheck =
  | Readonly<{
      status: "ready";
      trustDomainId: string;
      configuredMinimumRevision: number;
      persistedMinimumRevision: number;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-bootstrap"
        | "invalid-revision-store"
        | "revision-store-unavailable"
        | "revision-store-uninitialized"
        | "revision-store-invalid"
        | "revision-store-rollback";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/;
const TRUST_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DAY_MS = 86_400_000;
const MAX_CONFIGURATION_DAYS = 90;
const STORE_TIMEOUT_MS = 5_000;

function exactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length || keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) {
      return null;
    }
    const result = Object.create(null) as Record<string, unknown>;
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

function denseStrings(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum ||
        Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !REPOSITORY_PATTERN.test(descriptor.value)
      ) return null;
      result.push(descriptor.value);
    }
    for (let index = 1; index < result.length; index += 1) {
      if (result[index - 1] >= result[index]) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function isoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  try {
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

function canonicalRootKey(value: unknown): HoidReviewerTrustRootKey | null {
  const raw = exactRecord(value, ["keyId", "publicKeyHex"]);
  if (
    !raw ||
    typeof raw.keyId !== "string" ||
    !ID_PATTERN.test(raw.keyId) ||
    typeof raw.publicKeyHex !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.publicKeyHex)
  ) return null;
  return Object.freeze({ keyId: raw.keyId, publicKeyHex: raw.publicKeyHex });
}

export function validateHoidTrustedHostBootstrapConfiguration(
  value: unknown,
  expectedRepositoryFullName: string,
  nowInput: unknown,
): HoidTrustedHostBootstrapValidation {
  const raw = exactRecord(value, [
    "schemaVersion",
    "configurationId",
    "trustDomainId",
    "rootKey",
    "minimumRegistryRevision",
    "allowedRepositoryFullNames",
    "provisionedAt",
    "expiresAt",
  ]);
  if (!raw || raw.schemaVersion !== 1) return Object.freeze({ status: "invalid", reason: "invalid-configuration" });
  if (typeof raw.configurationId !== "string" || !ID_PATTERN.test(raw.configurationId)) {
    return Object.freeze({ status: "invalid", reason: "invalid-configuration-id" });
  }
  if (typeof raw.trustDomainId !== "string" || !TRUST_DOMAIN_PATTERN.test(raw.trustDomainId)) {
    return Object.freeze({ status: "invalid", reason: "invalid-trust-domain" });
  }
  const rootKey = canonicalRootKey(raw.rootKey);
  if (!rootKey) return Object.freeze({ status: "invalid", reason: "invalid-root-key" });
  if (!Number.isSafeInteger(raw.minimumRegistryRevision) || (raw.minimumRegistryRevision as number) < 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-minimum-revision" });
  }
  const repositories = denseStrings(raw.allowedRepositoryFullNames, 16);
  if (!repositories) return Object.freeze({ status: "invalid", reason: "invalid-repository-scope" });
  if (
    typeof expectedRepositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(expectedRepositoryFullName) ||
    !repositories.includes(expectedRepositoryFullName)
  ) return Object.freeze({ status: "invalid", reason: "repository-not-authorized" });
  if (!isoTimestamp(raw.provisionedAt) || !isoTimestamp(raw.expiresAt) || !isoTimestamp(nowInput)) {
    return Object.freeze({ status: "invalid", reason: "invalid-provisioning-time" });
  }
  const provisionedAt = Date.parse(raw.provisionedAt);
  const expiresAt = Date.parse(raw.expiresAt);
  const now = Date.parse(nowInput);
  if (provisionedAt > now || expiresAt <= now || expiresAt <= provisionedAt) {
    return Object.freeze({ status: "invalid", reason: "configuration-expired" });
  }
  if (expiresAt - provisionedAt > MAX_CONFIGURATION_DAYS * DAY_MS) {
    return Object.freeze({ status: "invalid", reason: "configuration-lifetime-exceeded" });
  }

  const configuration: HoidTrustedHostBootstrapConfiguration = Object.freeze({
    schemaVersion: 1,
    configurationId: raw.configurationId,
    trustDomainId: raw.trustDomainId,
    rootKey,
    minimumRegistryRevision: raw.minimumRegistryRevision as number,
    allowedRepositoryFullNames: repositories,
    provisionedAt: raw.provisionedAt,
    expiresAt: raw.expiresAt,
  });
  const configurationFingerprint = sha256Hex(JSON.stringify([
    "hoid-trusted-host-bootstrap-v1",
    configuration.schemaVersion,
    configuration.configurationId,
    configuration.trustDomainId,
    configuration.rootKey.keyId,
    configuration.rootKey.publicKeyHex,
    configuration.minimumRegistryRevision,
    configuration.allowedRepositoryFullNames,
    configuration.provisionedAt,
    configuration.expiresAt,
  ]));
  return Object.freeze({ status: "valid", configuration, configurationFingerprint });
}

function resolveReadPinnedConfiguration(value: unknown): (() => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "readPinnedConfiguration");
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as () => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadHoidTrustedHostBootstrap(
  portInput: unknown,
  expectedRepositoryFullName: string,
  nowInput: unknown,
): Promise<HoidTrustedHostBootstrapLoadResult> {
  const read = resolveReadPinnedConfiguration(portInput);
  if (!read) {
    return Object.freeze({
      status: "blocked",
      reason: "bootstrap-port-unavailable",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  let value: unknown;
  try {
    value = await read();
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "bootstrap-read-failed",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (value === null || value === undefined) {
    return Object.freeze({
      status: "blocked",
      reason: "bootstrap-not-provisioned",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const validation = validateHoidTrustedHostBootstrapConfiguration(
    value,
    expectedRepositoryFullName,
    nowInput,
  );
  if (validation.status !== "valid") {
    return Object.freeze({
      status: "blocked",
      reason: "bootstrap-invalid",
      validationReason: validation.reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  return Object.freeze({
    status: "ready",
    configuration: validation.configuration,
    configurationFingerprint: validation.configurationFingerprint,
  });
}

function resolveReadMinimumRevision(value: unknown): ((input: Readonly<{ trustDomainId: string }>) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "readMinimumRevision");
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (input: Readonly<{ trustDomainId: string }>) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifyHoidTrustedHostRevisionStore(
  configurationInput: unknown,
  storeInput: HoidTrustRegistryRevisionStorePort,
  expectedRepositoryFullName: string,
  nowInput: unknown,
): Promise<HoidTrustedHostRevisionStoreCheck> {
  const validation = validateHoidTrustedHostBootstrapConfiguration(
    configurationInput,
    expectedRepositoryFullName,
    nowInput,
  );
  if (validation.status !== "valid") return Object.freeze({
    status: "blocked",
    reason: "invalid-bootstrap",
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  const configuration = validation.configuration;
  const read = resolveReadMinimumRevision(storeInput);
  if (!read) return Object.freeze({
    status: "blocked",
    reason: "invalid-revision-store",
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => read(Object.freeze({ trustDomainId: configuration.trustDomainId as string }))),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("revision store timeout")), STORE_TIMEOUT_MS);
      }),
    ]);
    if (value === null || value === undefined) return Object.freeze({
      status: "blocked",
      reason: "revision-store-uninitialized",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    if (!Number.isSafeInteger(value) || (value as number) < 1) return Object.freeze({
      status: "blocked",
      reason: "revision-store-invalid",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    if ((value as number) < (configuration.minimumRegistryRevision as number)) return Object.freeze({
      status: "blocked",
      reason: "revision-store-rollback",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    return Object.freeze({
      status: "ready",
      trustDomainId: configuration.trustDomainId as string,
      configuredMinimumRevision: configuration.minimumRegistryRevision as number,
      persistedMinimumRevision: value as number,
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "revision-store-unavailable",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
