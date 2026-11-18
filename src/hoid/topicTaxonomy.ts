import { isKnownHoidSource } from "./bibliography";
import { HOID_APPROVED_CLAIMS, HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import { canonicalEvidenceScope, type HoidEvidenceCitation } from "./evidenceScope";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";

const RAW_TOPIC_TAXONOMY = [
  {
    id: "investiture-system",
    label: "Sistema de Investidura",
    dimensions: [
      { id: "mechanism", label: "Mecanismo" },
      { id: "source", label: "Fuente" },
      { id: "access-condition", label: "Condiciones de acceso" },
      { id: "manifestation", label: "Manifestaciones" },
      { id: "limitation", label: "Limitaciones" },
    ],
  },
  {
    id: "organization",
    label: "Organización",
    dimensions: [
      { id: "structure", label: "Estructura" },
      { id: "membership", label: "Pertenencia" },
      { id: "purpose", label: "Propósito" },
      { id: "influence", label: "Ámbito de influencia" },
    ],
  },
  {
    id: "artifact",
    label: "Objeto",
    dimensions: [
      { id: "function", label: "Función" },
      { id: "material", label: "Material" },
      { id: "limitation", label: "Limitaciones" },
      { id: "provenance", label: "Procedencia" },
    ],
  },
  {
    id: "phenomenon",
    label: "Fenómeno",
    dimensions: [
      { id: "mechanism", label: "Mecanismo" },
      { id: "conditions", label: "Condiciones" },
      { id: "manifestation", label: "Manifestaciones" },
      { id: "limitation", label: "Limitaciones" },
    ],
  },
  {
    id: "character",
    label: "Personaje",
    dimensions: [
      { id: "role", label: "Función o papel documentado" },
      { id: "affiliation", label: "Afiliación documentada" },
      { id: "capability", label: "Capacidad documentada" },
      { id: "motivation", label: "Motivación documentada" },
    ],
  },
  {
    id: "place",
    label: "Lugar",
    dimensions: [
      { id: "environment", label: "Entorno" },
      { id: "culture", label: "Contexto cultural" },
      { id: "geography", label: "Geografía" },
    ],
  },
  {
    id: "narrative-theme",
    label: "Tema narrativo",
    dimensions: [
      { id: "motif", label: "Motivo" },
      { id: "context", label: "Contexto" },
      { id: "contrast", label: "Contraste documentado" },
    ],
  },
] as const;

export const HOID_TOPIC_TAXONOMY = Object.freeze(
  RAW_TOPIC_TAXONOMY.map(topic => Object.freeze({
    ...topic,
    dimensions: Object.freeze(topic.dimensions.map(dimension => Object.freeze({ ...dimension }))),
  })),
);

export type HoidTopicId = (typeof RAW_TOPIC_TAXONOMY)[number]["id"];
export type HoidTopicDimensionId = (typeof RAW_TOPIC_TAXONOMY)[number]["dimensions"][number]["id"];
export type HoidTopicSubjectKind = "entity" | "work";

export type HoidTopicAssignment = Readonly<{
  schemaVersion: 1;
  id: string;
  subjectKind: HoidTopicSubjectKind;
  subjectId: string;
  worldId: string;
  worldLabel: string;
  topicId: HoidTopicId;
  dimensionId: HoidTopicDimensionId;
  claimId: string;
  claimTextSha256: string;
  evidenceIds: readonly string[];
  review: Readonly<{
    status: "approved";
    reviewerId: string;
    reviewedAt: string;
  }>;
}>;

export type HoidTopicEntityFirstAppearance = Readonly<{
  entityId: string;
  bookId: string;
  chapter: number;
}>;

export type HoidTopicAssignmentValidation =
  | Readonly<{
      status: "valid";
      assignments: readonly HoidTopicAssignment[];
      evidenceCitations: readonly HoidEvidenceCitation[];
      entityFirstAppearances: readonly HoidTopicEntityFirstAppearance[];
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-batch"
        | "invalid-assignment"
        | "duplicate-assignment"
        | "inconsistent-world-label";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const WORLD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_ASSIGNMENTS = 512;
const MAX_EVIDENCE_IDS = 16;

const PRODUCTION_APPROVED_CLAIMS = Object.freeze(
  HOID_APPROVED_CLAIMS.map(claim => Object.freeze({
    id: claim.id,
    text: claim.text,
    evidenceIds: Object.freeze([...claim.evidenceIds]),
  })),
);

const PRODUCTION_APPROVED_KNOWLEDGE = Object.freeze(
  HOID_EDITORIAL_KNOWLEDGE
    .filter(entry => entry.provenance === "verified")
    .map(entry => Object.freeze({
      id: entry.id,
      provenance: entry.provenance,
      summary: entry.summary,
      evidenceSource: entry.evidenceSource,
      evidenceUnlock: entry.evidenceUnlock,
      firstSafeAppearance: entry.firstSafeAppearance,
    })),
);

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;
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
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseIds(value: unknown): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EVIDENCE_IDS) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      ids.push(descriptor.value);
    }
    return Object.freeze(ids.sort());
  } catch {
    return null;
  }
}

