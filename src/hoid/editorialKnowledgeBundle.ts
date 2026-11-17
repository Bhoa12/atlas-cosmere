import {
  validateHoidEditorialDraftBatch,
  type HoidEditorialDraft,
} from "./editorialDrafts";
import {
  validateHoidEditorialClaimDraftBatch,
  type HoidEditorialClaimDraft,
} from "./editorialClaimDrafts";
import {
  validateHoidEditorialEntityDraftBatch,
  type HoidEditorialEntityDraft,
} from "./editorialEntityDrafts";
import {
  validateHoidEditorialRelationshipDraftBatch,
  type HoidEditorialRelationshipDraft,
} from "./editorialRelationshipDrafts";
import { sha256Hex } from "./sha256";

type BundleRecordKind = "summary" | "atomic-claim" | "entity" | "relationship";

export type HoidEditorialKnowledgeBundleRecord = Readonly<{
  kind: BundleRecordKind;
  id: string;
  recordSha256: string;
}>;

export type HoidEditorialKnowledgeBundleSource = Readonly<{
  bookId: string;
  chapter: number;
  locatorId: string;
  unlockBookId: string;
  unlockChapter: number;
  editionId: string;
  navigationSha256: string;
  documentSha256: string;
}>;

export type HoidEditorialKnowledgeBundleBlocker = Readonly<{
  code:
    | "claim-subject-missing"
    | "claim-subject-kind-mismatch"
    | "relationship-participant-missing"
    | "relationship-participant-kind-mismatch";
  recordId: string;
  relatedId: string;
}>;

export type HoidEditorialKnowledgeBundleManifest = Readonly<{
  schemaVersion: 1;
  status: "ready-for-review" | "blocked";
  records: readonly HoidEditorialKnowledgeBundleRecord[];
  sources: readonly HoidEditorialKnowledgeBundleSource[];
  blockers: readonly HoidEditorialKnowledgeBundleBlocker[];
  fingerprint: string;
}>;

export type HoidEditorialKnowledgeBundleBuildResult =
  | Readonly<{
      status: "ready-for-review";
      manifest: HoidEditorialKnowledgeBundleManifest;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      manifest: HoidEditorialKnowledgeBundleManifest;
      blockers: readonly HoidEditorialKnowledgeBundleBlocker[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input"
        | "invalid-summaries"
        | "invalid-claims"
        | "invalid-entities"
        | "invalid-relationships";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidEditorialKnowledgeBundleValidation =
  | Readonly<{
      status: "valid";
      bundleStatus: "ready-for-review" | "blocked";
      manifest: HoidEditorialKnowledgeBundleManifest;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-manifest" | "bundle-fingerprint-mismatch" | "bundle-content-mismatch";
    }>;

type CanonicalBundleInput = Readonly<{
  summaries: readonly unknown[];
  claims: readonly unknown[];
  entities: readonly unknown[];
  relationships: readonly unknown[];
}>;

const INPUT_KEYS = new Set(["summaries", "claims", "entities", "relationships"]);
const MANIFEST_KEYS = new Set(["schemaVersion", "status", "records", "sources", "blockers", "fingerprint"]);
const RECORD_KEYS = new Set(["kind", "id", "recordSha256"]);
const SOURCE_KEYS = new Set([
  "bookId", "chapter", "locatorId", "unlockBookId", "unlockChapter",
  "editionId", "navigationSha256", "documentSha256",
]);
const BLOCKER_KEYS = new Set(["code", "recordId", "relatedId"]);
const RECORD_KINDS = new Set<BundleRecordKind>(["summary", "atomic-claim", "entity", "relationship"]);
const BLOCKER_CODES = new Set([
  "claim-subject-missing",
  "claim-subject-kind-mismatch",
  "relationship-participant-missing",
  "relationship-participant-kind-mismatch",
]);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const MAX_RECORDS = 2_048;
const MAX_SOURCES = 2_048;
const MAX_BLOCKERS = 4_096;

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > max || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
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
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalInput(value: unknown): CanonicalBundleInput | null {
  const raw = canonicalRecord(value, INPUT_KEYS);
  if (!raw) return null;
  const summaries = canonicalDenseArray(raw.summaries, 512);
  const claims = canonicalDenseArray(raw.claims, 512);
  const entities = canonicalDenseArray(raw.entities, 512);
  const relationships = canonicalDenseArray(raw.relationships, 512);
  if (!summaries || !claims || !entities || !relationships) return null;
  return Object.freeze({ summaries, claims, entities, relationships });
}

function sourceFromEvidence(
  evidence: Readonly<{
    source: Readonly<{ bookId: string; chapter: number; locatorId: string }>;
    unlock: Readonly<{ bookId: string; chapter: number }>;
    sourceIntegrity: Readonly<{
      editionId: string;
      navigationSha256: string;
      documentSha256: string;
    }>;
  }>,
): HoidEditorialKnowledgeBundleSource {
  return Object.freeze({
    bookId: evidence.source.bookId,
    chapter: evidence.source.chapter,
    locatorId: evidence.source.locatorId,
    unlockBookId: evidence.unlock.bookId,
    unlockChapter: evidence.unlock.chapter,
    editionId: evidence.sourceIntegrity.editionId,
    navigationSha256: evidence.sourceIntegrity.navigationSha256,
    documentSha256: evidence.sourceIntegrity.documentSha256,
  });
}

function sourceKey(source: HoidEditorialKnowledgeBundleSource): string {
  return JSON.stringify([
    source.bookId,
    source.chapter,
    source.locatorId,
    source.unlockBookId,
    source.unlockChapter,
    source.editionId,
    source.navigationSha256,
    source.documentSha256,
  ]);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function summaryRecordSha256(draft: HoidEditorialDraft): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-summary-record-v1",
    draft.id,
    draft.kind,
    draft.aliases,
    draft.firstSafeAppearance,
    draft.evidenceSource,
    draft.evidenceUnlock,
    draft.sourceIntegrity,
    draft.summaryIntegrity,
  ]));
}

