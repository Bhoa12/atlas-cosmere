import type { HoidKnowledgeCatalog } from "./catalog";
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
    }>
  | Readonly<{ status: "blocked" }>
  | Readonly<{ status: "unavailable" }>;

/**
 * Trusted host-owned authority for per-alias disclosure.
 *
 * Implementations must check every alias in every match against independently
 * reviewed alias evidence. This port is never supplied by an AI provider.
 */
export interface HoidAliasDisclosurePort {
  authorize(request: HoidAliasDisclosureRequest): unknown;
}

export type HoidAliasDisclosureDecision =
  | Readonly<{ status: "allowed" }>
  | Readonly<{ status: "blocked" }>
  | Readonly<{ status: "unavailable" }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_READING_POSITIONS = 64;
const MAX_ALIAS_LENGTH = 256;
const MAX_TEXT_LENGTH = 20_000;
const MAX_ORDER = 1_000_000;
const MAX_CHAPTER = 100_000_000;

function readRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
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
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }

    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }

    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
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
  for (const value of positions) {
    const record = readRecord(
      value,
      ["bookId", "chapter", "completed", "order"],
      ["bookId"],
    );
    if (
      !record ||
      typeof record.bookId !== "string" ||
      record.bookId.length === 0 ||
      record.bookId !== record.bookId.trim()
    ) return null;

    if (
      Object.prototype.hasOwnProperty.call(record, "chapter") &&
      (typeof record.chapter !== "number" ||
        !Number.isSafeInteger(record.chapter) ||
        record.chapter < 0 ||
        record.chapter > MAX_CHAPTER)
    ) return null;

    if (
      Object.prototype.hasOwnProperty.call(record, "completed") &&
      typeof record.completed !== "boolean"
    ) return null;

    if (
      Object.prototype.hasOwnProperty.call(record, "order") &&
      (typeof record.order !== "number" ||
        !Number.isSafeInteger(record.order) ||
        record.order < 0 ||
        record.order > MAX_ORDER)
    ) return null;

    if (
      record.completed === true &&
      Object.prototype.hasOwnProperty.call(record, "chapter")
    ) return null;

    snapshot.push(Object.freeze({
      bookId: record.bookId as string,
      ...(Object.prototype.hasOwnProperty.call(record, "chapter")
        ? { chapter: record.chapter as number }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(record, "completed")
        ? { completed: record.completed as boolean }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(record, "order")
        ? { order: record.order as number }
        : {}),
    }));
  }

  return Object.freeze(snapshot);
}

function resolveAuthorizeMethod(value: unknown): ((request: HoidAliasDisclosureRequest) => unknown) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "authorize");
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (request: HoidAliasDisclosureRequest) => unknown).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalExpectedMatches(
  matches: readonly HoidAliasDisclosureGrant[],
): readonly HoidAliasDisclosureGrant[] | null {
  const result: HoidAliasDisclosureGrant[] = [];
  const seenIds = new Set<string>();

  for (const match of matches) {
    if (
      !match ||
      typeof match.id !== "string" ||
      !ID_PATTERN.test(match.id) ||
      seenIds.has(match.id)
    ) return null;

    const aliases = denseArray(match.aliases, 1, 64);
    if (!aliases) return null;
    const canonicalAliases: string[] = [];
    const seenAliases = new Set<string>();
    for (const alias of aliases) {
      if (
        typeof alias !== "string" ||
        alias.length < 1 ||
        alias.length > MAX_ALIAS_LENGTH ||
        alias !== alias.trim() ||
        /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias) ||
        seenAliases.has(alias)
      ) return null;
      seenAliases.add(alias);
      canonicalAliases.push(alias);
    }

    seenIds.add(match.id);
    result.push(Object.freeze({
      id: match.id,
      aliases: Object.freeze(canonicalAliases.sort()),
    }));
  }

  return Object.freeze(result.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function canonicalAuthorizedMatches(
  value: unknown,
  expected: readonly HoidAliasDisclosureGrant[],
): boolean {
  const grants = denseArray(value, expected.length, expected.length);
  if (!grants) return false;

  const byId = new Map<string, readonly string[]>();
  for (const raw of grants) {
    const record = readRecord(raw, ["id", "aliases"], ["id", "aliases"]);
    if (
      !record ||
      typeof record.id !== "string" ||
      !ID_PATTERN.test(record.id) ||
      byId.has(record.id)
    ) return false;

    const aliases = denseArray(record.aliases, 1, 64);
    if (!aliases) return false;
    const values: string[] = [];
    const seen = new Set<string>();
    for (const alias of aliases) {
      if (
        typeof alias !== "string" ||
        alias.length < 1 ||
        alias.length > MAX_ALIAS_LENGTH ||
        alias !== alias.trim() ||
        /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias) ||
        seen.has(alias)
      ) return false;
      seen.add(alias);
      values.push(alias);
    }
    byId.set(record.id, Object.freeze(values.sort()));
  }

  if (byId.size !== expected.length) return false;
  return expected.every(item => {
    const actual = byId.get(item.id);
    return actual !== undefined &&
      actual.length === item.aliases.length &&
      actual.every((alias, index) => alias === item.aliases[index]);
  });
}