export function getHoidTopicDefinition(topicId: unknown) {
  if (typeof topicId !== "string") return null;
  return HOID_TOPIC_TAXONOMY.find(topic => topic.id === topicId) ?? null;
}

export function getHoidTopicDimensionDefinition(topicId: unknown, dimensionId: unknown) {
  if (typeof dimensionId !== "string") return null;
  const topic = getHoidTopicDefinition(topicId);
  return topic?.dimensions.find(dimension => dimension.id === dimensionId) ?? null;
}

export function isHoidTopicDimensionAllowed(topicId: unknown, dimensionId: unknown): boolean {
  return getHoidTopicDimensionDefinition(topicId, dimensionId) !== null;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    [...left].sort().join("\n") === [...right].sort().join("\n");
}

function canonicalApprovedClaimMap(value: unknown): ReadonlyMap<string, Readonly<{
  text: string;
  evidenceIds: readonly string[];
}>> | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > MAX_ASSIGNMENTS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const claims = new Map<string, Readonly<{ text: string; evidenceIds: readonly string[] }>>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const raw = canonicalRecord(descriptor.value, ["id", "text", "evidenceIds"]);
      const id = raw?.id;
      const text = raw?.text;
      const evidenceIds = raw ? canonicalDenseIds(raw.evidenceIds) : null;
      if (
        !raw ||
        typeof id !== "string" || !ID_PATTERN.test(id) || claims.has(id) ||
        typeof text !== "string" || text.length < 1 || text.length > 4_000 ||
        text !== text.trim() ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text) ||
        !evidenceIds
      ) return null;
      claims.set(id, Object.freeze({ text, evidenceIds }));
    }
    return claims;
  } catch {
    return null;
  }
}

function canonicalApprovedKnowledge(value: unknown): Readonly<{
  evidenceCitations: readonly HoidEvidenceCitation[];
  entityFirstAppearances: readonly HoidTopicEntityFirstAppearance[];
}> | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > MAX_ASSIGNMENTS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const evidenceCitations: HoidEvidenceCitation[] = [];
    const entityFirstAppearances: HoidTopicEntityFirstAppearance[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const raw = canonicalRecord(descriptor.value, [
        "id", "provenance", "summary", "evidenceSource", "evidenceUnlock", "firstSafeAppearance",
      ]);
      if (!raw) return null;

      const id = raw.id;
      const summary = raw.summary;
      const firstAppearance = canonicalRecord(raw.firstSafeAppearance, ["bookId", "chapter"]);
      const scope = canonicalEvidenceScope(raw.evidenceSource, raw.evidenceUnlock);
      if (
        typeof id !== "string" || !ID_PATTERN.test(id) || seen.has(id) ||
        raw.provenance !== "verified" ||
        typeof summary !== "string" || summary.length < 1 || summary.length > 4_000 ||
        summary !== summary.trim() ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(summary) ||
        !firstAppearance || !scope
      ) return null;

      const firstBookId = firstAppearance.bookId;
      const firstChapter = firstAppearance.chapter;
      if (
        typeof firstBookId !== "string" || !isKnownHoidSource(firstBookId) ||
        typeof firstChapter !== "number" || !Number.isSafeInteger(firstChapter) || firstChapter < 1
      ) return null;
      const firstManifest = getHoidReadingManifest(firstBookId);
      if (
        firstManifest.status !== "ready" ||
        !firstManifest.manifest.units.some(unit => unit.chapterNumber === firstChapter)
      ) return null;

      seen.add(id);
      evidenceCitations.push(Object.freeze({ evidenceId: id, ...scope }));
      entityFirstAppearances.push(Object.freeze({
        entityId: id,
        bookId: firstBookId,
        chapter: firstChapter,
      }));
    }

    evidenceCitations.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    entityFirstAppearances.sort((left, right) => left.entityId.localeCompare(right.entityId));
    return Object.freeze({
      evidenceCitations: Object.freeze(evidenceCitations),
      entityFirstAppearances: Object.freeze(entityFirstAppearances),
    });
  } catch {
    return null;
  }
}

