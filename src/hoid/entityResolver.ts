import { HoidKnowledgeCatalog, type HoidKnowledgeEntry, type HoidKnowledgeKind } from "./catalog";
import { HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import {
  canonicalEvidenceScope,
  evidenceCitationFor,
  isEvidenceUnlocked,
  type HoidEvidenceCitation,
} from "./evidenceScope";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { createHoidEvidenceRuntime } from "./evidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

const KNOWLEDGE_KEYS = [
  "id", "aliases", "kind", "firstSafeAppearance",
  "evidenceSource", "evidenceUnlock", "summary", "provenance",
] as const;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const KINDS = new Set<HoidKnowledgeKind>([
  "character", "place", "event", "concept", "magic", "organization", "object",
]);
const MAX_ENTRIES = 512;
const MAX_ALIASES = 64;
const MAX_ALIAS_LENGTH = 256;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_QUERY_LENGTH = 256;
const MAX_RESULTS = 10;
const DEFAULT_RESULTS = 5;

export type HoidEntityResolutionQuery = Readonly<{
  text: string;
  kind?: HoidKnowledgeKind;
  maxResults?: number;
}>;

export type HoidResolvedEntitySource = HoidEvidenceCitation & Readonly<{
  editionId: string;
  navigationSha256: string;
  documentSha256: string;
}>;

export type HoidResolvedEntity = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
  matchedAlias: string;
  source: HoidResolvedEntitySource;
}>;

export type HoidEntityResolutionResult =
  | Readonly<{
      status: "ready";
      resolution: "matched" | "ambiguous" | "not-found";
      progressRevision: number;
      progressFingerprint: string;
      matches: readonly HoidResolvedEntity[];
      truncated: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-query" | "invalid-knowledge" | "invalid-progress";
    }>;

type CanonicalQuery = Readonly<{
  normalizedText: string;
  kind?: HoidKnowledgeKind;
  maxResults: number;
}>;

function canonicalRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalOptionalRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length > allowedKeys.length) return null;

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

function canonicalDenseArray(value: unknown, min: number, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < min || value.length > max) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

/**
 * NFKD + mark/format folding gives deterministic exact alias matching across
 * accent and invisible-format variations. This is deliberately not fuzzy:
 * partial names, edit distance and provider-generated candidates are excluded.
 */
function normalizeAlias(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{Cf}\p{Mn}]/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function canonicalQuery(value: unknown): CanonicalQuery | null {
  const record = canonicalOptionalRecord(value, ["text", "kind", "maxResults"], ["text"]);
  if (!record || typeof record.text !== "string") return null;
  const text = record.text;
  if (
    text.length < 1 ||
    text.length > MAX_QUERY_LENGTH ||
    text !== text.trim() ||
    /[\u0000-\u001F\u007F]/u.test(text)
  ) return null;
  const normalizedText = normalizeAlias(text);
  if (!normalizedText || normalizedText.length > MAX_QUERY_LENGTH) return null;

  const kind = record.kind;
  if (kind !== undefined && (typeof kind !== "string" || !KINDS.has(kind as HoidKnowledgeKind))) {
    return null;
  }
  const maxResults = record.maxResults === undefined ? DEFAULT_RESULTS : record.maxResults;
  if (
    typeof maxResults !== "number" ||
    !Number.isSafeInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > MAX_RESULTS
  ) return null;

  return Object.freeze({
    normalizedText,
    ...(kind === undefined ? {} : { kind: kind as HoidKnowledgeKind }),
    maxResults,
  });
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  const rawEntries = canonicalDenseArray(value, 0, MAX_ENTRIES);
  if (!rawEntries) return null;

  const entries: HoidKnowledgeEntry[] = [];
  const ids = new Set<string>();

  for (const raw of rawEntries) {
    const record = canonicalRecord(raw, KNOWLEDGE_KEYS);
    if (!record) return null;

    const id = record.id;
    const kind = record.kind;
    const provenance = record.provenance;
    const summary = record.summary;
    if (
      typeof id !== "string" ||
      id.length > 128 ||
      !ID_PATTERN.test(id) ||
      ids.has(id) ||
      typeof kind !== "string" ||
      !KINDS.has(kind as HoidKnowledgeKind) ||
      provenance !== "verified" ||
      typeof summary !== "string" ||
      summary.length < 1 ||
      summary.length > MAX_SUMMARY_LENGTH ||
      summary !== summary.trim() ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(summary)
    ) return null;

    const aliases = canonicalDenseArray(record.aliases, 1, MAX_ALIASES);
    if (!aliases) return null;
    const normalizedAliases = new Set<string>();
    const safeAliases: string[] = [];
    for (const alias of aliases) {
      if (
        typeof alias !== "string" ||
        alias.length > MAX_ALIAS_LENGTH ||
        alias.length < 1 ||
        alias !== alias.trim() ||
        /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias)
      ) return null;
      const normalized = normalizeAlias(alias);
      if (!normalized || normalizedAliases.has(normalized)) return null;
      normalizedAliases.add(normalized);
      safeAliases.push(alias);
    }

    const appearance = canonicalRecord(record.firstSafeAppearance, ["bookId", "chapter"]);
    if (
      !appearance ||
      typeof appearance.bookId !== "string" ||
      appearance.bookId !== appearance.bookId.trim() ||
      typeof appearance.chapter !== "number" ||
      !Number.isSafeInteger(appearance.chapter) ||
      appearance.chapter < 1
    ) return null;

    const scope = canonicalEvidenceScope(record.evidenceSource, record.evidenceUnlock);
    if (
      !scope ||
      scope.sourceBookId !== appearance.bookId ||
      scope.sourceChapter !== appearance.chapter
    ) return null;

    const manifestResult = getHoidReadingManifest(scope.sourceBookId);
    if (manifestResult.status !== "ready") return null;
    const documentSha256 = getVerifiedChapterDocumentSha256(
      scope.sourceBookId,
      manifestResult.manifest.editionId,
      manifestResult.manifest.navigationSha256,
      scope.sourceChapter,
    );
    if (!documentSha256) return null;

    entries.push(Object.freeze({
      id,
      aliases: Object.freeze(safeAliases) as unknown as string[],
      kind: kind as HoidKnowledgeKind,
      firstSafeAppearance: Object.freeze({
        bookId: scope.sourceBookId,
        chapter: scope.sourceChapter,
      }),
      evidenceSource: Object.freeze({
        bookId: scope.sourceBookId,
        chapter: scope.sourceChapter,
        locatorId: scope.locatorId,
      }),
      evidenceUnlock: Object.freeze({
        bookId: scope.unlockBookId,
        chapter: scope.unlockChapter,
      }),
      summary,
      provenance: "verified",
    }));
    ids.add(id);
  }

  // Reuse the strict evidence runtime's complete catalog validator after the
  // accessor-free canonicalization above. No selector or provider is supplied.
  if (!createHoidEvidenceRuntime({ knowledge: entries, claims: [], selector: null })) return null;
  return Object.freeze(entries);
}