function canonicalDecision(
  value: unknown,
  expected: readonly HoidAliasDisclosureGrant[],
): HoidAliasDisclosureDecision {
  const record = readRecord(
    value,
    ["status", "authorizedMatches"],
    ["status"],
  );
  if (!record) return Object.freeze({ status: "unavailable" });

  if (record.status === "blocked") {
    return Object.keys(record).length === 1
      ? Object.freeze({ status: "blocked" })
      : Object.freeze({ status: "unavailable" });
  }

  if (record.status === "unavailable") {
    return Object.freeze({ status: "unavailable" });
  }

  if (
    record.status !== "authorized" ||
    Object.keys(record).length !== 2 ||
    !canonicalAuthorizedMatches(record.authorizedMatches, expected)
  ) return Object.freeze({ status: "unavailable" });

  return Object.freeze({ status: "allowed" });
}

/**
 * Apply per-alias disclosure before a legacy provider boundary.
 *
 * No catalog match means there is no known alias to authorize. If a known
 * alias is present, a trusted host port must grant every exact (entity ID,
 * matched alias) pair. Missing, malformed, partial or asynchronous grants
 * fail closed. The AI provider never receives this authority.
 */
export function authorizeHoidCatalogAliasMentions(
  text: string,
  reading: readonly ReadingPosition[],
  catalog: HoidKnowledgeCatalog,
  port?: HoidAliasDisclosurePort | null,
): HoidAliasDisclosureDecision {
  try {
    if (
      typeof text !== "string" ||
      text.length < 1 ||
      text.length > MAX_TEXT_LENGTH ||
      text !== text.trim() ||
      /[\u0000-\u001F\u007F]/u.test(text)
    ) return Object.freeze({ status: "unavailable" });

    const readingSnapshot = snapshotReading(reading);
    if (!readingSnapshot) return Object.freeze({ status: "unavailable" });

    const matches = catalog.findMatches(text);
    if (matches.length === 0) return Object.freeze({ status: "allowed" });

    const expected = canonicalExpectedMatches(matches);
    if (!expected) return Object.freeze({ status: "unavailable" });
    if (!port) return Object.freeze({ status: "blocked" });

    const authorize = resolveAuthorizeMethod(port);
    if (!authorize) return Object.freeze({ status: "unavailable" });

    const request: HoidAliasDisclosureRequest = Object.freeze({
      text,
      reading: readingSnapshot,
      matches: expected,
    });

    let rawResult: unknown;
    try {
      rawResult = authorize(request);
    } catch {
      return Object.freeze({ status: "unavailable" });
    }

    return canonicalDecision(rawResult, expected);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}
