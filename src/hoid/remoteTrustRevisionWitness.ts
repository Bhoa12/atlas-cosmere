import type { HoidEd25519VerificationPort } from "./editorialReviewSignatures";
import type { HoidTrustRegistryRevisionStorePort } from "./trustRegistryRevisionStore";

export type HoidTrustRevisionWitnessConfiguration = Readonly<{
  witnessId: string;
  keyId: string;
  publicKeyHex: string;
  trustDomainId: string;
}>;

export type HoidTrustRevisionWitnessReadRequest = Readonly<{
  schemaVersion: 1;
  operation: "read-minimum-revision";
  witnessId: string;
  trustDomainId: string;
  requestNonceHex: string;
}>;

export type HoidTrustRevisionWitnessCompareAndSetRequest = Readonly<{
  schemaVersion: 1;
  operation: "compare-and-set-minimum-revision";
  witnessId: string;
  trustDomainId: string;
  expectedRevision: number;
  nextRevision: number;
  requestNonceHex: string;
}>;

export type HoidTrustRevisionWitnessTransportPort = Readonly<{
  readMinimumRevision(request: HoidTrustRevisionWitnessReadRequest): Promise<unknown>;
  compareAndSetMinimumRevision(
    request: HoidTrustRevisionWitnessCompareAndSetRequest,
  ): Promise<unknown>;
}>;

export type HoidTrustRevisionWitnessNoncePort = Readonly<{
  /** Must use an operating-system CSPRNG; Math.random is not acceptable. */
  createNonceHex(): Promise<unknown>;
}>;

export type HoidTrustRevisionWitnessClockPort = Readonly<{
  now(): string;
}>;

export type HoidTrustRevisionWitnessReceiptUnsigned = Readonly<{
  schemaVersion: 1;
  witnessId: string;
  keyId: string;
  trustDomainId: string;
  operation: "read-minimum-revision" | "compare-and-set-minimum-revision";
  requestNonceHex: string;
  expectedRevision: number | null;
  nextRevision: number | null;
  outcome: "read" | "advanced" | "already-applied" | "conflict";
  observedRevision: number;
  issuedAt: string;
  expiresAt: string;
}>;

export type HoidTrustRevisionWitnessReceipt = HoidTrustRevisionWitnessReceiptUnsigned & Readonly<{
  signatureHex: string;
}>;

export type HoidRemoteTrustRevisionWitnessOptions = Readonly<{
  configuration: HoidTrustRevisionWitnessConfiguration;
  transport: HoidTrustRevisionWitnessTransportPort;
  noncePort: HoidTrustRevisionWitnessNoncePort;
  clock: HoidTrustRevisionWitnessClockPort;
  verifier: HoidEd25519VerificationPort;
}>;

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const HEX_32_PATTERN = /^[a-f0-9]{64}$/;
const HEX_64_PATTERN = /^[a-f0-9]{128}$/;
const MAX_RECEIPT_LIFETIME_MS = 60_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const MAX_NONCES_PER_ADAPTER = 4_096;
const RECEIPT_DOMAIN = "hoid-trust-revision-witness-receipt-ed25519-v1";

function exactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;
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

function resolveMethod<T>(
  value: unknown,
  name: string,
): ((input: T) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (input: T) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveNoArgumentMethod(value: unknown, name: string): (() => unknown) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as () => unknown).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
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

function canonicalConfiguration(value: unknown): HoidTrustRevisionWitnessConfiguration | null {
  const raw = exactRecord(value, ["witnessId", "keyId", "publicKeyHex", "trustDomainId"]);
  if (
    !raw ||
    typeof raw.witnessId !== "string" ||
    !ID_PATTERN.test(raw.witnessId) ||
    typeof raw.keyId !== "string" ||
    !ID_PATTERN.test(raw.keyId) ||
    typeof raw.publicKeyHex !== "string" ||
    !HEX_32_PATTERN.test(raw.publicKeyHex) ||
    typeof raw.trustDomainId !== "string" ||
    !ID_PATTERN.test(raw.trustDomainId)
  ) return null;
  return Object.freeze({
    witnessId: raw.witnessId,
    keyId: raw.keyId,
    publicKeyHex: raw.publicKeyHex,
    trustDomainId: raw.trustDomainId,
  });
}