function unavailable(reason: "invalid-query" | "invalid-knowledge" | "invalid-progress"): HoidEntityResolutionResult {
  return Object.freeze({ status: "unavailable", reason });
}

function resolve(
  knowledgeInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityResolutionResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");

  const knowledge = canonicalKnowledge(knowledgeInput);
  if (!knowledge) return unavailable("invalid-knowledge");

  // Validate the v2 snapshot exactly once. All matching below uses this
  // completed-through projection; an open chapter is never treated as read.
  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return unavailable("invalid-progress");

  const reading = [...projection.reading];
  const catalog = new HoidKnowledgeCatalog([...knowledge]);
  const safeEntries = catalog.entriesForContext(reading)
    .filter(entry => isEvidenceUnlocked(entry, reading));

  const matches: HoidResolvedEntity[] = [];
  for (const entry of safeEntries) {
    if (query.kind !== undefined && entry.kind !== query.kind) continue;
    const matchedAlias = entry.aliases.find(alias => normalizeAlias(alias) === query.normalizedText);
    if (!matchedAlias) continue;

    const citation = evidenceCitationFor(entry);
    const manifestResult = getHoidReadingManifest(entry.evidenceSource?.bookId);
    if (!citation || manifestResult.status !== "ready") return unavailable("invalid-knowledge");
    const documentSha256 = getVerifiedChapterDocumentSha256(
      entry.evidenceSource?.bookId,
      manifestResult.manifest.editionId,
      manifestResult.manifest.navigationSha256,
      entry.evidenceSource?.chapter,
    );
    if (!documentSha256) return unavailable("invalid-knowledge");

    matches.push(Object.freeze({
      id: entry.id,
      kind: entry.kind,
      matchedAlias,
      source: Object.freeze({
        ...citation,
        editionId: manifestResult.manifest.editionId,
        navigationSha256: manifestResult.manifest.navigationSha256,
        documentSha256,
      }),
    }));
  }

  matches.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const truncated = matches.length > query.maxResults;
  const visibleMatches = Object.freeze(matches.slice(0, query.maxResults));
  const resolution = visibleMatches.length === 0
    ? "not-found"
    : visibleMatches.length === 1 && !truncated
      ? "matched"
      : "ambiguous";

  return Object.freeze({
    status: "ready",
    resolution,
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    matches: visibleMatches,
    truncated,
  });
}

/**
 * Resolve exact names and aliases only among entries whose source document,
 * first appearance, full-summary unlock threshold and v2 reading boundary are
 * all verified. A locked alias and an unknown alias produce the same
 * not-found result; hidden catalog entries never affect visible candidates.
 *
 * This generic entry point is intended for controlled composition and tests.
 * Production UI must use resolveProductionHoidEntities(), which is bound to the
 * source-controlled editorial registry.
 */
export function resolveHoidAuthorizedEntities(
  knowledgeInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityResolutionResult {
  return resolve(knowledgeInput, progressInput, queryInput);
}

/** Production entity resolution bound to the local editorial registry. */
export function resolveProductionHoidEntities(
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityResolutionResult {
  return resolve(HOID_EDITORIAL_KNOWLEDGE, progressInput, queryInput);
}
