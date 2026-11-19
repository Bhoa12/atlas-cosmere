import {
  buildHoidTrustRevisionWitnessReceiptSigningMessage,
  type HoidTrustRevisionWitnessCompareAndSetRequest,
  type HoidTrustRevisionWitnessReadRequest,
  type HoidTrustRevisionWitnessReceipt,
  type HoidTrustRevisionWitnessReceiptUnsigned,
} from "./remoteTrustRevisionWitness";

export type HoidTrustRevisionWitnessServerConfiguration = Readonly<{
  witnessId: string;
  keyId: string;
  trustDomainId: string;
}>;

export type HoidTrustRevisionWitnessServerStorePort = Readonly<{
  /** Must read the durable, linearizable revision for this trust domain. */
  readMinimumRevision(input: Readonly<{ trustDomainId: string }>): Promise<unknown>;
  /**
   * Must perform one durable atomic compare-and-set. A conflict must report
   * the revision observed inside the same transaction as the failed CAS.
   */
  compareAndSetMinimumRevision(input: Readonly<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>): Promise<unknown>;
}>;

export type HoidTrustRevisionWitnessClientAuthorizationPort = Readonly<{
  /** clientId must come from authenticated transport middleware, never request JSON. */
  authorize(input: Readonly<{
    clientId: string;
    trustDomainId: string;
    operation: "read-minimum-revision" | "compare-and-set-minimum-revision";
  }>): Promise<unknown>;
}>;

export type HoidTrustRevisionWitnessReplayProtectionPort = Readonly<{
  /**
   * Atomically claims (clientId, trustDomainId, nonce). The claim must be
   * durable across service restarts and retained until retainUntil.
   */
  claim(input: Readonly<{
    clientId: string;
    trustDomainId: string;
    requestNonceHex: string;
    retainUntil: string;
  }>): Promise<unknown>;
}>;

export type HoidTrustRevisionWitnessSigningPort = Readonly<{
  /** The implementation holds the private key outside this module (ideally HSM/KMS). */
  sign(input: Readonly<{ keyId: string; message: string }>): Promise<unknown>;
}>;

export type HoidTrustRevisionWitnessServerClockPort = Readonly<{
  now(): string;
}>;

export type HoidTrustRevisionWitnessServerOptions = Readonly<{
  configuration: HoidTrustRevisionWitnessServerConfiguration;
  store: HoidTrustRevisionWitnessServerStorePort;
  authorization: HoidTrustRevisionWitnessClientAuthorizationPort;
  replayProtection: HoidTrustRevisionWitnessReplayProtectionPort;
  signer: HoidTrustRevisionWitnessSigningPort;
  clock: HoidTrustRevisionWitnessServerClockPort;
}>;

export type HoidTrustRevisionWitnessServerResult =
  | Readonly<{ status: "issued"; receipt: HoidTrustRevisionWitnessReceipt }>
  | Readonly<{
      status: "rejected";
      reason:
        | "invalid-request"
        | "unauthenticated"
        | "forbidden"
        | "replay"
        | "replay-protection-unavailable"
        | "store-unavailable"
        | "store-invalid"
        | "signer-unavailable"
        | "clock-unavailable";
    }>;

export type HoidTrustRevisionWitnessServer = Readonly<{
  /**
   * authenticatedClientId is supplied separately by trusted transport
   * middleware. It is deliberately not part of the signed request body.
   */
  handle(requestInput: unknown, authenticatedClientId: unknown): Promise<HoidTrustRevisionWitnessServerResult>;
}>;

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/u;
const NONCE_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;
const RECEIPT_LIFETIME_MS = 30_000;
const REPLAY_RETENTION_MS = 120_000;
const PORT_TIMEOUT_MS = 8_000;

type CanonicalRequest =
  | HoidTrustRevisionWitnessReadRequest
  | HoidTrustRevisionWitnessCompareAndSetRequest;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
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

