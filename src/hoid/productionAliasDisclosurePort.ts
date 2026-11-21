import type { HoidAliasDisclosurePort, HoidAliasDisclosureRequest } from "./aliasDisclosureBoundary";
import type { HoidCursorProgressStore } from "./cursorSqliteProgressStore";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { resolveProductionHoidEntities, type HoidEntityResolutionResult } from "./entityResolver";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

type ProductionEntityResolver = (progress: unknown, query: unknown) => HoidEntityResolutionResult;

export type HoidProductionAliasDisclosurePortOptions = Readonly<{
  progressStore: Pick<HoidCursorProgressStore, "load">;
  /** Test seam only; production composition should use source-controlled registries. */
  resolveEntity?: ProductionEntityResolver;
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_MATCHES = 512;

function readRecord(value: unknown, allowedKeys: readonly string[], requiredKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowedKeys.length) return null;
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      record[key] = descriptor.value;
    }
    for (const key of requiredKeys) if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    return record;
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

function normalizeAlias(value: string): string {
  return value.normalize("NFKD").replace(/[\p{Cf}\p{Mn}]/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
}

function containsAliasMention(text: string, alias: string): boolean {
  const normalizedText = normalizeAlias(text);
  const normalizedAlias = normalizeAlias(alias);
  if (!normalizedAlias) return false;
  const escaped = normalizedAlias.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^\\p{L}\\p{N}])" + escaped + "($|[^\\p{L}\\p{N}])", "u").test(normalizedText);
}

function readingIdentity(value: unknown): string | null {
  const positions = validEditionBoundReadingPositions(value);
  if (positions === null || positions.length > 64) return null;
  const seen = new Set<string>();
  const canonical: Array<{ bookId: string; chapter?: number; completed?: boolean; order?: number }> = [];
  for (const position of positions) {
    if (seen.has(position.bookId)) return null;
    seen.add(position.bookId);
    canonical.push({
      bookId: position.bookId,
      ...(position.chapter === undefined ? {} : { chapter: position.chapter }),
      ...(position.completed === undefined ? {} : { completed: position.completed }),
      ...(position.order === undefined ? {} : { order: position.order }),
    });
  }
  canonical.sort((left, right) => left.bookId < right.bookId ? -1 : left.bookId > right.bookId ? 1 : 0);
  return JSON.stringify(canonical);
}

function canonicalMatches(value: unknown, text: string): readonly Readonly<{ id: string; aliases: readonly string[] }>[] | null {
  const matches = denseArray(value, 0, MAX_MATCHES);
  if (!matches) return null;
  const ids = new Set<string>();
  const result: Array<Readonly<{ id: string; aliases: readonly string[] }>> = [];
  for (const raw of matches) {
    const record = readRecord(raw, ["id", "aliases"], ["id", "aliases"]);
    if (!record || typeof record.id !== "string" || !ID_PATTERN.test(record.id) || ids.has(record.id)) return null;
    const aliases = denseArray(record.aliases, 1, 64);
    if (!aliases) return null;
    const aliasValues: string[] = [];
    const seen = new Set<string>();
    for (const alias of aliases) {
      if (typeof alias !== "string" || alias.length < 1 || alias.length > 256 ||
        alias !== alias.trim() || /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias) ||
        seen.has(alias) || !containsAliasMention(text, alias)) return null;
      seen.add(alias);
      aliasValues.push(alias);
    }
    ids.add(record.id);
    result.push(Object.freeze({ id: record.id, aliases: Object.freeze(aliasValues) }));
  }
  return Object.freeze(result);
}

function canonicalEntityResolution(value: unknown, expectedId: string, expectedAlias: string, revision: number, fingerprint: string): boolean {
  const record = readRecord(value,
    ["status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated"],
    ["status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated"]);
  if (!record || Object.keys(record).length !== 6 || record.status !== "ready" ||
    record.resolution !== "matched" || record.progressRevision !== revision ||
    record.progressFingerprint !== fingerprint || record.truncated !== false) return false;
  const matches = denseArray(record.matches, 1, 1);
  if (!matches) return false;
  const match = readRecord(matches[0], ["id", "kind", "matchedAlias", "entitySource", "aliasEvidence"], ["id", "matchedAlias"]);
  return Boolean(match && match.id === expectedId && match.matchedAlias === expectedAlias);
}

function unavailable() {
  return Object.freeze({ status: "unavailable" as const });
}

function blocked() {
  return Object.freeze({ status: "blocked" as const });
}

/**
 * Loads the latest durable cursor snapshot on every call. Each alias is resolved
 * independently through the source-controlled production resolver. The port
 * returns only exact grants and a revision witness, never narrative evidence.
 */
export function createHoidProductionAliasDisclosurePort(options: HoidProductionAliasDisclosurePortOptions): HoidAliasDisclosurePort {
  const resolver = options.resolveEntity ?? resolveProductionHoidEntities;
  return Object.freeze({
    async authorize(request: HoidAliasDisclosureRequest): Promise<unknown> {
      try {
        const requestRecord = readRecord(request, ["text", "reading", "matches"], ["text", "reading", "matches"]);
        if (!requestRecord || typeof requestRecord.text !== "string" ||
          requestRecord.text.length < 1 || requestRecord.text.length > 20_000) return unavailable();
        const expectedReading = readingIdentity(requestRecord.reading);
        const matches = canonicalMatches(requestRecord.matches, requestRecord.text);
        if (expectedReading === null || matches === null) return unavailable();

        const load = options.progressStore?.load;
        if (typeof load !== "function") return unavailable();
        const loaded = await load.call(options.progressStore);
        const loadRecord = readRecord(loaded, ["status", "snapshot", "migratedFromV1", "reason", "bookId"], ["status"]);
        if (!loadRecord || loadRecord.status !== "ready") return unavailable();

        const progress = loadRecord.snapshot;
        const projection = projectHoidCursorProgressSnapshot(progress);
        if (projection.status !== "ready") return unavailable();
        const currentReading = readingIdentity(projection.reading);
        if (currentReading === null || currentReading !== expectedReading) return blocked();

        const progressFingerprint = fingerprintHoidCursorProgressProjection(projection);
        if (!Number.isSafeInteger(projection.revision) || projection.revision < 0 ||
          !/^[a-f0-9]{64}$/u.test(progressFingerprint)) return unavailable();

        for (const match of matches) {
          for (const alias of match.aliases) {
            let resolution: unknown;
            try {
              resolution = resolver(progress, { text: alias, maxResults: 10 });
            } catch {
              return unavailable();
            }
            if (!canonicalEntityResolution(resolution, match.id, alias, projection.revision, progressFingerprint)) {
              return blocked();
            }
          }
        }

        return Object.freeze({
          status: "authorized" as const,
          authorizedMatches: Object.freeze(matches.map(match => Object.freeze({
            id: match.id,
            aliases: Object.freeze([...match.aliases]),
          }))),
          progressRevision: projection.revision,
          progressFingerprint,
        });
      } catch {
        return unavailable();
      }
    },
  });
}