function collectSources(
  summaries: readonly HoidEditorialDraft[],
  claims: readonly HoidEditorialClaimDraft[],
  entities: readonly HoidEditorialEntityDraft[],
  relationships: readonly HoidEditorialRelationshipDraft[],
): readonly HoidEditorialKnowledgeBundleSource[] {
  const byKey = new Map<string, HoidEditorialKnowledgeBundleSource>();
  const add = (source: HoidEditorialKnowledgeBundleSource): void => {
    byKey.set(sourceKey(source), source);
  };

  for (const draft of summaries) {
    add(sourceFromEvidence({
      source: draft.evidenceSource,
      unlock: draft.evidenceUnlock,
      sourceIntegrity: draft.sourceIntegrity,
    }));
  }
  for (const draft of claims) for (const evidence of draft.evidence) add(sourceFromEvidence(evidence));
  for (const draft of entities) for (const evidence of draft.evidence) add(sourceFromEvidence(evidence));
  for (const draft of relationships) for (const evidence of draft.evidence) add(sourceFromEvidence(evidence));

  return Object.freeze([...byKey.values()].sort((left, right) =>
    compareText(sourceKey(left), sourceKey(right)),
  ));
}

function collectRecords(
  summaries: readonly HoidEditorialDraft[],
  claims: readonly HoidEditorialClaimDraft[],
  entities: readonly HoidEditorialEntityDraft[],
  relationships: readonly HoidEditorialRelationshipDraft[],
): readonly HoidEditorialKnowledgeBundleRecord[] {
  const records: HoidEditorialKnowledgeBundleRecord[] = [];
  for (const draft of summaries) {
    records.push(Object.freeze({
      kind: "summary",
      id: draft.id,
      recordSha256: summaryRecordSha256(draft),
    }));
  }
  for (const draft of claims) {
    records.push(Object.freeze({
      kind: "atomic-claim",
      id: draft.id,
      recordSha256: draft.integrity.claimSha256,
    }));
  }
  for (const draft of entities) {
    records.push(Object.freeze({
      kind: "entity",
      id: draft.id,
      recordSha256: draft.integrity.draftSha256,
    }));
  }
  for (const draft of relationships) {
    records.push(Object.freeze({
      kind: "relationship",
      id: draft.id,
      recordSha256: draft.integrity.claimSha256,
    }));
  }
  records.sort((left, right) =>
    compareText(left.kind, right.kind) || compareText(left.id, right.id),
  );
  return Object.freeze(records);
}

