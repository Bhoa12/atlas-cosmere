import { parseProgressLedger, type ProgressCatalogBook } from "./progressEngine";

export type KnowledgeEntityKind =
  | "character"
  | "place"
  | "event"
  | "concept"
  | "organization"
  | "object";

export type KnowledgeRelationKind =
  | "related_to"
  | "member_of"
  | "located_in"
  | "appears_in"
  | "participates_in"
  | "uses"
  | "causes"
  | "part_of";

export interface RevealRequirement {
  readonly bookId: string;
  readonly chapter: number;
}

export interface KnowledgeEntity {
  readonly id: string;
  readonly kind: KnowledgeEntityKind;
  readonly label: string;
  readonly revealAfter: readonly RevealRequirement[];
  readonly evidenceIds: readonly string[];
}

export interface KnowledgeRelation {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly kind: KnowledgeRelationKind;
  readonly label: string;
  readonly revealAfter: readonly RevealRequirement[];
  readonly evidenceIds: readonly string[];
}

export interface NarrativeKnowledgeGraph {
  readonly entities: readonly KnowledgeEntity[];
  readonly relations: readonly KnowledgeRelation[];
}

export interface VisibleKnowledgeEntity {
  readonly id: string;
  readonly kind: KnowledgeEntityKind;
  readonly label: string;
  readonly evidenceIds: readonly string[];
}

export interface VisibleKnowledgeRelation {
  readonly id: string;
  readonly fromEntityId: string;
  readonly toEntityId: string;
  readonly kind: KnowledgeRelationKind;
  readonly label: string;
  readonly evidenceIds: readonly string[];
}

export type KnowledgeGraphResult =
  | {
      readonly kind: "neighborhood";
      readonly subject: VisibleKnowledgeEntity;
      readonly relatedEntities: readonly VisibleKnowledgeEntity[];
      readonly relations: readonly VisibleKnowledgeRelation[];
      readonly evidenceIds: readonly string[];
    }
  | {
      readonly kind: "abstain";
      readonly reason:
        | "invalid-catalog"
        | "invalid-progress"
        | "invalid-evidence"
        | "invalid-graph"
        | "unknown-entity"
        | "no-visible-knowledge";
    };

