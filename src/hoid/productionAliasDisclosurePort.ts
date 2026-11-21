import type { HoidAliasDisclosurePort, HoidAliasDisclosureRequest } from "./aliasDisclosureBoundary";
import type { HoidCursorProgressStore } from "./cursorSqliteProgressStore";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { resolveProductionHoidEntities, type HoidEntityResolutionResult } from "./entityResolver";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { isHoidKnowledgeKind } from "./knowledgeKinds";

export type HoidProductionAliasDisclosurePortOptions = Readonly<{
  /** Durable store only. The production resolver is never caller-injectable. */
  progressStore: Pick<HoidCursorProgressStore, "load">;
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

function canonicalEntitySource(value: unknown): boolean {
  const source = readRecord(value,
    ["evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId", "unlockChapter",
      "editionId", "navigationSha256", "documentSha256"],
    ["evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId", "unlockChapter",
      "editionId", "navigationSha256", "documentSha256"]);
  return Boolean(source &&
    Object.keys(source).length === 9 &&
    typeof source.evidenceId === "string" && ID_PATTERN.test(source.evidenceId) &&
    typeof source.sourceBookId === "string" && ID_PATTERN.test(source.sourceBookId) &&
    typeof source.sourceChapter === "number" && Number.isSafeInteger(source.sourceChapter) && source.sourceChapter > 0 &&
    typeof source.locatorId === "string" && source.locatorId.length > 0 && source.locatorId.length <= 256 &&
    !/[\\u0000-\\u001F\\u007F]/u.test(source.locatorId) &&
    typeof source.unlockBookId === "string" && ID_PATTERN.test(source.unlockBookId) &&
    typeof source.unlockChapter === "number" && Number.isSafeInteger(source.unlockChapter) && source.unlockChapter > 0 &&
    typeof source.editionId === "string" && source.editionId.length > 0 && source.editionId.length <= 128 &&
    typeof source.navigationSha256 === "string" && /^[a-f0-9]{64}$/u.test(source.navigationSha256) &&
    typeof source.documentSha256 === "string" && /^[a-f0-9]{64}$/u.test(source.documentSha256));
}

function canonicalAliasEvidence(value: unknown): boolean {
  const evidence = denseArray(value, 1, 8);
  if (!evidence) return false;
  const seen = new Set<string>();
  for (const raw of evidence) {
    const item = readRecord(raw, ["evidenceId", "source"], ["evidenceId", "source"]);
    if (!item || Object.keys(item).length !== 2 ||
      typeof item.evidenceId !== "string" || !ID_PATTERN.test(item.evidenceId) ||
      seen.has(item.evidenceId) || !canonicalEntitySource(item.source)) return false;
    const source = readRecord(item.source,
      ["evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId", "unlockChapter",
        "editionId", "navigationSha256", "documentSha256"],
      ["evidenceId"]);
    if (!source || source.evidenceId !== item.evidenceId) return false;
    seen.add(item.evidenceId);
  }
  return true;
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
  const match = readRecord(matches[0],
    ["id", "kind", "matchedAlias", "entitySource", "aliasEvidence"],
    ["id", "kind", "matchedAlias", "entitySource", "aliasEvidence"]);
  return Boolean(match && Object.keys(match).length === 5 &&
    match.id === expectedId && isHoidKnowledgeKind(match.kind) &&
    match.matchedAlias === expectedAlias && canonicalEntitySource(match.entitySource) &&
    canonicalAliasEvidence(match.aliasEvidence));
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
function resolveLoadMethod(value: unknown): (() => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "load");
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function") return null;
        return (descriptor.value as () => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Loads the latest durable cursor snapshot on every call. Production entity
 * resolution is fixed to source-controlled registries and cannot be replaced
 * through constructor options or provider-supplied dependencies.
 */
export function createHoidProductionAliasDisclosurePort(options: HoidProductionAliasDisclosurePortOptions): HoidAliasDisclosurePort {
  const optionRecord = readRecord(options, ["progressStore"], ["progressStore"]);
  const load = optionRecord ? resolveLoadMethod(optionRecord.progressStore) : null;
  return Object.freeze({
    async authorize(request: HoidAliasDisclosureRequest): Promise<unknown> {
      try {
        if (!load) return unavailable();
        const requestRecord = readRecord(request, ["text", "reading", "matches"], ["text"]);
        if (!requestRecord || typeof requestRecord.text !== "string" ||
          requestRecord.text.length < 1 || requestRecord.text.length > 20_000) return unavailable();
        const expectedReading = readingIdentity(requestRecord.reading);
        const matches = canonicalMatches(requestRecord.matches, requestRecord.text);
        if (expectedReading === null || matches === null) return unavailable();

        const loaded = await load();
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
              resolution = resolveProductionHoidEntities(progress, { text: alias, maxResults: 10 });
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