function resolveMethod<TInput>(
  value: unknown,
  name: string,
): ((input: TInput) => Promise<unknown>) | null {
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
        return (descriptor.value as (input: TInput) => Promise<unknown>).bind(value);
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

async function withTimeout<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = Promise.resolve().then(operation);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Witness server port timeout")), PORT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function canonicalRequest(
  value: unknown,
  configuration: HoidTrustRevisionWitnessServerConfiguration,
): CanonicalRequest | null {
  const read = exactRecord(value, [
    "schemaVersion",
    "operation",
    "witnessId",
    "trustDomainId",
    "requestNonceHex",
  ]);
  if (read) {
    if (
      read.schemaVersion !== 1 ||
      read.operation !== "read-minimum-revision" ||
      read.witnessId !== configuration.witnessId ||
      read.trustDomainId !== configuration.trustDomainId ||
      typeof read.requestNonceHex !== "string" ||
      !NONCE_PATTERN.test(read.requestNonceHex)
    ) return null;
    return Object.freeze({
      schemaVersion: 1,
      operation: "read-minimum-revision",
      witnessId: configuration.witnessId,
      trustDomainId: configuration.trustDomainId,
      requestNonceHex: read.requestNonceHex,
    });
  }

  const compare = exactRecord(value, [
    "schemaVersion",
    "operation",
    "witnessId",
    "trustDomainId",
    "expectedRevision",
    "nextRevision",
    "requestNonceHex",
  ]);
  if (
    !compare ||
    compare.schemaVersion !== 1 ||
    compare.operation !== "compare-and-set-minimum-revision" ||
    compare.witnessId !== configuration.witnessId ||
    compare.trustDomainId !== configuration.trustDomainId ||
    !Number.isSafeInteger(compare.expectedRevision) ||
    (compare.expectedRevision as number) < 1 ||
    !Number.isSafeInteger(compare.nextRevision) ||
    (compare.nextRevision as number) <= (compare.expectedRevision as number) ||
    typeof compare.requestNonceHex !== "string" ||
    !NONCE_PATTERN.test(compare.requestNonceHex)
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    operation: "compare-and-set-minimum-revision",
    witnessId: configuration.witnessId,
    trustDomainId: configuration.trustDomainId,
    expectedRevision: compare.expectedRevision as number,
    nextRevision: compare.nextRevision as number,
    requestNonceHex: compare.requestNonceHex,
  });
}

function canonicalStoreResult(value: unknown): Readonly<{
  outcome: "advanced" | "already-applied" | "conflict";
  observedRevision: number;
}> | null {
  const record = exactRecord(value, ["outcome", "observedRevision"]);
  if (
    !record ||
    (record.outcome !== "advanced" &&
      record.outcome !== "already-applied" &&
      record.outcome !== "conflict") ||
    !Number.isSafeInteger(record.observedRevision) ||
    (record.observedRevision as number) < 1
  ) return null;
  return Object.freeze({
    outcome: record.outcome,
    observedRevision: record.observedRevision as number,
  });
}

function rejected(
  reason: Extract<HoidTrustRevisionWitnessServerResult, { status: "rejected" }>["reason"],
): HoidTrustRevisionWitnessServerResult {
  return Object.freeze({ status: "rejected", reason });
}

/**
 * Creates a transport-neutral server handler. Authentication, replay storage,
 * durable CAS and private-key operations are injected; no HTTP framework,
 * database SDK, network client or private key is embedded in the Hoid module.
 */