interface EvidenceRecord {
  readonly id: string;
  readonly bookId: string;
  readonly chapter: number;
  readonly accessible: boolean;
  readonly summary: string;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CATALOG_BOOKS = 500;
const MAX_EVIDENCE_ITEMS = 500;
const MAX_ENTITIES = 2_000;
const MAX_RELATIONS = 5_000;
const MAX_REQUIREMENTS = 12;
const MAX_ITEM_EVIDENCE = 12;
const MAX_LABEL_CHARS = 120;
const MAX_SUMMARY_CHARS = 3_000;

const ENTITY_KINDS = new Set<KnowledgeEntityKind>([
  "character", "place", "event", "concept", "organization", "object",
]);
const RELATION_KINDS = new Set<KnowledgeRelationKind>([
  "related_to", "member_of", "located_in", "appears_in",
  "participates_in", "uses", "causes", "part_of",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function readRequirements(value: unknown): RevealRequirement[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REQUIREMENTS) {
    return null;
  }

  const seenBooks = new Set<string>();
  const requirements: RevealRequirement[] = [];
  for (const item of value) {
    if (!isRecord(item) ||
        !hasExactKeys(item, ["bookId", "chapter"]) ||
        !isId(item.bookId) ||
        !Number.isSafeInteger(item.chapter) ||
        (item.chapter as number) < 1 ||
        seenBooks.has(item.bookId)) {
      return null;
    }
    seenBooks.add(item.bookId);
    requirements.push({ bookId: item.bookId, chapter: item.chapter as number });
  }
  return requirements;
}

function readEvidenceIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEM_EVIDENCE) {
    return null;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (!isId(item) || seen.has(item)) return null;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function readGraph(
  value: unknown,
  catalogIds: ReadonlySet<string>,
): NarrativeKnowledgeGraph | null {
  if (!isRecord(value) ||
      !hasExactKeys(value, ["entities", "relations"]) ||
      !Array.isArray(value.entities) ||
      !Array.isArray(value.relations) ||
      value.entities.length > MAX_ENTITIES ||
      value.relations.length > MAX_RELATIONS) {
    return null;
  }

  const entityIds = new Set<string>();
  const entities: KnowledgeEntity[] = [];
  for (const item of value.entities) {
    if (!isRecord(item) ||
        !hasExactKeys(item, ["id", "kind", "label", "revealAfter", "evidenceIds"]) ||
        !isId(item.id) ||
        !ENTITY_KINDS.has(item.kind as KnowledgeEntityKind) ||
        typeof item.label !== "string" ||
        item.label.trim().length === 0 ||
        item.label.length > MAX_LABEL_CHARS ||
        entityIds.has(item.id)) {
      return null;
    }

    const revealAfter = readRequirements(item.revealAfter);
    const evidenceIds = readEvidenceIds(item.evidenceIds);
    if (!revealAfter || !evidenceIds ||
        revealAfter.some((requirement) => !catalogIds.has(requirement.bookId))) {
      return null;
    }

    entityIds.add(item.id);
    entities.push(Object.freeze({
      id: item.id,
      kind: item.kind as KnowledgeEntityKind,
      label: item.label.trim(),
      revealAfter: Object.freeze(revealAfter),
      evidenceIds: Object.freeze(evidenceIds),
    }));
  }

  const allIds = new Set(entityIds);
  const relations: KnowledgeRelation[] = [];
  for (const item of value.relations) {
    if (!isRecord(item) ||
        !hasExactKeys(item, [
          "id", "fromEntityId", "toEntityId", "kind", "label", "revealAfter", "evidenceIds",
        ]) ||
        !isId(item.id) ||
        !isId(item.fromEntityId) ||
        !isId(item.toEntityId) ||
        item.fromEntityId === item.toEntityId ||
        !entityIds.has(item.fromEntityId) ||
        !entityIds.has(item.toEntityId) ||
        !RELATION_KINDS.has(item.kind as KnowledgeRelationKind) ||
        typeof item.label !== "string" ||
        item.label.trim().length === 0 ||
        item.label.length > MAX_LABEL_CHARS ||
        allIds.has(item.id)) {
      return null;
    }

    const revealAfter = readRequirements(item.revealAfter);
    const evidenceIds = readEvidenceIds(item.evidenceIds);
    if (!revealAfter || !evidenceIds ||
        revealAfter.some((requirement) => !catalogIds.has(requirement.bookId))) {
      return null;
    }

    allIds.add(item.id);
    relations.push(Object.freeze({
      id: item.id,
      fromEntityId: item.fromEntityId,
      toEntityId: item.toEntityId,
      kind: item.kind as KnowledgeRelationKind,
      label: item.label.trim(),
      revealAfter: Object.freeze(revealAfter),
      evidenceIds: Object.freeze(evidenceIds),
    }));
  }

  return Object.freeze({
    entities: Object.freeze(entities),
    relations: Object.freeze(relations),
  });
}

function readEvidence(value: unknown): Map<string, EvidenceRecord> | null {
  if (!Array.isArray(value) || value.length > MAX_EVIDENCE_ITEMS) return null;

  const evidence = new Map<string, EvidenceRecord>();
  for (const item of value) {
    if (!isRecord(item) ||
        !hasExactKeys(item, ["id", "bookId", "chapter", "accessible", "summary"]) ||
        !isId(item.id) ||
        !isId(item.bookId) ||
        !Number.isSafeInteger(item.chapter) ||
        (item.chapter as number) < 1 ||
        typeof item.accessible !== "boolean" ||
        typeof item.summary !== "string" ||
        item.summary.trim().length === 0 ||
        item.summary.length > MAX_SUMMARY_CHARS ||
        evidence.has(item.id)) {
      return null;
    }
    evidence.set(item.id, Object.freeze({
      id: item.id,
      bookId: item.bookId,
      chapter: item.chapter as number,
      accessible: item.accessible,
      summary: item.summary.trim(),
    }));
  }
  return evidence;
}

function requirementsSatisfied(
  requirements: readonly RevealRequirement[],
  chapterByBook: ReadonlyMap<string, number>,
): boolean {
  return requirements.every((requirement) => {
    const chapter = chapterByBook.get(requirement.bookId);
    return chapter !== undefined && chapter >= requirement.chapter;
  });
}

type EvidenceSupport = "supported" | "unavailable" | "invalid";

function checkEvidenceSupport(
  ids: readonly string[],
  requirements: readonly RevealRequirement[],
  allEvidence: ReadonlyMap<string, EvidenceRecord>,
  authorizedEvidenceIds: ReadonlySet<string>,
): EvidenceSupport {
  const gateByBook = new Map(requirements.map((item) => [item.bookId, item.chapter]));

  for (const id of ids) {
    const evidence = allEvidence.get(id);
    if (!evidence) return "invalid";

    const requiredChapter = gateByBook.get(evidence.bookId);
    if (requiredChapter === undefined || evidence.chapter < requiredChapter) {
      return "invalid";
    }
    if (!authorizedEvidenceIds.has(id)) return "unavailable";
  }
  return "supported";
}

function toVisibleEntity(entity: KnowledgeEntity): VisibleKnowledgeEntity {
  return Object.freeze({
    id: entity.id,
    kind: entity.kind,
    label: entity.label,
    evidenceIds: Object.freeze([...entity.evidenceIds]),
  });
}

/**
 * Returns one spoiler-safe graph neighborhood. Each node and edge has its own
 * multi-book reveal gate; an edge is withheld until its gate, both endpoints,
 * and every cited evidence item are independently authorized.
 *
 * This module stores no narrative facts. Callers supply reviewed metadata and
 * original summaries, and the function only enforces visibility constraints.
 */
export function getVisibleKnowledgeNeighborhood(
  graphInput: unknown,
  subjectEntityId: unknown,
  progressLedgerInput: unknown,
  catalogInput: unknown,
  evidenceInput: unknown,
): KnowledgeGraphResult {
  if (!Array.isArray(catalogInput) ||
      catalogInput.length === 0 ||
      catalogInput.length > MAX_CATALOG_BOOKS) {
    return { kind: "abstain", reason: "invalid-catalog" };
  }

  const emptyLedger = parseProgressLedger(null, catalogInput as ProgressCatalogBook[]);
  if (!emptyLedger) return { kind: "abstain", reason: "invalid-catalog" };

  const ledger = parseProgressLedger(progressLedgerInput, catalogInput as ProgressCatalogBook[]);
  if (!ledger) return { kind: "abstain", reason: "invalid-progress" };

  const catalogIds = new Set((catalogInput as ProgressCatalogBook[]).map((book) => book.bookId));
  const graph = readGraph(graphInput, catalogIds);
  if (!graph) return { kind: "abstain", reason: "invalid-graph" };

  const allEvidence = readEvidence(evidenceInput);
  if (!allEvidence) return { kind: "abstain", reason: "invalid-evidence" };

  if (!isId(subjectEntityId)) return { kind: "abstain", reason: "unknown-entity" };
  const subject = graph.entities.find((entity) => entity.id === subjectEntityId);
  if (!subject) return { kind: "abstain", reason: "unknown-entity" };

  const chapterByBook = new Map(ledger.entries.map((entry) => [entry.bookId, entry.chapter]));
  const authorizedEvidenceIds = new Set<string>();
  for (const item of allEvidence.values()) {
    const readerChapter = chapterByBook.get(item.bookId);
    if (item.accessible && readerChapter !== undefined && item.chapter <= readerChapter) {
      authorizedEvidenceIds.add(item.id);
    }
  }

  const isEntityVisible = (entity: KnowledgeEntity): boolean | null => {
    if (!requirementsSatisfied(entity.revealAfter, chapterByBook)) return false;
    const support = checkEvidenceSupport(
      entity.evidenceIds,
      entity.revealAfter,
      allEvidence,
      authorizedEvidenceIds,
    );
    if (support === "invalid") return null;
    return support === "supported";
  };

  const subjectVisibility = isEntityVisible(subject);
  if (subjectVisibility === null) return { kind: "abstain", reason: "invalid-graph" };
  if (!subjectVisibility) return { kind: "abstain", reason: "no-visible-knowledge" };

  const entitiesById = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const relatedEntities = new Map<string, VisibleKnowledgeEntity>();
  const visibleRelations: VisibleKnowledgeRelation[] = [];
  const usedEvidence = new Set(subject.evidenceIds);

  for (const relation of graph.relations) {
    if (relation.fromEntityId !== subject.id && relation.toEntityId !== subject.id) continue;
    if (!requirementsSatisfied(relation.revealAfter, chapterByBook)) continue;

    const otherId = relation.fromEntityId === subject.id
      ? relation.toEntityId
      : relation.fromEntityId;
    const other = entitiesById.get(otherId)!;
    const otherVisibility = isEntityVisible(other);
    if (otherVisibility === null) return { kind: "abstain", reason: "invalid-graph" };
    if (!otherVisibility) continue;

    const support = checkEvidenceSupport(
      relation.evidenceIds,
      relation.revealAfter,
      allEvidence,
      authorizedEvidenceIds,
    );
    if (support === "invalid") return { kind: "abstain", reason: "invalid-graph" };
    if (support === "unavailable") continue;

    relatedEntities.set(other.id, toVisibleEntity(other));
    visibleRelations.push(Object.freeze({
      id: relation.id,
      fromEntityId: relation.fromEntityId,
      toEntityId: relation.toEntityId,
      kind: relation.kind,
      label: relation.label,
      evidenceIds: Object.freeze([...relation.evidenceIds]),
    }));
    for (const id of relation.evidenceIds) usedEvidence.add(id);
    for (const id of other.evidenceIds) usedEvidence.add(id);
  }

  const orderedRelations = visibleRelations.sort((a, b) => a.id.localeCompare(b.id));
  const orderedEntities = [...relatedEntities.values()].sort((a, b) => a.id.localeCompare(b.id));

  return Object.freeze({
    kind: "neighborhood" as const,
    subject: toVisibleEntity(subject),
    relatedEntities: Object.freeze(orderedEntities),
    relations: Object.freeze(orderedRelations),
    evidenceIds: Object.freeze([...usedEvidence].sort()),
  });
}