function canonicalAssignment(
  value: unknown,
  approvedClaims: ReadonlyMap<string, Readonly<{ text: string; evidenceIds: readonly string[] }>>,
  approvedEvidenceIds: ReadonlySet<string>,
  approvedEntityIds: ReadonlySet<string>,
): HoidTopicAssignment | null {
  const raw = canonicalRecord(value, [
    "schemaVersion", "id", "subjectKind", "subjectId", "worldId", "worldLabel",
    "topicId", "dimensionId", "claimId", "claimTextSha256", "evidenceIds", "review",
  ]);
  if (!raw || raw.schemaVersion !== 1) return null;

  const id = raw.id;
  const subjectKind = raw.subjectKind;
  const subjectId = raw.subjectId;
  const worldId = raw.worldId;
  const worldLabel = raw.worldLabel;
  const topicId = raw.topicId;
  const dimensionId = raw.dimensionId;
  const claimId = raw.claimId;
  const claimTextSha256 = raw.claimTextSha256;
  const evidenceIds = canonicalDenseIds(raw.evidenceIds);
  const review = canonicalRecord(raw.review, ["status", "reviewerId", "reviewedAt"]);
  const approvedClaim = typeof claimId === "string" ? approvedClaims.get(claimId) : undefined;

  if (
    typeof id !== "string" || !ID_PATTERN.test(id) ||
    (subjectKind !== "entity" && subjectKind !== "work") ||
    typeof subjectId !== "string" || !ID_PATTERN.test(subjectId) ||
    (subjectKind === "work" && !isKnownHoidSource(subjectId)) ||
    (subjectKind === "entity" && !approvedEntityIds.has(subjectId)) ||
    typeof worldId !== "string" || !WORLD_ID_PATTERN.test(worldId) ||
    typeof worldLabel !== "string" ||
    worldLabel.length < 1 || worldLabel.length > 80 ||
    worldLabel !== worldLabel.trim() ||
    worldLabel !== worldLabel.normalize("NFC") ||
    /[\u0000-\u001F\u007F]/u.test(worldLabel) ||
    typeof topicId !== "string" || !getHoidTopicDefinition(topicId) ||
    typeof dimensionId !== "string" || !isHoidTopicDimensionAllowed(topicId, dimensionId) ||
    typeof claimId !== "string" || !ID_PATTERN.test(claimId) ||
    typeof claimTextSha256 !== "string" || !SHA_PATTERN.test(claimTextSha256) ||
    !evidenceIds || !review || !approvedClaim ||
    sha256Hex(approvedClaim.text) !== claimTextSha256 ||
    !sameIds(approvedClaim.evidenceIds, evidenceIds) ||
    evidenceIds.some(evidenceId => !approvedEvidenceIds.has(evidenceId)) ||
    review.status !== "approved" ||
    typeof review.reviewerId !== "string" ||
    !/^[A-Za-z0-9_.-]{1,100}$/u.test(review.reviewerId) ||
    typeof review.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(review.reviewedAt)) ||
    new Date(review.reviewedAt).toISOString() !== review.reviewedAt
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    id,
    subjectKind,
    subjectId,
    worldId,
    worldLabel,
    topicId: topicId as HoidTopicId,
    dimensionId: dimensionId as HoidTopicDimensionId,
    claimId,
    claimTextSha256,
    evidenceIds,
    review: Object.freeze({
      status: "approved",
      reviewerId: review.reviewerId,
      reviewedAt: review.reviewedAt,
    }),
  });
}