function collectBlockers(
  claims: readonly HoidEditorialClaimDraft[],
  entities: readonly HoidEditorialEntityDraft[],
  relationships: readonly HoidEditorialRelationshipDraft[],
): readonly HoidEditorialKnowledgeBundleBlocker[] {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const blockers: HoidEditorialKnowledgeBundleBlocker[] = [];

  for (const claim of claims) {
    const subject = entityById.get(claim.subjectId);
    if (!subject) {
      blockers.push(Object.freeze({
        code: "claim-subject-missing",
        recordId: claim.id,
        relatedId: claim.subjectId,
      }));
    } else if (subject.kind !== claim.subjectKind) {
      blockers.push(Object.freeze({
        code: "claim-subject-kind-mismatch",
        recordId: claim.id,
        relatedId: claim.subjectId,
      }));
    }
  }

  for (const relationship of relationships) {
    for (const participant of [relationship.subject, relationship.object]) {
      const entity = entityById.get(participant.id);
      if (!entity) {
        blockers.push(Object.freeze({
          code: "relationship-participant-missing",
          recordId: relationship.id,
          relatedId: participant.id,
        }));
      } else if (entity.kind !== participant.kind) {
        blockers.push(Object.freeze({
          code: "relationship-participant-kind-mismatch",
          recordId: relationship.id,
          relatedId: participant.id,
        }));
      }
    }
  }

  const unique = new Map<string, HoidEditorialKnowledgeBundleBlocker>();
  for (const blocker of blockers) {
    unique.set([blocker.code, blocker.recordId, blocker.relatedId].join("\n"), blocker);
  }
  return Object.freeze([...unique.values()].sort((left, right) =>
    compareText(left.code, right.code) ||
    compareText(left.recordId, right.recordId) ||
    compareText(left.relatedId, right.relatedId),
  ));
}

function bundleFingerprint(
  status: HoidEditorialKnowledgeBundleManifest["status"],
  records: readonly HoidEditorialKnowledgeBundleRecord[],
  sources: readonly HoidEditorialKnowledgeBundleSource[],
  blockers: readonly HoidEditorialKnowledgeBundleBlocker[],
): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-knowledge-bundle-v1",
    status,
    records,
    sources,
    blockers,
  ]));
}

