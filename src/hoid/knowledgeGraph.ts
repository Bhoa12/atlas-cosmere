import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
} from "./evidenceRuntime";
import {
  HoidKnowledgeCatalog,
  type HoidKnowledgeEntry,
  type HoidKnowledgeKind,
} from "./catalog";
import {
  evidenceCitationFor,
  isEvidenceUnlocked,
  type HoidEvidenceCitation,
} from "./evidenceScope";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { HOID_APPROVED_CLAIMS, HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import { sha256Hex } from "./sha256";

export type HoidKnowledgeGraphPredicate =
  | "related-to"
  | "appears-in"
  | "located-in"
  | "member-of"
  | "uses"
  | "participates-in"
  | "created-by"
  | "part-of"
  | "causes"
  | "opposes"
  | "allied-with";

export type HoidKnowledgeGraphRelation = Readonly<{
  id: string;
  subjectId: string;
  predicate: HoidKnowledgeGraphPredicate;
  objectId: string;
  claimId: string;
}>;

export type HoidKnowledgeGraphDefinition = Readonly<{
  schemaVersion: 1;
  relations: readonly HoidKnowledgeGraphRelation[];
}>;

export type HoidKnowledgeGraphNode = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
}>;

export type HoidKnowledgeGraphSource = HoidEvidenceCitation & Readonly<{
  editionId: string;
  navigationSha256: string;
  documentSha256: string;
}>;

export type HoidKnowledgeGraphEdge = Readonly<{
  id: string;
  sourceId: string;
  targetId: string;
  predicate: HoidKnowledgeGraphPredicate;
  claimId: string;
  evidenceIds: readonly string[];
  claimTextSha256: string;
  sources: readonly HoidKnowledgeGraphSource[];
}>;

export type HoidKnowledgeGraphResult =
  | Readonly<{
      status: "ready";
      progressRevision: number;
      progressFingerprint: string;
      nodes: readonly HoidKnowledgeGraphNode[];
      edges: readonly HoidKnowledgeGraphEdge[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-definition" | "invalid-knowledge" | "invalid-claims" | "invalid-progress";
    }>;

const NODE_KINDS = new Set<HoidKnowledgeKind>([
  "character", "place", "event", "concept", "magic", "organization", "object",
]);
const PREDICATES = new Set<HoidKnowledgeGraphPredicate>([
  "related-to", "appears-in", "located-in", "member-of", "uses",
  "participates-in", "created-by", "part-of", "causes", "opposes", "allied-with",
]);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_NODES = 512;
const MAX_CLAIMS = 512;
const MAX_RELATIONS = 1_024;
const MAX_EVIDENCE_IDS = 16;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_CLAIM_TEXT_LENGTH = 4_000;

function canonicalRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) {
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

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128 && ID_PATTERN.test(value);
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  const rawEntries = canonicalDenseArray(value, 0, MAX_NODES);
  if (!rawEntries) return null;

  const entries: HoidKnowledgeEntry[] = [];
  const seen = new Set<string>();
  for (const raw of rawEntries) {
    const record = canonicalRecord(raw, [
      "id", "aliases", "kind", "firstSafeAppearance",
      "evidenceSource", "evidenceUnlock", "summary", "provenance",
    ]);
    const id = record?.id;
    if (!record || !validId(id) || seen.has(id)) return null;
    const kind = record.kind;
    if (typeof kind !== "string" || !NODE_KINDS.has(kind as HoidKnowledgeKind)) return null;
    if (record.provenance !== "verified") return null;

    const aliases = canonicalDenseArray(record.aliases, 1, 64);
    if (!aliases || !aliases.every(alias =>
      typeof alias === "string" && alias.trim().length > 0 && alias.length <= 256
    )) return null;

    const appearance = canonicalRecord(record.firstSafeAppearance, ["bookId", "chapter"]);
    const source = canonicalRecord(record.evidenceSource, ["bookId", "chapter", "locatorId"]);
    const unlock = canonicalRecord(record.evidenceUnlock, ["bookId", "chapter"]);
    if (!appearance || !source || !unlock) return null;

    const bookId = typeof source.bookId === "string" ? source.bookId : "";
    const sourceChapter = source.chapter;
    const locatorId = typeof source.locatorId === "string" ? source.locatorId : "";
    const appearanceBookId = typeof appearance.bookId === "string" ? appearance.bookId : "";
    const appearanceChapter = appearance.chapter;
    const unlockBookId = typeof unlock.bookId === "string" ? unlock.bookId : "";
    const unlockChapter = unlock.chapter;
    const summary = typeof record.summary === "string" ? record.summary : "";
    if (
      !bookId || bookId !== bookId.trim() ||
      !locatorId || locatorId !== locatorId.trim() || locatorId.length > 256 ||
      appearanceBookId !== bookId ||
      appearanceChapter !== sourceChapter ||
      unlockBookId !== bookId ||
      typeof sourceChapter !== "number" || !Number.isSafeInteger(sourceChapter) || sourceChapter < 1 ||
      typeof appearanceChapter !== "number" || !Number.isSafeInteger(appearanceChapter) || appearanceChapter < 1 ||
      typeof unlockChapter !== "number" || !Number.isSafeInteger(unlockChapter) || unlockChapter < sourceChapter ||
      summary !== summary.trim() || summary.length < 1 || summary.length > MAX_SUMMARY_LENGTH ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(summary)
    ) return null;

    const manifestResult = getHoidReadingManifest(bookId);
    if (manifestResult.status !== "ready") return null;
    const manifest = manifestResult.manifest;
    const sourceUnit = manifest.units.find(unit => unit.chapterNumber === sourceChapter);
    const unlockUnit = manifest.units.find(unit => unit.chapterNumber === unlockChapter);
    if (!sourceUnit || sourceUnit.locatorId !== locatorId || !unlockUnit) return null;

    // A graph node is accepted only when its first-safe appearance and its
    // inspected summary point to the same individually verified chapter.
    // More complex appearance histories require a future multi-source schema.
    const documentSha256 = getVerifiedChapterDocumentSha256(
      bookId,
      manifest.editionId,
      manifest.navigationSha256,
      sourceChapter,
    );
    if (!documentSha256) return null;

    const entry: HoidKnowledgeEntry = Object.freeze({
      id,
      aliases: Object.freeze([...aliases]) as unknown as string[],
      kind: kind as HoidKnowledgeKind,
      firstSafeAppearance: Object.freeze({ bookId, chapter: sourceChapter }),
      evidenceSource: Object.freeze({ bookId, chapter: sourceChapter, locatorId }),
      evidenceUnlock: Object.freeze({ bookId, chapter: unlockChapter }),
      summary,
      provenance: "verified",
    });
    entries.push(entry);
    seen.add(id);
  }

  return Object.freeze(entries);
}

