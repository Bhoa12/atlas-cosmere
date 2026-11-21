import { HoidKnowledgeCatalog } from "./catalog";
import type { ReadingPosition } from "./types";

export type HoidAliasDisclosureRequest = Readonly<{
  text: string;
  reading: readonly ReadingPosition[];
  matches: readonly HoidAliasDisclosureGrant[];
}>;

export type HoidAliasDisclosureGrant = Readonly<{
  id: string;
  aliases: readonly string[];
}>;

export type HoidAliasDisclosurePortResult =
  | Readonly<{
      status: "authorized";
      authorizedMatches: readonly HoidAliasDisclosureGrant[];
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{ status: "blocked" }>
  | Readonly<{ status: "unavailable" }>;

export type HoidAliasDisclosureProgressWitness = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export interface HoidAliasDisclosurePort {
  authorize(request: HoidAliasDisclosureRequest): unknown | Promise<unknown>;
}

export type HoidAliasDisclosureDecision =
  | Readonly<{ status: "allowed"; progressWitness: HoidAliasDisclosureProgressWitness | null }>
  | Readonly<{ status: "blocked" }>
  | Readonly<{ status: "unavailable" }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_READING_POSITIONS = 64;
const MAX_ALIAS_LENGTH = 256;
const MAX_TEXT_LENGTH = 20_000;
const MAX_ORDER = 1_000_000;
const MAX_CHAPTER = 100_000_000;
const MAX_MATCHES = 512;
const PORT_TIMEOUT_MS = 5_000;

function readRecord(value: unknown, allowedKeys: readonly string[], requiredKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowedKeys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function snapshotReading(value: unknown): readonly ReadingPosition[] | null {
  const positions = denseArray(value, 0, MAX_READING_POSITIONS);
  if (!positions) return null;
  const snapshot: ReadingPosition[] = [];
  const seenBooks = new Set<string>();
  for (const value of positions) {
    const record = readRecord(value, ["bookId", "chapter", "completed", "order"], ["bookId"]);
    if (!record || typeof record.bookId !== "string" || record.bookId.length === 0 ||
      record.bookId !== record.bookId.trim() || seenBooks.has(record.bookId)) return null;
    if (Object.prototype.hasOwnProperty.call(record, "chapter") &&
      (typeof record.chapter !== "number" || !Number.isSafeInteger(record.chapter) ||
        record.chapter < 0 || record.chapter > MAX_CHAPTER)) return null;
    if (Object.prototype.hasOwnProperty.call(record, "completed") && typeof record.completed !== "boolean") return null;
    if (Object.prototype.hasOwnProperty.call(record, "order") &&
      (typeof record.order !== "number" || !Number.isSafeInteger(record.order) ||
        record.order < 0 || record.order > MAX_ORDER)) return null;
    if (record.completed === true && Object.prototype.hasOwnProperty.call(record, "chapter")) return null;
    seenBooks.add(record.bookId);
    snapshot.push(Object.freeze({
      bookId: record.bookId as string,
      ...(Object.prototype.hasOwnProperty.call(record, "chapter") ? { chapter: record.chapter as number } : {}),
      ...(Object.prototype.hasOwnProperty.call(record, "completed") ? { completed: record.completed as boolean } : {}),
      ...(Object.prototype.hasOwnProperty.call(record, "order") ? { order: record.order as number } : {}),
    }));
  }
  return Object.freeze(snapshot);
}

function resolveAuthorizeMethod(value: unknown): ((request: HoidAliasDisclosureRequest) => unknown | Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "authorize");
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") return null;
        return (descriptor.value as (request: HoidAliasDisclosureRequest) => unknown | Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function hasThenMember(value: unknown): boolean {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
    let current: object | null = value as object;
    for (let depth = 0; current !== null && depth < 5; depth += 1) {
      if (Object.getOwnPropertyDescriptor(current, "then")) return true;
      current = Object.getPrototypeOf(current) as object | null;
    }
    return false;
  } catch {
    return true;
  }
}

async function settlePortResult(value: unknown): Promise<unknown | null> {
  try {
    if (value instanceof Promise) {
      return await new Promise<unknown | null>(resolve => {
        const timer = setTimeout(() => resolve(null), PORT_TIMEOUT_MS);
        value.then(
          result => { clearTimeout(timer); resolve(result); },
          () => { clearTimeout(timer); resolve(null); },
        );
      });
    }
    if (hasThenMember(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function canonicalExpectedMatches(matches: readonly HoidAliasDisclosureGrant[]): readonly HoidAliasDisclosureGrant[] | null {
  const result: HoidAliasDisclosureGrant[] = [];
  const seenIds = new Set<string>();
  for (const match of matches) {
    const record = readRecord(match, ["id", "aliases"], ["id", "aliases"]);
    if (!record || typeof record.id !== "string" || !ID_PATTERN.test(record.id) || seenIds.has(record.id)) return null;
    const aliases = denseArray(record.aliases, 1, 64);
    if (!aliases) return null;
    const canonicalAliases: string[] = [];
    const seenAliases = new Set<string>();
    for (const alias of aliases) {
      if (typeof alias !== "string" || alias.length < 1 || alias.length > MAX_ALIAS_LENGTH ||
        alias !== alias.trim() || /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias) || seenAliases.has(alias)) return null;
      seenAliases.add(alias);
      canonicalAliases.push(alias);
    }
    seenIds.add(record.id);
    result.push(Object.freeze({ id: record.id, aliases: Object.freeze(canonicalAliases.sort()) }));
  }
  return Object.freeze(result.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function canonicalAuthorizedMatches(value: unknown, expected: readonly HoidAliasDisclosureGrant[]): boolean {
  const grants = denseArray(value, expected.length, expected.length);
  if (!grants) return false;
  const byId = new Map<string, readonly string[]>();
  for (const raw of grants) {
    const record = readRecord(raw, ["id", "aliases"], ["id", "aliases"]);
    if (!record || typeof record.id !== "string" || !ID_PATTERN.test(record.id) || byId.has(record.id)) return false;
    const aliases = denseArray(record.aliases, 1, 64);
    if (!aliases) return false;
    const values: string[] = [];
    const seen = new Set<string>();
    for (const alias of aliases) {
      if (typeof alias !== "string" || alias.length < 1 || alias.length > MAX_ALIAS_LENGTH ||
        alias !== alias.trim() || /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias) || seen.has(alias)) return false;
      seen.add(alias);
      values.push(alias);
    }
    byId.set(record.id, Object.freeze(values.sort()));
  }
  if (byId.size !== expected.length) return false;
  return expected.every(item => {
    const actual = byId.get(item.id);
    return actual !== undefined && actual.length === item.aliases.length &&
      actual.every((alias, index) => alias === item.aliases[index]);
  });
}

function canonicalDecision(value: unknown, expected: readonly HoidAliasDisclosureGrant[]): HoidAliasDisclosureDecision {
  const record = readRecord(value,
    ["status", "authorizedMatches", "progressRevision", "progressFingerprint"], ["status"]);
  if (!record) return Object.freeze({ status: "unavailable" });
  if (record.status === "blocked") {
    return Object.keys(record).length === 1 ? Object.freeze({ status: "blocked" }) : Object.freeze({ status: "unavailable" });
  }
  if (record.status === "unavailable") return Object.freeze({ status: "unavailable" });
  if (record.status !== "authorized" || Object.keys(record).length !== 4 ||
    !canonicalAuthorizedMatches(record.authorizedMatches, expected)) return Object.freeze({ status: "unavailable" });
  const revision = record.progressRevision;
  const fingerprint = record.progressFingerprint;
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0 ||
    typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(fingerprint)) {
    return Object.freeze({ status: "unavailable" });
  }
  return Object.freeze({ status: "allowed", progressWitness: Object.freeze({ revision, fingerprint }) });
}

export function sameHoidAliasProgressWitness(
  left: { revision: number; fingerprint: string } | null,
  right: { revision: number; fingerprint: string } | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

/**
 * Invoke the host authority for every request, including alias-free text, so
 * the request and final answer can be bound to one durable progress revision.
 */
export async function authorizeHoidCatalogAliasMentions(
  text: string,
  reading: readonly ReadingPosition[],
  catalog: HoidKnowledgeCatalog,
  port?: HoidAliasDisclosurePort | null,
): Promise<HoidAliasDisclosureDecision> {
  try {
    if (typeof text !== "string" || text.length < 1 || text.length > MAX_TEXT_LENGTH ||
      text !== text.trim() || /[\u0000-\u001F\u007F]/u.test(text)) {
      return Object.freeze({ status: "unavailable" });
    }
    if (!(catalog instanceof HoidKnowledgeCatalog)) return Object.freeze({ status: "unavailable" });
    const readingSnapshot = snapshotReading(reading);
    if (!readingSnapshot) return Object.freeze({ status: "unavailable" });
    const matches = catalog.findMatches(text);
    if (!Array.isArray(matches) || matches.length > MAX_MATCHES) return Object.freeze({ status: "unavailable" });
    const expected = canonicalExpectedMatches(matches);
    if (!expected) return Object.freeze({ status: "unavailable" });

    if (!port) {
      return expected.length === 0
        ? Object.freeze({ status: "allowed", progressWitness: null })
        : Object.freeze({ status: "blocked" });
    }
    const authorize = resolveAuthorizeMethod(port);
    if (!authorize) return Object.freeze({ status: "unavailable" });
    const request: HoidAliasDisclosureRequest = Object.freeze({
      text,
      reading: readingSnapshot,
      matches: expected,
    });
    let rawResult: unknown;
    try { rawResult = authorize(request); } catch { return Object.freeze({ status: "unavailable" }); }
    const settled = await settlePortResult(rawResult);
    if (settled === null) return Object.freeze({ status: "unavailable" });
    return canonicalDecision(settled, expected);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}