const RECEIPT_UNSIGNED_KEYS = [
  "schemaVersion",
  "witnessId",
  "keyId",
  "trustDomainId",
  "operation",
  "requestNonceHex",
  "expectedRevision",
  "nextRevision",
  "outcome",
  "observedRevision",
  "issuedAt",
  "expiresAt",
] as const;

/**
 * Canonical message signed by the remote monotonic witness. The witness
 * service must sign this exact JSON array, including the fresh request nonce.
 */
export function buildHoidTrustRevisionWitnessReceiptSigningMessage(
  value: unknown,
): string | null {
  const raw = exactRecord(value, RECEIPT_UNSIGNED_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.witnessId !== "string" ||
    !ID_PATTERN.test(raw.witnessId) ||
    typeof raw.keyId !== "string" ||
    !ID_PATTERN.test(raw.keyId) ||
    typeof raw.trustDomainId !== "string" ||
    !ID_PATTERN.test(raw.trustDomainId) ||
    (raw.operation !== "read-minimum-revision" &&
      raw.operation !== "compare-and-set-minimum-revision") ||
    typeof raw.requestNonceHex !== "string" ||
    !HEX_32_PATTERN.test(raw.requestNonceHex) ||
    (raw.expectedRevision !== null &&
      (!Number.isSafeInteger(raw.expectedRevision) || (raw.expectedRevision as number) < 1)) ||
    (raw.nextRevision !== null &&
      (!Number.isSafeInteger(raw.nextRevision) || (raw.nextRevision as number) < 1)) ||
    !["read", "advanced", "already-applied", "conflict"].includes(String(raw.outcome)) ||
    !Number.isSafeInteger(raw.observedRevision) ||
    (raw.observedRevision as number) < 1 ||
    !isoTimestamp(raw.issuedAt) ||
    !isoTimestamp(raw.expiresAt)
  ) return null;

  if (raw.operation === "read-minimum-revision") {
    if (
      raw.expectedRevision !== null ||
      raw.nextRevision !== null ||
      raw.outcome !== "read"
    ) return null;
  } else if (
    !Number.isSafeInteger(raw.expectedRevision) ||
    !Number.isSafeInteger(raw.nextRevision) ||
    (raw.nextRevision as number) <= (raw.expectedRevision as number) ||
    raw.outcome === "read"
  ) {
    return null;
  }

  return JSON.stringify([
    RECEIPT_DOMAIN,
    raw.schemaVersion,
    raw.witnessId,
    raw.keyId,
    raw.trustDomainId,
    raw.operation,
    raw.requestNonceHex,
    raw.expectedRevision,
    raw.nextRevision,
    raw.outcome,
    raw.observedRevision,
    raw.issuedAt,
    raw.expiresAt,
  ]);
}

function receiptUnsigned(value: Record<string, unknown>): HoidTrustRevisionWitnessReceiptUnsigned {
  return Object.freeze({
    schemaVersion: 1,
    witnessId: value.witnessId as string,
    keyId: value.keyId as string,
    trustDomainId: value.trustDomainId as string,
    operation: value.operation as HoidTrustRevisionWitnessReceiptUnsigned["operation"],
    requestNonceHex: value.requestNonceHex as string,
    expectedRevision: value.expectedRevision as number | null,
    nextRevision: value.nextRevision as number | null,
    outcome: value.outcome as HoidTrustRevisionWitnessReceiptUnsigned["outcome"],
    observedRevision: value.observedRevision as number,
    issuedAt: value.issuedAt as string,
    expiresAt: value.expiresAt as string,
  });
}