function canonicalClaims(
  value: unknown,
  knowledgeIds: ReadonlySet<string>,
): readonly HoidApprovedClaim[] | null {
  const rawClaims = canonicalDenseArray(value, 0, MAX_CLAIMS);
  if (!rawClaims) return null;

  const claims: HoidApprovedClaim[] = [];
  const seen = new Set<string>();
  for (const raw of rawClaims) {
    const record = canonicalRecord(raw, ["id", "text", "intent", "evidenceIds", "review"]);
    const id = record?.id;
    if (!record || !validId(id) || seen.has(id)) return null;
    const text = typeof record.text === "string" ? record.text : "";
    const intent = record.intent;
    if (
      !text || text !== text.trim() || text.length > MAX_CLAIM_TEXT_LENGTH ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)
    ) return null;
    if (intent !== "explain" && intent !== "context") return null;

    const evidenceIds = canonicalDenseArray(record.evidenceIds, 2, MAX_EVIDENCE_IDS);
    if (!evidenceIds || !evidenceIds.every(item =>
      typeof item === "string" && validId(item) && knowledgeIds.has(item)
    )) return null;
    const evidence = evidenceIds as readonly string[];
    if (new Set(evidence).size !== evidence.length) return null;

    const review = canonicalRecord(record.review, ["status", "origin", "reviewerId", "reviewedAt"]);
    const reviewerId = review?.reviewerId;
    const reviewedAt = review?.reviewedAt;
    if (
      !review ||
      review.status !== "approved" ||
      review.origin !== "original-editorial" ||
      typeof reviewerId !== "string" ||
      !reviewerId.trim() ||
      reviewerId.length > 128 ||
      typeof reviewedAt !== "string"
    ) return null;
    const reviewedAtMs = Date.parse(reviewedAt);
    if (
      !Number.isFinite(reviewedAtMs) ||
      new Date(reviewedAtMs).toISOString() !== reviewedAt
    ) return null;

    claims.push(Object.freeze({
      id,
      text,
      intent,
      evidenceIds: Object.freeze([...evidence].sort()),
      review: Object.freeze({
        status: "approved",
        origin: "original-editorial",
        reviewerId: reviewerId.trim(),
        reviewedAt,
      }),
    }));
    seen.add(id);
  }
  return Object.freeze(claims);
}