export function createHoidTrustRevisionWitnessServer(
  optionsInput: HoidTrustRevisionWitnessServerOptions,
): HoidTrustRevisionWitnessServer {
  const options = exactRecord(optionsInput, [
    "configuration",
    "store",
    "authorization",
    "replayProtection",
    "signer",
    "clock",
  ]);
  if (!options) throw new Error("Invalid trust witness server options");

  const configuration = exactRecord(options.configuration, ["witnessId", "keyId", "trustDomainId"]);
  if (
    !configuration ||
    typeof configuration.witnessId !== "string" ||
    !ID_PATTERN.test(configuration.witnessId) ||
    typeof configuration.keyId !== "string" ||
    !ID_PATTERN.test(configuration.keyId) ||
    typeof configuration.trustDomainId !== "string" ||
    !ID_PATTERN.test(configuration.trustDomainId)
  ) throw new Error("Invalid trust witness server configuration");

  const pinnedConfiguration = Object.freeze({
    witnessId: configuration.witnessId,
    keyId: configuration.keyId,
    trustDomainId: configuration.trustDomainId,
  });

  const readStore = resolveMethod<{ trustDomainId: string }>(options.store, "readMinimumRevision");
  const compareStore = resolveMethod<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>(options.store, "compareAndSetMinimumRevision");
  const authorizeClient = resolveMethod<{
    clientId: string;
    trustDomainId: string;
    operation: CanonicalRequest["operation"];
  }>(options.authorization, "authorize");
  const claimReplay = resolveMethod<{
    clientId: string;
    trustDomainId: string;
    requestNonceHex: string;
    retainUntil: string;
  }>(options.replayProtection, "claim");
  const sign = resolveMethod<{ keyId: string; message: string }>(options.signer, "sign");
  const readClock = resolveNoArgumentMethod(options.clock, "now");

  if (!readStore || !compareStore || !authorizeClient || !claimReplay || !sign || !readClock) {
    throw new Error("Trust witness server dependency unavailable");
  }

  const readStoreMethod = readStore;
  const compareStoreMethod = compareStore;
  const authorizeClientMethod = authorizeClient;
  const claimReplayMethod = claimReplay;
  const signMethod = sign;
  const readClockMethod = readClock;

  async function issueReceipt(
    request: CanonicalRequest,
    outcome: HoidTrustRevisionWitnessReceiptUnsigned["outcome"],
    observedRevision: number,
    issuedAt: string,
  ): Promise<HoidTrustRevisionWitnessServerResult> {
    const issuedMs = Date.parse(issuedAt);
    const unsigned: HoidTrustRevisionWitnessReceiptUnsigned = Object.freeze({
      schemaVersion: 1,
      witnessId: pinnedConfiguration.witnessId,
      keyId: pinnedConfiguration.keyId,
      trustDomainId: pinnedConfiguration.trustDomainId,
      operation: request.operation,
      requestNonceHex: request.requestNonceHex,
      expectedRevision: request.operation === "read-minimum-revision" ? null : request.expectedRevision,
      nextRevision: request.operation === "read-minimum-revision" ? null : request.nextRevision,
      outcome,
      observedRevision,
      issuedAt,
      expiresAt: new Date(issuedMs + RECEIPT_LIFETIME_MS).toISOString(),
    });
    const message = buildHoidTrustRevisionWitnessReceiptSigningMessage(unsigned);
    if (!message) return rejected("store-invalid");

    let signature: unknown;
    try {
      signature = await withTimeout(() => signMethod(Object.freeze({
        keyId: pinnedConfiguration.keyId,
        message,
      })));
    } catch {
      return rejected("signer-unavailable");
    }
    if (typeof signature !== "string" || !SIGNATURE_PATTERN.test(signature)) {
      return rejected("signer-unavailable");
    }

    return Object.freeze({
      status: "issued",
      receipt: Object.freeze({ ...unsigned, signatureHex: signature }),
    });
  }

  return Object.freeze({
    async handle(
      requestInput: unknown,
      authenticatedClientIdInput: unknown,
    ): Promise<HoidTrustRevisionWitnessServerResult> {
      const request = canonicalRequest(requestInput, pinnedConfiguration);
      if (!request) return rejected("invalid-request");

      if (
        typeof authenticatedClientIdInput !== "string" ||
        !ID_PATTERN.test(authenticatedClientIdInput)
      ) return rejected("unauthenticated");
      const clientId = authenticatedClientIdInput;

      let clockValue: unknown;
      try {
        clockValue = readClock();
      } catch {
        return rejected("clock-unavailable");
      }
      if (typeof clockValue !== "string") return rejected("clock-unavailable");
      const now = clockValue;
      const nowMs = Date.parse(now);
      if (!Number.isFinite(nowMs) || new Date(nowMs).toISOString() !== now) {
        return rejected("clock-unavailable");
      }

      let authorized: unknown;
      try {
        authorized = await withTimeout(() => authorizeClientMethod(Object.freeze({
          clientId,
          trustDomainId: pinnedConfiguration.trustDomainId,
          operation: request.operation,
        })));
      } catch {
        return rejected("forbidden");
      }
      if (authorized !== true) return rejected("forbidden");

      const retainUntil = new Date(nowMs + REPLAY_RETENTION_MS).toISOString();
      let claimed: unknown;
      try {
        claimed = await withTimeout(() => claimReplayMethod(Object.freeze({
          clientId,
          trustDomainId: pinnedConfiguration.trustDomainId,
          requestNonceHex: request.requestNonceHex,
          retainUntil,
        })));
      } catch {
        return rejected("replay-protection-unavailable");
      }
      if (claimed === false) return rejected("replay");
      if (claimed !== true) return rejected("replay-protection-unavailable");

      if (request.operation === "read-minimum-revision") {
        let observed: unknown;
        try {
          observed = await withTimeout(() => readStoreMethod(Object.freeze({
            trustDomainId: pinnedConfiguration.trustDomainId,
          })));
        } catch {
          return rejected("store-unavailable");
        }
        if (!Number.isSafeInteger(observed) || (observed as number) < 1) {
          return rejected("store-invalid");
        }
        return issueReceipt(request, "read", observed as number, now);
      }

      let storeResult: unknown;
      try {
        storeResult = await withTimeout(() => compareStoreMethod(Object.freeze({
          trustDomainId: pinnedConfiguration.trustDomainId,
          expectedRevision: request.expectedRevision,
          nextRevision: request.nextRevision,
        })));
      } catch {
        return rejected("store-unavailable");
      }
      const result = canonicalStoreResult(storeResult);
      if (!result) return rejected("store-invalid");

      if (result.outcome === "advanced" || result.outcome === "already-applied") {
        if (result.observedRevision !== request.nextRevision) return rejected("store-invalid");
      } else if (
        result.observedRevision <= request.expectedRevision ||
        result.observedRevision === request.nextRevision
      ) {
        return rejected("store-invalid");
      }

      return issueReceipt(request, result.outcome, result.observedRevision, now);
    },
  });
}