function verifyReceipt(
  value: unknown,
  expected: Readonly<{
    operation: HoidTrustRevisionWitnessReceiptUnsigned["operation"];
    requestNonceHex: string;
    expectedRevision: number | null;
    nextRevision: number | null;
  }>,
  configuration: HoidTrustRevisionWitnessConfiguration,
  now: string,
  verify: (input: { publicKeyHex: string; message: string; signatureHex: string }) => Promise<boolean>,
): HoidTrustRevisionWitnessReceiptUnsigned {
  const raw = exactRecord(value, [...RECEIPT_UNSIGNED_KEYS, "signatureHex"]);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.witnessId !== configuration.witnessId ||
    raw.keyId !== configuration.keyId ||
    raw.trustDomainId !== configuration.trustDomainId ||
    raw.operation !== expected.operation ||
    raw.requestNonceHex !== expected.requestNonceHex ||
    raw.expectedRevision !== expected.expectedRevision ||
    raw.nextRevision !== expected.nextRevision ||
    typeof raw.signatureHex !== "string" ||
    !HEX_64_PATTERN.test(raw.signatureHex)
  ) throw new Error("Invalid trust revision witness receipt");

  const unsigned = receiptUnsigned(raw);
  const message = buildHoidTrustRevisionWitnessReceiptSigningMessage(unsigned);
  if (!message) throw new Error("Non-canonical trust revision witness receipt");

  const issuedAt = Date.parse(unsigned.issuedAt);
  const expiresAt = Date.parse(unsigned.expiresAt);
  const nowMs = Date.parse(now);
  if (
    !isoTimestamp(now) ||
    issuedAt > nowMs + MAX_CLOCK_SKEW_MS ||
    expiresAt <= nowMs ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_RECEIPT_LIFETIME_MS
  ) throw new Error("Expired or invalid trust revision witness receipt");

  const valid = verify({
    publicKeyHex: configuration.publicKeyHex,
    message,
    signatureHex: raw.signatureHex,
  });
  // The verifier is asynchronous; the caller awaits this promise below.
  if (valid instanceof Promise) {
    throw new Error("Internal asynchronous receipt verification misuse");
  }
  return unsigned;
}

/**
 * Creates a provider-neutral revision store backed by an independently
 * authenticated remote monotonic witness. The host must pin the witness key
 * out of band and provide an authenticated transport plus an OS-CSPRNG nonce
 * source. The witness service itself must guarantee durable, linearizable CAS.
 */
