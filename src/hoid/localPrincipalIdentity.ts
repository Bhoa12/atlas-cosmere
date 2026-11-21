/**
 * Installation-local, pseudonymous principal identity for Hoid conversation
 * partitioning. This is not an account identifier and is not authentication.
 *
 * A host must supply cryptographically secure random bytes when provisioning
 * a new identity. There is deliberately no Math.random/date/device-ID fallback.
 */
export const HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION = 1 as const;
export const HOID_LOCAL_PRINCIPAL_IDENTITY_KIND = "hoid-local-principal-identity" as const;
export const HOID_LOCAL_PRINCIPAL_RANDOM_BYTES = 24 as const;

const ID_PATTERN = /^hlp1_[0-9a-f]{48}$/u;

export type HoidLocalPrincipalIdentityRecord = Readonly<{
  schemaVersion: typeof HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION;
  kind: typeof HOID_LOCAL_PRINCIPAL_IDENTITY_KIND;
  principalId: string;
}>;

export type HoidLocalPrincipalIdentityStorePort = Readonly<{
  read: () => Promise<unknown | null>;
  /** Must atomically create the singleton identity or report that one exists. */
  createIfAbsent: (
    record: HoidLocalPrincipalIdentityRecord,
  ) => Promise<"created" | "exists">;
}>;

export type HoidSecureRandomPort = Readonly<{
  randomBytes: (length: number) => Uint8Array | Promise<Uint8Array>;
}>;

export type HoidLocalPrincipalIdentityResult =
  | Readonly<{ status: "ready"; principalId: string; created: boolean }>
  | Readonly<{
      status: "invalid-input";
      reason: "invalid-store" | "invalid-random-source";
    }>
  | Readonly<{ status: "invalid-record" }>
  | Readonly<{ status: "invalid-random-output" }>
  | Readonly<{ status: "unavailable" }>;

type DataRecord = Record<string, unknown>;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

export function isHoidLocalPrincipalId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function canonicalIdentityRecord(value: unknown): HoidLocalPrincipalIdentityRecord | null {
  const record = canonicalRecord(value, ["schemaVersion", "kind", "principalId"]);
  if (
    !record ||
    record.schemaVersion !== HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION ||
    record.kind !== HOID_LOCAL_PRINCIPAL_IDENTITY_KIND ||
    !isHoidLocalPrincipalId(record.principalId)
  ) return null;

  return Object.freeze({
    schemaVersion: HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
    kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
    principalId: record.principalId,
  });
}

function canonicalStore(value: unknown): HoidLocalPrincipalIdentityStorePort | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("read") || !keys.includes("createIfAbsent")) {
      return null;
    }

    const read = Object.getOwnPropertyDescriptor(value, "read");
    const createIfAbsent = Object.getOwnPropertyDescriptor(value, "createIfAbsent");
    if (
      !read ||
      !createIfAbsent ||
      !Object.prototype.hasOwnProperty.call(read, "value") ||
      !Object.prototype.hasOwnProperty.call(createIfAbsent, "value") ||
      read.enumerable !== true ||
      createIfAbsent.enumerable !== true ||
      typeof read.value !== "function" ||
      typeof createIfAbsent.value !== "function"
    ) return null;

    const readMethod = read.value as HoidLocalPrincipalIdentityStorePort["read"];
    const createMethod =
      createIfAbsent.value as HoidLocalPrincipalIdentityStorePort["createIfAbsent"];
    return Object.freeze({
      read: () => readMethod.call(value),
      createIfAbsent: (record: HoidLocalPrincipalIdentityRecord) =>
        createMethod.call(value, record),
    });
  } catch {
    return null;
  }
}

function canonicalRandomSource(value: unknown): HoidSecureRandomPort | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 1 || keys[0] !== "randomBytes") return null;

    const descriptor = Object.getOwnPropertyDescriptor(value, "randomBytes");
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "function"
    ) return null;

    const method = descriptor.value as HoidSecureRandomPort["randomBytes"];
    return Object.freeze({
      randomBytes: (length: number) => method.call(value, length),
    });
  } catch {
    return null;
  }
}

function principalIdFromRandomBytes(value: unknown): string | null {
  try {
    if (
      !(value instanceof Uint8Array) ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      value.byteLength !== HOID_LOCAL_PRINCIPAL_RANDOM_BYTES
    ) return null;

    let nonZero = false;
    let hex = "";
    for (let index = 0; index < value.length; index += 1) {
      const byte = value[index];
      if (byte !== 0) nonZero = true;
      hex += byte.toString(16).padStart(2, "0");
    }
    if (!nonZero) return null;
    return "hlp1_" + hex;
  } catch {
    return null;
  }
}

/**
 * Reads the existing identity first. Only an absent identity requires a
 * cryptographically secure random source. Concurrent provisioners rely on
 * the store's atomic createIfAbsent operation and then read the winning row.
 */
export async function getOrCreateHoidLocalPrincipalIdentity(
  storeInput: unknown,
  randomSourceInput: unknown,
): Promise<HoidLocalPrincipalIdentityResult> {
  const store = canonicalStore(storeInput);
  if (!store) return Object.freeze({ status: "invalid-input", reason: "invalid-store" });

  let existing: unknown | null;
  try {
    existing = await store.read();
  } catch {
    return Object.freeze({ status: "unavailable" });
  }

  if (existing !== null) {
    const record = canonicalIdentityRecord(existing);
    return record
      ? Object.freeze({ status: "ready", principalId: record.principalId, created: false })
      : Object.freeze({ status: "invalid-record" });
  }

  const randomSource = canonicalRandomSource(randomSourceInput);
  if (!randomSource) {
    return Object.freeze({ status: "invalid-input", reason: "invalid-random-source" });
  }

  let randomBytes: unknown;
  try {
    randomBytes = await randomSource.randomBytes(HOID_LOCAL_PRINCIPAL_RANDOM_BYTES);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }

  const principalId = principalIdFromRandomBytes(randomBytes);
  if (!principalId) return Object.freeze({ status: "invalid-random-output" });

  const candidate: HoidLocalPrincipalIdentityRecord = Object.freeze({
    schemaVersion: HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
    kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
    principalId,
  });

  let creation: unknown;
  try {
    creation = await store.createIfAbsent(candidate);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
  if (creation !== "created" && creation !== "exists") {
    return Object.freeze({ status: "unavailable" });
  }

  let winner: unknown | null;
  try {
    winner = await store.read();
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
  if (winner === null) return Object.freeze({ status: "unavailable" });

  const canonicalWinner = canonicalIdentityRecord(winner);
  if (!canonicalWinner) return Object.freeze({ status: "invalid-record" });

  return Object.freeze({
    status: "ready",
    principalId: canonicalWinner.principalId,
    created: creation === "created" && canonicalWinner.principalId === principalId,
  });
}