function canonicalDefinition(value: unknown): readonly HoidKnowledgeGraphRelation[] | null {
  const record = canonicalRecord(value, ["schemaVersion", "relations"]);
  if (!record || record.schemaVersion !== 1) return null;
  const rawRelations = canonicalDenseArray(record.relations, 0, MAX_RELATIONS);
  if (!rawRelations) return null;

  const relations: HoidKnowledgeGraphRelation[] = [];
  const ids = new Set<string>();
  const triples = new Set<string>();
  for (const raw of rawRelations) {
    const relation = canonicalRecord(raw, ["id", "subjectId", "predicate", "objectId", "claimId"]);
    const id = relation?.id;
    const subjectId = relation?.subjectId;
    const objectId = relation?.objectId;
    const claimId = relation?.claimId;
    const predicate = relation?.predicate;
    if (
      !relation ||
      !validId(id) ||
      !validId(subjectId) ||
      !validId(objectId) ||
      !validId(claimId) ||
      subjectId === objectId ||
      typeof predicate !== "string" ||
      !PREDICATES.has(predicate as HoidKnowledgeGraphPredicate) ||
      ids.has(id)
    ) return null;

    const triple = [subjectId, predicate, objectId, claimId].join("\n");
    if (triples.has(triple)) return null;
    ids.add(id);
    triples.add(triple);
    relations.push(Object.freeze({
      id,
      subjectId,
      predicate: predicate as HoidKnowledgeGraphPredicate,
      objectId,
      claimId,
    }));
  }
  relations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return Object.freeze(relations);
}

type ReadyHoidProgressProjection = Extract<
  ReturnType<typeof projectHoidCursorProgressSnapshot>,
  { status: "ready" }
>;

function progressFingerprintForProjection(projection: ReadyHoidProgressProjection): string {
  const positions = projection.reading
    .map((position): readonly [string, number | null, boolean, number | null] => [
      position.bookId,
      typeof position.chapter === "number" ? position.chapter : null,
      position.completed === true,
      typeof position.order === "number" ? position.order : null,
    ])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const started = [...projection.startedBookIds].sort();
  return sha256Hex(JSON.stringify([
    "hoid-cursor-progress-fingerprint-v1",
    projection.revision,
    positions,
    started,
  ]));
}

/** Fingerprint a validated v2 snapshot for stale-plan detection. */
export function fingerprintHoidCursorProgressSnapshot(
  value: unknown,
): Readonly<{ status: "ready"; revision: number; sha256: string }> | Readonly<{ status: "unavailable" }> {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return Object.freeze({ status: "unavailable" });
  return Object.freeze({
    status: "ready",
    revision: projection.revision,
    sha256: progressFingerprintForProjection(projection),
  });
}

function unavailable(
  reason: "invalid-definition" | "invalid-knowledge" | "invalid-claims" | "invalid-progress",
): HoidKnowledgeGraphResult {
  return Object.freeze({ status: "unavailable", reason });
}

/**
 * Build a metadata-only graph from source-controlled relation definitions and
 * approved local claims. The graph is never sent to a provider. An edge is
 * returned only when its approved claim, both endpoint nodes and every
 * supporting evidence item are authorized by the same validated v2 snapshot.
 *
 * SHA-256 digests detect source changes; they do not authenticate reviewers.
 * Production callers must use the source-controlled registry and relation
 * definition, not provider-supplied graph data.
 */