export function createHoidRemoteTrustRegistryRevisionStorePort(
  optionsInput: HoidRemoteTrustRevisionWitnessOptions,
): HoidTrustRegistryRevisionStorePort {
  const options = exactRecord(optionsInput, [
    "configuration",
    "transport",
    "noncePort",
    "clock",
    "verifier",
  ]);
  if (!options) throw new Error("Invalid remote trust witness options");

  const configuration = canonicalConfiguration(options.configuration);
  if (!configuration) throw new Error("Invalid pinned trust witness configuration");

  const readTransport = resolveMethod<HoidTrustRevisionWitnessReadRequest>(
    options.transport,
    "readMinimumRevision",
  );
  const compareTransport = resolveMethod<HoidTrustRevisionWitnessCompareAndSetRequest>(
    options.transport,
    "compareAndSetMinimumRevision",
  );
  const createNonce = resolveNoArgumentMethod(options.noncePort, "createNonceHex");
  const readClock = resolveNoArgumentMethod(options.clock, "now");
  const verify = resolveMethod<{
    publicKeyHex: string;
    message: string;
    signatureHex: string;
  }>(options.verifier, "verify");
  if (!readTransport || !compareTransport || !createNonce || !readClock || !verify) {
    throw new Error("Remote trust witness adapter dependency unavailable");
  }

  const usedNonces = new Set<string>();

  async function nextNonce(): Promise<string> {
    const value = await createNonce();
    if (typeof value !== "string" || !HEX_32_PATTERN.test(value) || usedNonces.has(value)) {
      throw new Error("Invalid or reused trust witness nonce");
    }
    if (usedNonces.size >= MAX_NONCES_PER_ADAPTER) {
      throw new Error("Trust witness nonce budget exhausted");
    }
    usedNonces.add(value);
    return value;
  }

  function currentTime(): string {
    const value = readClock();
    if (!isoTimestamp(value)) throw new Error("Invalid trust witness clock");
    return value;
  }

  async function verifiedReceipt(
    value: unknown,
    expected: Parameters<typeof verifyReceipt>[1],
    now: string,
  ): Promise<HoidTrustRevisionWitnessReceiptUnsigned> {
    const raw = exactRecord(value, [...RECEIPT_UNSIGNED_KEYS, "signatureHex"]);
    if (!raw) throw new Error("Invalid trust revision witness receipt");
    const unsigned = receiptUnsigned(raw);
    const message = buildHoidTrustRevisionWitnessReceiptSigningMessage(unsigned);
    if (
      !message ||
      raw.witnessId !== configuration.witnessId ||
      raw.keyId !== configuration.keyId ||
      raw.trustDomainId !== configuration.trustDomainId ||
      raw.operation !== expected.operation ||
      raw.requestNonceHex !== expected.requestNonceHex ||
      raw.expectedRevision !== expected.expectedRevision ||
      raw.nextRevision !== expected.nextRevision ||
      typeof raw.signatureHex !== "string" ||
      !HEX_64_PATTERN.test(raw.signatureHex)
    ) throw new Error("Trust revision witness receipt does not match request");

    const issuedAt = Date.parse(unsigned.issuedAt);
    const expiresAt = Date.parse(unsigned.expiresAt);
    const nowMs = Date.parse(now);
    if (
      issuedAt > nowMs + MAX_CLOCK_SKEW_MS ||
      expiresAt <= nowMs ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > MAX_RECEIPT_LIFETIME_MS
    ) throw new Error("Trust revision witness receipt is expired");

    let valid = false;
    try {
      valid = await verify({
        publicKeyHex: configuration.publicKeyHex,
        message,
        signatureHex: raw.signatureHex,
      }) as unknown as boolean;
    } catch {
      valid = false;
    }
    if (valid !== true) throw new Error("Trust revision witness signature invalid");

    if (expected.operation === "read-minimum-revision") {
      if (
        unsigned.outcome !== "read" ||
        unsigned.expectedRevision !== null ||
        unsigned.nextRevision !== null
      ) throw new Error("Invalid trust revision witness read outcome");
    } else {
      if (
        unsigned.expectedRevision !== expected.expectedRevision ||
        unsigned.nextRevision !== expected.nextRevision
      ) throw new Error("Trust revision witness CAS context mismatch");
      if (
        unsigned.outcome === "advanced" ||
        unsigned.outcome === "already-applied"
      ) {
        if (unsigned.observedRevision !== expected.nextRevision) {
          throw new Error("Trust revision witness CAS success mismatch");
        }
      } else if (
        unsigned.outcome === "conflict" &&
        unsigned.observedRevision > (expected.expectedRevision as number) &&
        unsigned.observedRevision !== expected.nextRevision
      ) {
        // A newer value is authoritative; the caller must read it again.
      } else {
        throw new Error("Invalid trust revision witness CAS outcome");
      }
    }
    return unsigned;
  }

  return Object.freeze({
    async readMinimumRevision(input: Readonly<{ trustDomainId: string }>): Promise<unknown> {
      const raw = exactRecord(input, ["trustDomainId"]);
      if (!raw || raw.trustDomainId !== configuration.trustDomainId) {
        throw new Error("Trust witness domain mismatch");
      }
      const requestNonceHex = await nextNonce();
      const request: HoidTrustRevisionWitnessReadRequest = Object.freeze({
        schemaVersion: 1,
        operation: "read-minimum-revision",
        witnessId: configuration.witnessId,
        trustDomainId: configuration.trustDomainId,
        requestNonceHex,
      });
      const response = await readTransport(request);
      const receipt = await verifiedReceipt(response, {
        operation: request.operation,
        requestNonceHex,
        expectedRevision: null,
        nextRevision: null,
      }, currentTime());
      return receipt.observedRevision;
    },

    async compareAndSetMinimumRevision(input: Readonly<{
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
    }>): Promise<unknown> {
      const raw = exactRecord(input, ["trustDomainId", "expectedRevision", "nextRevision"]);
      if (
        !raw ||
        raw.trustDomainId !== configuration.trustDomainId ||
        !Number.isSafeInteger(raw.expectedRevision) ||
        !Number.isSafeInteger(raw.nextRevision) ||
        (raw.expectedRevision as number) < 1 ||
        (raw.nextRevision as number) <= (raw.expectedRevision as number)
      ) throw new Error("Invalid trust witness compare-and-set request");

      const requestNonceHex = await nextNonce();
      const request: HoidTrustRevisionWitnessCompareAndSetRequest = Object.freeze({
        schemaVersion: 1,
        operation: "compare-and-set-minimum-revision",
        witnessId: configuration.witnessId,
        trustDomainId: configuration.trustDomainId,
        expectedRevision: raw.expectedRevision as number,
        nextRevision: raw.nextRevision as number,
        requestNonceHex,
      });
      const response = await compareTransport(request);
      const receipt = await verifiedReceipt(response, {
        operation: request.operation,
        requestNonceHex,
        expectedRevision: request.expectedRevision,
        nextRevision: request.nextRevision,
      }, currentTime());
      return receipt.outcome === "advanced" || receipt.outcome === "already-applied";
    },
  });
}