/**
 * Validate source-controlled topic assignments against the exact approved
 * claim and verified evidence registries. Optional registry arguments are
 * trusted composition/test seams only; production callers use defaults.
 * Reviewer fields are audit metadata, not reviewer authentication.
 */
export function validateHoidTopicAssignments(
  value: unknown,
  approvedClaimsInput: unknown = PRODUCTION_APPROVED_CLAIMS,
  approvedKnowledgeInput: unknown = PRODUCTION_APPROVED_KNOWLEDGE,
): HoidTopicAssignmentValidation {
  try {
    const approvedClaims = canonicalApprovedClaimMap(approvedClaimsInput);
    const approvedKnowledge = canonicalApprovedKnowledge(approvedKnowledgeInput);
    if (!approvedClaims || !approvedKnowledge) {
      return Object.freeze({ status: "invalid", reason: "invalid-batch" });
    }
    if (
      !Array.isArray(value) ||
      value.length > MAX_ASSIGNMENTS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return Object.freeze({ status: "invalid", reason: "invalid-batch" });

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) {
      return Object.freeze({ status: "invalid", reason: "invalid-batch" });
    }

    const approvedEvidenceIds = new Set(approvedKnowledge.evidenceCitations.map(item => item.evidenceId));
    const approvedEntityIds = new Set(approvedKnowledge.entityFirstAppearances.map(item => item.entityId));
    const assignments: HoidTopicAssignment[] = [];
    const ids = new Set<string>();
    const subjects = new Set<string>();
    const worldLabels = new Map<string, string>();
    const worldIdsByLabel = new Map<string, string>();

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return Object.freeze({ status: "invalid", reason: "invalid-batch" });

      const assignment = canonicalAssignment(
        descriptor.value,
        approvedClaims,
        approvedEvidenceIds,
        approvedEntityIds,
      );
      if (!assignment) return Object.freeze({ status: "invalid", reason: "invalid-assignment" });

      const subjectKey = [
        assignment.subjectKind,
        assignment.subjectId,
        assignment.topicId,
        assignment.dimensionId,
      ].join(":");
      if (ids.has(assignment.id) || subjects.has(subjectKey)) {
        return Object.freeze({ status: "invalid", reason: "duplicate-assignment" });
      }

      const previousLabel = worldLabels.get(assignment.worldId);
      const previousWorldId = worldIdsByLabel.get(assignment.worldLabel);
      if (
        (previousLabel !== undefined && previousLabel !== assignment.worldLabel) ||
        (previousWorldId !== undefined && previousWorldId !== assignment.worldId)
      ) {
        return Object.freeze({ status: "invalid", reason: "inconsistent-world-label" });
      }

      ids.add(assignment.id);
      subjects.add(subjectKey);
      worldLabels.set(assignment.worldId, assignment.worldLabel);
      worldIdsByLabel.set(assignment.worldLabel, assignment.worldId);
      assignments.push(assignment);
    }

    assignments.sort((left, right) =>
      left.topicId.localeCompare(right.topicId) ||
      left.dimensionId.localeCompare(right.dimensionId) ||
      left.subjectKind.localeCompare(right.subjectKind) ||
      left.subjectId.localeCompare(right.subjectId),
    );

    return Object.freeze({
      status: "valid",
      assignments: Object.freeze(assignments),
      evidenceCitations: approvedKnowledge.evidenceCitations,
      entityFirstAppearances: approvedKnowledge.entityFirstAppearances,
    });
  } catch {
    return Object.freeze({ status: "invalid", reason: "invalid-batch" });
  }
}

/**
 * Production stays empty until topic assignments are backed by accessible,
 * chapter-scoped evidence and independently approved. No synthetic facts are
 * shipped as production taxonomy data.
 */
export const HOID_APPROVED_TOPIC_ASSIGNMENTS: readonly HoidTopicAssignment[] = Object.freeze([]);
