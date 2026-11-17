import { HoidKnowledgeCatalog, type HoidKnowledgeEntry, type HoidKnowledgeKind } from "./catalog";
import { HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import {
  HOID_ENTITY_ALIAS_EVIDENCE,
  type HoidEntityAliasEvidence,
  type HoidEntityAliasRecord,
} from "./entityAliasRegistry";
import {
  canonicalEvidenceScope,
  evidenceCitationFor,
  isEvidenceUnlocked,
  type CanonicalHoidEvidenceScope,
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
const MAX_ALIAS_RECORDS = 2_048;
const MAX_ALIAS_EVIDENCE = 8;
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

export type HoidResolvedAliasEvidence = Readonly<{
  evidenceId: string;
  source: HoidResolvedEntitySource;
}>;

export type HoidResolvedEntity = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
  matchedAlias: string;
  entitySource: HoidResolvedEntitySource;
  /** Every alias disclosure source is returned for audit; all must be unlocked. */
  aliasEvidence: readonly HoidResolvedAliasEvidence[];
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

type CanonicalAliasEvidence = Readonly<{
  id: string;
  scope: CanonicalHoidEvidenceScope;
  source: HoidResolvedEntitySource;
}>;

type CanonicalAliasRecord = Readonly<{
  id: string;
  entityId: string;
  alias: string;
  normalizedAlias: string;
  evidence: readonly CanonicalAliasEvidence[];
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

function sourceForEntry(entry: HoidKnowledgeEntry): HoidResolvedEntitySource | null {
  const citation = evidenceCitationFor(entry);
  const bookId = entry.evidenceSource?.bookId;
  const chapter = entry.evidenceSource?.chapter;
  const manifestResult = getHoidReadingManifest(bookId);
  if (!citation || manifestResult.status !== "ready") return null;
  const documentSha256 = getVerifiedChapterDocumentSha256(
    bookId,
    manifestResult.manifest.editionId,
    manifestResult.manifest.navigationSha256,
    chapter,
  );
  if (!documentSha256) return null;
  return Object.freeze({
    ...citation,
    editionId: manifestResult.manifest.editionId,
    navigationSha256: manifestResult.manifest.navigationSha256,
    documentSha256,
  });
}

function canonicalAliasRecords(
  value: unknown,
  knowledge: readonly HoidKnowledgeEntry[],
): readonly CanonicalAliasRecord[] | null {
  const rawRecords = canonicalDenseArray(value, 0, MAX_ALIAS_RECORDS);
  if (!rawRecords) return null;
  const knowledgeById = new Map(knowledge.map(entry => [entry.id, entry]));
  const recordIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const entityAliases = new Set<string>();
  const records: CanonicalAliasRecord[] = [];

  for (const raw of rawRecords) {
    const record = canonicalRecord(raw, ["id", "entityId", "alias", "evidence"]);
    const id = record?.id;
    const entityId = record?.entityId;
    const alias = record?.alias;
    if (
      !record ||
      typeof id !== "string" ||
      !ID_PATTERN.test(id) ||
      recordIds.has(id) ||
      typeof entityId !== "string" ||
      !ID_PATTERN.test(entityId) ||
      typeof alias !== "string" ||
      alias.length < 1 ||
      alias.length > MAX_ALIAS_LENGTH ||
      alias !== alias.trim() ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias)
    ) return null;

    const entity = knowledgeById.get(entityId);
    if (!entity || !entity.aliases.includes(alias)) return null;
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) return null;
    const entityAliasKey = entityId + "\n" + normalizedAlias;
    if (entityAliases.has(entityAliasKey)) return null;

    const rawEvidence = canonicalDenseArray(record.evidence, 1, MAX_ALIAS_EVIDENCE);
    if (!rawEvidence) return null;
    const evidence: CanonicalAliasEvidence[] = [];
    for (const rawItem of rawEvidence) {
      const item = canonicalRecord(rawItem, ["id", "source", "unlock"]);
      const evidenceId = item?.id;
      if (
        !item ||
        typeof evidenceId !== "string" ||
        !ID_PATTERN.test(evidenceId) ||
        evidenceIds.has(evidenceId)
      ) return null;

      const scope = canonicalEvidenceScope(item.source, item.unlock);
      if (!scope) return null;
      const manifestResult = getHoidReadingManifest(scope.sourceBookId);
      if (manifestResult.status !== "ready") return null;
      const documentSha256 = getVerifiedChapterDocumentSha256(
        scope.sourceBookId,
        manifestResult.manifest.editionId,
        manifestResult.manifest.navigationSha256,
        scope.sourceChapter,
      );
      if (!documentSha256) return null;

      const source: HoidResolvedEntitySource = Object.freeze({
        evidenceId,
        sourceBookId: scope.sourceBookId,
        sourceChapter: scope.sourceChapter,
        locatorId: scope.locatorId,
        unlockBookId: scope.unlockBookId,
        unlockChapter: scope.unlockChapter,
        editionId: manifestResult.manifest.editionId,
        navigationSha256: manifestResult.manifest.navigationSha256,
        documentSha256,
      });
      evidence.push(Object.freeze({ id: evidenceId, scope, source }));
      evidenceIds.add(evidenceId);
    }

    records.push(Object.freeze({
      id,
      entityId,
      alias,
      normalizedAlias,
      evidence: Object.freeze(evidence),
    }));
    recordIds.add(id);
    entityAliases.add(entityAliasKey);
  }

  return Object.freeze(records);
}

function aliasEvidenceIsUnlocked(
  evidence: CanonicalAliasEvidence,
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[],
): boolean {
  const position = reading.find(item => item.bookId === evidence.scope.unlockBookId);
  return Boolean(
    position &&
    (position.completed === true ||
      (typeof position.chapter === "number" && position.chapter >= evidence.scope.unlockChapter)),
  );
}

function unavailable(reason: "invalid-query" | "invalid-knowledge" | "invalid-progress"): HoidEntityResolutionResult {
  return Object.freeze({ status: "unavailable", reason });
}

function resolve(
  knowledgeInput: unknown,
  aliasEvidenceInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityResolutionResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");

  const knowledge = canonicalKnowledge(knowledgeInput);
  if (!knowledge) return unavailable("invalid-knowledge");
  const aliasRecords = canonicalAliasRecords(aliasEvidenceInput, knowledge);
  if (!aliasRecords) return unavailable("invalid-knowledge");

  // Validate the v2 snapshot exactly once. All matching below uses this
  // completed-through projection; an open chapter is never treated as read.
  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return unavailable("invalid-progress");

  const reading = [...projection.reading];
  const catalog = new HoidKnowledgeCatalog([...knowledge]);
  const safeEntries = catalog.entriesForContext(reading)
    .filter(entry => isEvidenceUnlocked(entry, reading));
  const safeById = new Map(safeEntries.map(entry => [entry.id, entry]));

  const matches: HoidResolvedEntity[] = [];
  for (const aliasRecord of aliasRecords) {
    const entity = safeById.get(aliasRecord.entityId);
    if (!entity || (query.kind !== undefined && entity.kind !== query.kind)) continue;
    if (aliasRecord.normalizedAlias !== query.normalizedText) continue;
    // Alias disclosure is independent from first appearance and summary
    // unlock. Every alias-specific source is mandatory (AND semantics).
    if (!aliasRecord.evidence.every(item => aliasEvidenceIsUnlocked(item, reading))) continue;

    const entitySource = sourceForEntry(entity);
    if (!entitySource) return unavailable("invalid-knowledge");
    matches.push(Object.freeze({
      id: entity.id,
      kind: entity.kind,
      matchedAlias: aliasRecord.alias,
      entitySource,
      aliasEvidence: Object.freeze(aliasRecord.evidence.map(item => Object.freeze({
        evidenceId: item.id,
        source: item.source,
      }))),
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
 * Resolve exact names and aliases only after both the entity and the alias
 * disclosure are authorized. A locked alias and an unknown alias produce the
 * same not-found result; hidden records never affect visible candidates.
 *
 * This generic entry point is intended for controlled composition and tests.
 * Production UI must use resolveProductionHoidEntities(), which is bound to
 * the source-controlled knowledge and alias registries.
 */
export function resolveHoidAuthorizedEntities(
  knowledgeInput: unknown,
  aliasEvidenceInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityResolutionResult {
  return resolve(knowledgeInput, aliasEvidenceInput, progressInput, queryInput);
}

/** Production entity resolution bound to local source-controlled registries. */
export function resolveProductionHoidEntities(
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityResolutionResult {
  return resolve(
    HOID_EDITORIAL_KNOWLEDGE,
    HOID_ENTITY_ALIAS_EVIDENCE,
    progressInput,
    queryInput,
  );
}