export function buildHoidAuthorizedKnowledgeGraph(
  definitionInput: unknown,
  knowledgeInput: unknown,
  claimsInput: unknown,
  progressInput: unknown,
): HoidKnowledgeGraphResult {
  const relations = canonicalDefinition(definitionInput);
  if (!relations) return unavailable("invalid-definition");

  const knowledge = canonicalKnowledge(knowledgeInput);
  if (!knowledge) return unavailable("invalid-knowledge");
  const knowledgeIds = new Set(knowledge.map(entry => entry.id));

  const claims = canonicalClaims(claimsInput, knowledgeIds);
  if (!claims) return unavailable("invalid-claims");

  // Reuse the production runtime's complete contract validator. This is a
  // local validation step only; no selector is configured or invoked.
  if (!createHoidEvidenceRuntime({ knowledge, claims, selector: null })) {
    return unavailable("invalid-claims");
  }

  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return unavailable("invalid-progress");

  const safeReading = [...projection.reading];
  const catalog = new HoidKnowledgeCatalog(knowledge.map(entry => ({ ...entry })));
  const safeEntries = catalog.entriesForContext(safeReading)
    .filter(entry => isEvidenceUnlocked(entry, safeReading));
  const safeById = new Map(safeEntries.map(entry => [entry.id, entry]));
  const claimsById = new Map(claims.map(claim => [claim.id, claim]));
  const knowledgeById = new Map(knowledge.map(entry => [entry.id, entry]));

  const edges: HoidKnowledgeGraphEdge[] = [];
  const nodesById = new Map<string, HoidKnowledgeGraphNode>();

  for (const relation of relations) {
    const claim = claimsById.get(relation.claimId);
    if (!claim) return unavailable("invalid-definition");
    if (
      !knowledgeById.has(relation.subjectId) ||
      !knowledgeById.has(relation.objectId) ||
      !claim.evidenceIds.includes(relation.subjectId) ||
      !claim.evidenceIds.includes(relation.objectId)
    ) return unavailable("invalid-definition");

    // All claim evidence is mandatory. A missing/locked evidence item withholds
    // the entire edge and neither endpoint is emitted as an isolated node.
    if (!claim.evidenceIds.every(id => safeById.has(id))) continue;

    const sourceNode = safeById.get(relation.subjectId);
    const targetNode = safeById.get(relation.objectId);
    if (!sourceNode || !targetNode) continue;

    const sources: HoidKnowledgeGraphSource[] = [];
    for (const evidenceId of claim.evidenceIds) {
      const entry = safeById.get(evidenceId);
      if (!entry) return unavailable("invalid-claims");
      const citation = evidenceCitationFor(entry);
      const manifestResult = getHoidReadingManifest(entry.evidenceSource!.bookId);
      const documentSha256 = getVerifiedChapterDocumentSha256(
        entry.evidenceSource!.bookId,
        manifestResult.status === "ready" ? manifestResult.manifest.editionId : "",
        manifestResult.status === "ready" ? manifestResult.manifest.navigationSha256 : "",
        entry.evidenceSource!.chapter,
      );
      if (!citation || manifestResult.status !== "ready" || !documentSha256) {
        return unavailable("invalid-knowledge");
      }
      sources.push(Object.freeze({
        ...citation,
        editionId: manifestResult.manifest.editionId,
        navigationSha256: manifestResult.manifest.navigationSha256,
        documentSha256,
      }));
    }

    nodesById.set(sourceNode.id, Object.freeze({ id: sourceNode.id, kind: sourceNode.kind }));
    nodesById.set(targetNode.id, Object.freeze({ id: targetNode.id, kind: targetNode.kind }));
    edges.push(Object.freeze({
      id: relation.id,
      sourceId: relation.subjectId,
      targetId: relation.objectId,
      predicate: relation.predicate,
      claimId: claim.id,
      evidenceIds: Object.freeze([...claim.evidenceIds]),
      claimTextSha256: sha256Hex(claim.text),
      sources: Object.freeze(sources),
    }));
  }

  return Object.freeze({
    status: "ready",
    progressRevision: projection.revision,
    progressFingerprint: progressFingerprintForProjection(projection),
    nodes: Object.freeze([...nodesById.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    edges: Object.freeze(edges),
  });
}

/** Production graph definition remains empty until reviewed relations are added. */
export const HOID_KNOWLEDGE_GRAPH_DEFINITION: HoidKnowledgeGraphDefinition = Object.freeze({
  schemaVersion: 1,
  relations: Object.freeze([]),
});


/** Build the production graph exclusively from the source-controlled editorial registry. */
export function buildProductionHoidAuthorizedKnowledgeGraph(
  progressInput: unknown,
): HoidKnowledgeGraphResult {
  return buildHoidAuthorizedKnowledgeGraph(
    HOID_KNOWLEDGE_GRAPH_DEFINITION,
    HOID_EDITORIAL_KNOWLEDGE,
    HOID_APPROVED_CLAIMS,
    progressInput,
  );
}