function invalid(
  reason: Extract<HoidEditorialKnowledgeBundleBuildResult, { status: "invalid" }>["reason"],
): HoidEditorialKnowledgeBundleBuildResult {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Builds a metadata-only manifest for the complete editorial staging set.
 * It includes summary, atomic-claim, entity and relationship identities plus
 * exact source scopes, but never embeds summary/claim prose or source passages.
 * A ready manifest means only "ready for editorial review", not approval or
 * permission to write to production.
 */
export function buildHoidEditorialKnowledgeBundle(
  input: unknown,
): HoidEditorialKnowledgeBundleBuildResult {
  const canonical = canonicalInput(input);
  if (!canonical) return invalid("invalid-input");

  const summaryBatch = validateHoidEditorialDraftBatch(canonical.summaries);
  if (summaryBatch.status !== "valid") return invalid("invalid-summaries");
  const claimBatch = validateHoidEditorialClaimDraftBatch(canonical.claims);
  if (claimBatch.status !== "valid") return invalid("invalid-claims");
  const entityBatch = validateHoidEditorialEntityDraftBatch(canonical.entities);
  if (entityBatch.status !== "valid") return invalid("invalid-entities");
  const relationshipBatch = validateHoidEditorialRelationshipDraftBatch(canonical.relationships);
  if (relationshipBatch.status !== "valid") return invalid("invalid-relationships");

  const summaries = summaryBatch.drafts;
  const claims = claimBatch.drafts;
  const entities = entityBatch.drafts;
  const relationships = relationshipBatch.drafts;
  const records = collectRecords(summaries, claims, entities, relationships);
  if (records.length > MAX_RECORDS) return invalid("invalid-input");

  const sources = collectSources(summaries, claims, entities, relationships);
  if (sources.length > MAX_SOURCES) return invalid("invalid-input");

  const blockers = collectBlockers(claims, entities, relationships);
  if (blockers.length > MAX_BLOCKERS) return invalid("invalid-input");

  const status = blockers.length === 0 ? "ready-for-review" : "blocked";
  const manifest: HoidEditorialKnowledgeBundleManifest = Object.freeze({
    schemaVersion: 1,
    status,
    records,
    sources,
    blockers,
    fingerprint: bundleFingerprint(status, records, sources, blockers),
  });

  return status === "ready-for-review"
    ? Object.freeze({
        status,
        manifest,
        promotionAllowed: false,
        productionWritePerformed: false,
      })
    : Object.freeze({
        status,
        manifest,
        blockers,
        promotionAllowed: false,
        productionWritePerformed: false,
      });
}

function canonicalManifest(value: unknown): HoidEditorialKnowledgeBundleManifest | null {
  const raw = canonicalRecord(value, MANIFEST_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    (raw.status !== "ready-for-review" && raw.status !== "blocked") ||
    typeof raw.fingerprint !== "string" ||
    !SHA_PATTERN.test(raw.fingerprint)
  ) return null;

  const rawRecords = canonicalDenseArray(raw.records, MAX_RECORDS);
  const rawSources = canonicalDenseArray(raw.sources, MAX_SOURCES);
  const rawBlockers = canonicalDenseArray(raw.blockers, MAX_BLOCKERS);
  if (!rawRecords || !rawSources || !rawBlockers) return null;

  const records: HoidEditorialKnowledgeBundleRecord[] = [];
  for (const item of rawRecords) {
    const record = canonicalRecord(item, RECORD_KEYS);
    if (
      !record ||
      typeof record.kind !== "string" ||
      !RECORD_KINDS.has(record.kind as BundleRecordKind) ||
      typeof record.id !== "string" ||
      !ID_PATTERN.test(record.id) ||
      typeof record.recordSha256 !== "string" ||
      !SHA_PATTERN.test(record.recordSha256)
    ) return null;
    records.push(Object.freeze({
      kind: record.kind as BundleRecordKind,
      id: record.id,
      recordSha256: record.recordSha256,
    }));
  }

  const sources: HoidEditorialKnowledgeBundleSource[] = [];
  for (const item of rawSources) {
    const source = canonicalRecord(item, SOURCE_KEYS);
    if (
      !source ||
      typeof source.bookId !== "string" ||
      !ID_PATTERN.test(source.bookId) ||
      !Number.isSafeInteger(source.chapter) ||
      (source.chapter as number) < 1 ||
      typeof source.locatorId !== "string" ||
      !source.locatorId.trim() ||
      source.locatorId.length > 512 ||
      typeof source.unlockBookId !== "string" ||
      !ID_PATTERN.test(source.unlockBookId) ||
      !Number.isSafeInteger(source.unlockChapter) ||
      (source.unlockChapter as number) < 1 ||
      typeof source.editionId !== "string" ||
      !source.editionId.trim() ||
      source.editionId.length > 128 ||
      typeof source.navigationSha256 !== "string" ||
      !SHA_PATTERN.test(source.navigationSha256) ||
      typeof source.documentSha256 !== "string" ||
      !SHA_PATTERN.test(source.documentSha256)
    ) return null;
    sources.push(Object.freeze({
      bookId: source.bookId,
      chapter: source.chapter as number,
      locatorId: source.locatorId,
      unlockBookId: source.unlockBookId,
      unlockChapter: source.unlockChapter as number,
      editionId: source.editionId,
      navigationSha256: source.navigationSha256,
      documentSha256: source.documentSha256,
    }));
  }

  const blockers: HoidEditorialKnowledgeBundleBlocker[] = [];
  for (const item of rawBlockers) {
    const blocker = canonicalRecord(item, BLOCKER_KEYS);
    if (
      !blocker ||
      typeof blocker.code !== "string" ||
      !BLOCKER_CODES.has(blocker.code) ||
      typeof blocker.recordId !== "string" ||
      !ID_PATTERN.test(blocker.recordId) ||
      typeof blocker.relatedId !== "string" ||
      !ID_PATTERN.test(blocker.relatedId)
    ) return null;
    blockers.push(Object.freeze({
      code: blocker.code as HoidEditorialKnowledgeBundleBlocker["code"],
      recordId: blocker.recordId,
      relatedId: blocker.relatedId,
    }));
  }

  const expectedStatus = blockers.length === 0 ? "ready-for-review" : "blocked";
  if (raw.status !== expectedStatus) return null;
  return Object.freeze({
    schemaVersion: 1,
    status: expectedStatus,
    records: Object.freeze(records),
    sources: Object.freeze(sources),
    blockers: Object.freeze(blockers),
    fingerprint: raw.fingerprint,
  });
}

/** Rebuild and compare a manifest against the exact source drafts supplied. */
export function validateHoidEditorialKnowledgeBundleManifest(
  manifestInput: unknown,
  sourceInput: unknown,
): HoidEditorialKnowledgeBundleValidation {
  const manifest = canonicalManifest(manifestInput);
  if (!manifest) return Object.freeze({ status: "invalid", reason: "invalid-manifest" });

  const rebuilt = buildHoidEditorialKnowledgeBundle(sourceInput);
  if (rebuilt.status === "invalid") {
    return Object.freeze({ status: "invalid", reason: "bundle-content-mismatch" });
  }
  if (manifest.fingerprint !== rebuilt.manifest.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "bundle-fingerprint-mismatch" });
  }
  if (JSON.stringify(manifest) !== JSON.stringify(rebuilt.manifest)) {
    return Object.freeze({ status: "invalid", reason: "bundle-content-mismatch" });
  }
  return Object.freeze({
    status: "valid",
    bundleStatus: rebuilt.status,
    manifest: rebuilt.manifest,
  });
}
