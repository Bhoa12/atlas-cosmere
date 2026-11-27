import {
  isHoidEntityDossierGateway,
  type HoidEntityDossierGateway,
  type HoidEntityDossierGatewayResult,
  type HoidEntityDossierClaim,
} from "./entityDossierGateway";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import {
  canonicalEvidenceScope,
  type HoidEvidenceCitation,
} from "./evidenceScope";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  composeHoidNarrative,
  defaultHoidNarrativeLayout,
} from "./narrativeComposition";
import {
  projectHoidAnswerForDisplay,
  type HoidAnswerDisplayProjection,
} from "./answerDisplayProjection";
import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
  HoidPresentedSegment,
} from "./answerPresentation";
import {
  isHoidExplanationDepth,
  resolveHoidExplanationDepthBudget,
  type HoidExplanationDepth,
} from "./explanationDepth";
import { sha256Hex } from "./sha256";
import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";
import {
  classifyHoidCharacterEvolutionIntent,
  type HoidCharacterEvolutionDimension,
  type HoidCharacterEvolutionIntent,
} from "./entityEvolutionExplanationIntent";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import type { ReadingPosition } from "./types";

export type {
  HoidCharacterEvolutionDimension,
} from "./entityEvolutionExplanationIntent";

export type HoidCharacterEvolutionEvidenceKind = "state" | "transition";

export type HoidCharacterEvolutionAnnotationCore = Readonly<{
  id: string;
  characterId: string;
  claimId: string;
  dimension: HoidCharacterEvolutionDimension;
  evidenceKind: HoidCharacterEvolutionEvidenceKind;
}>;

export type HoidCharacterEvolutionReview = Readonly<{
  status: "approved";
  origin: "original-editorial";
  reviewerId: string;
  reviewedAt: string;
  claimSha256: string;
  annotationSha256: string;
}>;

export type HoidCharacterEvolutionAnnotation = HoidCharacterEvolutionAnnotationCore & Readonly<{
  review: HoidCharacterEvolutionReview;
}>;

export type HoidCharacterEvolutionIndex = Readonly<{
  schemaVersion: 1;
}>;

export type HoidCharacterEvolutionResult =
  | Readonly<{ status: "not-evolution" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "ready";
      characterLabel: string;
      semantics: "reading-order-evidence";
      presentation: HoidAnswerDisplayProjection;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "cancelled"
        | "invalid-scope"
        | "invalid-dossier"
        | "invalid-index"
        | "budget-exceeded";
    }>;

export type HoidCharacterEvolutionExplanationAdapter = Readonly<{
  answer(
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<HoidCharacterEvolutionResult>;
}>;

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
  reading: readonly ReadingPosition[];
}>;

type CanonicalParticipant = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
  label: string;
}>;

type CanonicalClaim = Readonly<{
  claimId: string;
  intent: "explain" | "context" | "recommend";
  text: string;
  participants: readonly CanonicalParticipant[];
  sources: readonly HoidEvidenceCitation[];
}>;

type CanonicalAnnotation = HoidCharacterEvolutionAnnotationCore & Readonly<{
  review: HoidCharacterEvolutionReview;
}>;

type CanonicalDossier = Readonly<{
  entity: Readonly<{ id: string; label: string }>;
  claims: readonly CanonicalClaim[];
}>;

type SelectedFact = Readonly<{
  annotation: CanonicalAnnotation;
  claim: CanonicalClaim;
}>;

type AdapterConfig = Readonly<{
  gateway: HoidEntityDossierGateway;
  index: HoidCharacterEvolutionIndex;
  refreshCurrentProgress: () => unknown | Promise<unknown>;
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const DIMENSIONS: readonly HoidCharacterEvolutionDimension[] = Object.freeze([
  "perspective",
  "knowledge",
  "capability",
  "affiliation",
  "relationship",
  "status",
  "motivation",
  "cause",
]);
const DIMENSION_ORDER = new Map(DIMENSIONS.map((item, index) => [item, index] as const));
const DIMENSION_LABEL: Readonly<Record<HoidCharacterEvolutionDimension, string>> = Object.freeze({
  perspective: "Perspectiva",
  knowledge: "Conocimiento",
  capability: "Capacidad",
  affiliation: "Afiliación",
  relationship: "Relación",
  status: "Estado",
  motivation: "Motivación",
  cause: "Causa documentada",
});
const CITATION_KEYS = [
  "evidenceId",
  "sourceBookId",
  "sourceChapter",
  "locatorId",
  "unlockBookId",
  "unlockChapter",
] as const;
const RESOLVED_SOURCE_KEYS = [
  ...CITATION_KEYS,
  "editionId",
  "navigationSha256",
  "documentSha256",
] as const;
const MAX_ANNOTATIONS = 512;
const MAX_CLAIMS = 24;
const MAX_PARTICIPANTS = 4;
const MAX_SOURCES_PER_CLAIM = 16;
const MAX_ALIAS_EVIDENCE = 64;
const MAX_TEXT = 4_000;
const TITLE_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index] as const));
const EVOLUTION_INDEXES = new WeakSet<object>();
const EVOLUTION_INDEX_DATA = new WeakMap<object, readonly CanonicalAnnotation[]>();

/** Production remains empty until original character-evolution annotations are reviewed and promoted. */
export const HOID_CHARACTER_EVOLUTION_ANNOTATIONS: readonly unknown[] = Object.freeze([]);

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validId(value: unknown): value is string {
  return typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 128 &&
    ID_PATTERN.test(value);
}

function validText(value: unknown, maximum = MAX_TEXT): value is string {
  return typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= maximum &&
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 40 &&
    Number.isFinite(Date.parse(value));
}

function progressIdentity(value: unknown): ProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready" || !validEditionBoundReadingPositions(projection.reading)) {
    return null;
  }
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
    reading: projection.reading,
  });
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function sourceIsUnlocked(
  source: HoidEvidenceCitation,
  reading: readonly ReadingPosition[],
): boolean {
  const position = reading.find(item => item.bookId === source.unlockBookId);
  return Boolean(
    position &&
    (position.completed === true ||
      (typeof position.chapter === "number" && position.chapter >= source.unlockChapter)),
  );
}

function canonicalCitation(
  value: unknown,
  scope?: HoidAnswerBookScope,
  reading?: readonly ReadingPosition[],
): HoidEvidenceCitation | null {
  const raw = exactRecord(value, CITATION_KEYS);
  if (!raw) return null;
  const evidenceId = raw.evidenceId;
  const sourceBookId = raw.sourceBookId;
  const sourceChapter = raw.sourceChapter;
  const locatorId = raw.locatorId;
  const unlockBookId = raw.unlockBookId;
  const unlockChapter = raw.unlockChapter;
  if (
    !validId(evidenceId) ||
    typeof sourceBookId !== "string" ||
    !TITLE_BY_ID.has(sourceBookId) ||
    typeof sourceChapter !== "number" ||
    !Number.isSafeInteger(sourceChapter) ||
    sourceChapter < 1 ||
    typeof locatorId !== "string" ||
    locatorId.length < 1 ||
    locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(locatorId) ||
    unlockBookId !== sourceBookId ||
    typeof unlockChapter !== "number" ||
    !Number.isSafeInteger(unlockChapter) ||
    unlockChapter < sourceChapter
  ) return null;
  const canonical = canonicalEvidenceScope(
    { bookId: sourceBookId, chapter: sourceChapter, locatorId },
    { bookId: unlockBookId, chapter: unlockChapter },
  );
  if (!canonical) return null;
  const citation: HoidEvidenceCitation = Object.freeze({
    evidenceId,
    ...canonical,
  });
  if (scope && !scope.bookIds.includes(citation.sourceBookId)) return null;
  if (reading && !sourceIsUnlocked(citation, reading)) return null;
  return citation;
}

function canonicalResolvedSource(
  value: unknown,
  scope: HoidAnswerBookScope,
  reading: readonly ReadingPosition[],
): HoidEvidenceCitation | null {
  const raw = exactRecord(value, RESOLVED_SOURCE_KEYS);
  if (
    !raw ||
    !validText(raw.editionId, 128) ||
    typeof raw.navigationSha256 !== "string" ||
    !SHA_PATTERN.test(raw.navigationSha256) ||
    typeof raw.documentSha256 !== "string" ||
    !SHA_PATTERN.test(raw.documentSha256)
  ) return null;
  return canonicalCitation(
    Object.fromEntries(CITATION_KEYS.map(key => [key, raw[key]])),
    scope,
    reading,
  );
}

function sameCitation(left: HoidEvidenceCitation, right: HoidEvidenceCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.sourceChapter === right.sourceChapter &&
    left.locatorId === right.locatorId &&
    left.unlockBookId === right.unlockBookId &&
    left.unlockChapter === right.unlockChapter;
}

function canonicalClaim(
  value: unknown,
  characterId: string,
  scope?: HoidAnswerBookScope,
  reading?: readonly ReadingPosition[],
): CanonicalClaim | null {
  const raw = exactRecord(value, ["claimId", "intent", "text", "participants", "sources"]);
  if (!raw || !validId(raw.claimId) || !validText(raw.text)) return null;
  if (raw.intent !== "explain" && raw.intent !== "context" && raw.intent !== "recommend") return null;
  const rawParticipants = denseArray(raw.participants, 1, MAX_PARTICIPANTS);
  const rawSources = denseArray(raw.sources, 1, MAX_SOURCES_PER_CLAIM);
  if (!rawParticipants || !rawSources) return null;

  const participants: CanonicalParticipant[] = [];
  const participantIds = new Set<string>();
  for (const rawParticipant of rawParticipants) {
    const participant = exactRecord(rawParticipant, ["id", "kind", "label"]);
    if (
      !participant ||
      !validId(participant.id) ||
      !isHoidKnowledgeKind(participant.kind) ||
      !validText(participant.label, 256) ||
      participantIds.has(participant.id)
    ) return null;
    participantIds.add(participant.id);
    participants.push(Object.freeze({
      id: participant.id,
      kind: participant.kind,
      label: participant.label,
    }));
  }
  if (!participants.some(item => item.id === characterId && item.kind === "character")) return null;

  const sources: HoidEvidenceCitation[] = [];
  const sourceIds = new Set<string>();
  for (const rawSource of rawSources) {
    const source = canonicalCitation(rawSource, scope, reading);
    if (!source || sourceIds.has(source.evidenceId)) return null;
    sourceIds.add(source.evidenceId);
    sources.push(source);
  }
  if (!participants.every(item => sourceIds.has(item.id))) return null;
  if (scope && !claimEvidenceMatchesHoidBookScope(
    sources.map(source => source.sourceBookId),
    scope,
  )) return null;

  return Object.freeze({
    claimId: raw.claimId,
    intent: raw.intent,
    text: raw.text,
    participants: Object.freeze(participants),
    sources: Object.freeze(sources),
  });
}

function claimDigest(claim: CanonicalClaim): string {
  return sha256Hex(JSON.stringify([
    "hoid-character-evolution-claim-v1",
    claim.claimId,
    claim.intent,
    claim.text,
    claim.participants.map(item => [item.id, item.kind, item.label]),
    claim.sources.map(item => [
      item.evidenceId,
      item.sourceBookId,
      item.sourceChapter,
      item.locatorId,
      item.unlockBookId,
      item.unlockChapter,
    ]),
  ]));
}

function canonicalCore(value: unknown): HoidCharacterEvolutionAnnotationCore | null {
  const raw = exactRecord(value, [
    "id",
    "characterId",
    "claimId",
    "dimension",
    "evidenceKind",
  ]);
  if (
    !raw ||
    !validId(raw.id) ||
    !validId(raw.characterId) ||
    !validId(raw.claimId) ||
    typeof raw.dimension !== "string" ||
    !(DIMENSIONS as readonly string[]).includes(raw.dimension) ||
    (raw.evidenceKind !== "state" && raw.evidenceKind !== "transition")
  ) return null;
  return Object.freeze({
    id: raw.id,
    characterId: raw.characterId,
    claimId: raw.claimId,
    dimension: raw.dimension as HoidCharacterEvolutionDimension,
    evidenceKind: raw.evidenceKind,
  });
}

function annotationDigest(
  core: HoidCharacterEvolutionAnnotationCore,
  claimSha256: string,
): string {
  return sha256Hex(JSON.stringify([
    "hoid-character-evolution-annotation-v1",
    core.id,
    core.characterId,
    core.claimId,
    core.dimension,
    core.evidenceKind,
    claimSha256,
  ]));
}

function annotationCompatible(
  core: HoidCharacterEvolutionAnnotationCore,
  claim: CanonicalClaim,
): boolean {
  if (claim.intent === "recommend") return false;
  if (core.dimension === "relationship" && claim.participants.length < 2) return false;
  if (core.dimension === "cause" && (
    core.evidenceKind !== "transition" || claim.intent !== "explain"
  )) return false;
  return true;
}

/**
 * Creates a review digest for a canonical, already-approved dossier claim.
 * The digest detects drift; it is not a digital signature or reviewer identity proof.
 */
export function createHoidCharacterEvolutionReview(
  coreInput: unknown,
  dossierClaimInput: HoidEntityDossierClaim | unknown,
  reviewerInput: unknown,
): HoidCharacterEvolutionReview | null {
  const core = canonicalCore(coreInput);
  const claim = core
    ? canonicalClaim(dossierClaimInput, core.characterId)
    : null;
  const reviewer = exactRecord(reviewerInput, ["reviewerId", "reviewedAt"]);
  if (
    !core ||
    !claim ||
    !annotationCompatible(core, claim) ||
    !reviewer ||
    !validId(reviewer.reviewerId) ||
    !validTimestamp(reviewer.reviewedAt)
  ) return null;
  const claimSha256 = claimDigest(claim);
  return Object.freeze({
    status: "approved",
    origin: "original-editorial",
    reviewerId: reviewer.reviewerId,
    reviewedAt: reviewer.reviewedAt,
    claimSha256,
    annotationSha256: annotationDigest(core, claimSha256),
  });
}

function canonicalAnnotation(value: unknown): CanonicalAnnotation | null {
  const raw = exactRecord(value, [
    "id",
    "characterId",
    "claimId",
    "dimension",
    "evidenceKind",
    "review",
  ]);
  if (!raw) return null;
  const core = canonicalCore({
    id: raw.id,
    characterId: raw.characterId,
    claimId: raw.claimId,
    dimension: raw.dimension,
    evidenceKind: raw.evidenceKind,
  });
  const review = exactRecord(raw.review, [
    "status",
    "origin",
    "reviewerId",
    "reviewedAt",
    "claimSha256",
    "annotationSha256",
  ]);
  if (
    !core ||
    !review ||
    review.status !== "approved" ||
    review.origin !== "original-editorial" ||
    !validId(review.reviewerId) ||
    !validTimestamp(review.reviewedAt) ||
    typeof review.claimSha256 !== "string" ||
    !SHA_PATTERN.test(review.claimSha256) ||
    typeof review.annotationSha256 !== "string" ||
    !SHA_PATTERN.test(review.annotationSha256)
  ) return null;
  return Object.freeze({
    ...core,
    review: Object.freeze({
      status: "approved",
      origin: "original-editorial",
      reviewerId: review.reviewerId,
      reviewedAt: review.reviewedAt,
      claimSha256: review.claimSha256,
      annotationSha256: review.annotationSha256,
    }),
  });
}

/** Build an opaque index; annotations are retained only in a private WeakMap. */
export function createHoidCharacterEvolutionIndex(
  annotationsInput: unknown,
): HoidCharacterEvolutionIndex | null {
  const rawAnnotations = denseArray(annotationsInput, 0, MAX_ANNOTATIONS);
  if (!rawAnnotations) return null;
  const annotations: CanonicalAnnotation[] = [];
  const ids = new Set<string>();
  const tuples = new Set<string>();
  for (const raw of rawAnnotations) {
    const annotation = canonicalAnnotation(raw);
    if (!annotation || ids.has(annotation.id)) return null;
    // One claim has one editorial dimension/evidence-kind annotation per character.
    // Reusing the same claim ID in multiple segments would violate the composer contract.
    const tuple = [annotation.characterId, annotation.claimId].join("\n");
    if (tuples.has(tuple)) return null;
    ids.add(annotation.id);
    tuples.add(tuple);
    annotations.push(annotation);
  }
  const index: HoidCharacterEvolutionIndex = Object.freeze({ schemaVersion: 1 });
  EVOLUTION_INDEXES.add(index as object);
  EVOLUTION_INDEX_DATA.set(index as object, Object.freeze(annotations));
  return index;
}

export function isHoidCharacterEvolutionIndex(
  value: unknown,
): value is HoidCharacterEvolutionIndex {
  return value !== null &&
    typeof value === "object" &&
    EVOLUTION_INDEXES.has(value as object);
}

export function getHoidCharacterEvolutionRegistryStatus(): "empty" | "staged" {
  return HOID_CHARACTER_EVOLUTION_ANNOTATIONS.length === 0 ? "empty" : "staged";
}

function canonicalDossier(
  value: unknown,
  scope: HoidAnswerBookScope,
  progress: ProgressIdentity,
): CanonicalDossier | null {
  const dossier = exactRecord(value, [
    "schemaVersion",
    "dossierId",
    "entity",
    "summary",
    "claims",
    "progressRevision",
    "progressFingerprint",
    "sourceTextIncluded",
    "providerEgress",
  ]);
  if (
    !dossier ||
    dossier.schemaVersion !== 1 ||
    typeof dossier.dossierId !== "string" ||
    !SHA_PATTERN.test(dossier.dossierId) ||
    dossier.progressRevision !== progress.revision ||
    dossier.progressFingerprint !== progress.fingerprint ||
    dossier.sourceTextIncluded !== false ||
    dossier.providerEgress !== "none"
  ) return null;

  const entity = exactRecord(dossier.entity, [
    "id",
    "kind",
    "label",
    "source",
    "aliasEvidence",
  ]);
  if (
    !entity ||
    !validId(entity.id) ||
    entity.kind !== "character" ||
    !validText(entity.label, 256)
  ) return null;
  const entitySource = canonicalResolvedSource(entity.source, scope, progress.reading);
  if (!entitySource || entitySource.evidenceId !== entity.id) return null;

  const aliases = denseArray(entity.aliasEvidence, 1, MAX_ALIAS_EVIDENCE);
  if (!aliases) return null;
  const aliasIds = new Set<string>();
  for (const rawAlias of aliases) {
    const alias = exactRecord(rawAlias, ["evidenceId", "source"]);
    if (!alias || !validId(alias.evidenceId) || aliasIds.has(alias.evidenceId)) return null;
    const source = canonicalResolvedSource(alias.source, scope, progress.reading);
    if (!source || source.evidenceId !== alias.evidenceId) return null;
    aliasIds.add(alias.evidenceId);
  }

  const summary = exactRecord(dossier.summary, ["text", "source"]);
  if (!summary || !validText(summary.text)) return null;
  const summarySource = canonicalCitation(summary.source, scope, progress.reading);
  if (!summarySource || !sameCitation(entitySource, summarySource)) return null;

  const rawClaims = denseArray(dossier.claims, 0, MAX_CLAIMS);
  if (!rawClaims) return null;
  const claims: CanonicalClaim[] = [];
  const claimIds = new Set<string>();
  for (const rawClaim of rawClaims) {
    const claim = canonicalClaim(rawClaim, entity.id, scope, progress.reading);
    if (!claim || claimIds.has(claim.claimId)) return null;
    claimIds.add(claim.claimId);
    claims.push(claim);
  }
  return Object.freeze({
    entity: Object.freeze({ id: entity.id, label: entity.label }),
    claims: Object.freeze(claims),
  });
}

function presentedCitation(source: HoidEvidenceCitation): HoidPresentedCitation | null {
  const title = TITLE_BY_ID.get(source.sourceBookId);
  if (!title) return null;
  return Object.freeze({
    evidenceId: source.evidenceId,
    sourceBookId: source.sourceBookId,
    title,
    chapter: source.sourceChapter,
    locatorId: source.locatorId,
  });
}

function maxUnlockChapter(claim: CanonicalClaim): number {
  return Math.max(...claim.sources.map(source => source.unlockChapter));
}

function sourceChapterOrder(claim: CanonicalClaim): number {
  return Math.min(...claim.sources.map(source => source.sourceChapter));
}

function compareFacts(left: SelectedFact, right: SelectedFact): number {
  const dimensionDifference =
    DIMENSION_ORDER.get(left.annotation.dimension)! -
    DIMENSION_ORDER.get(right.annotation.dimension)!;
  if (dimensionDifference !== 0) return dimensionDifference;

  const leftWorks = new Set(left.claim.sources.map(source => source.sourceBookId));
  const rightWorks = new Set(right.claim.sources.map(source => source.sourceBookId));
  const leftCrossWork = leftWorks.size > 1;
  const rightCrossWork = rightWorks.size > 1;
  if (leftCrossWork !== rightCrossWork) return leftCrossWork ? 1 : -1;

  if (!leftCrossWork && !rightCrossWork) {
    const leftBook = [...leftWorks][0];
    const rightBook = [...rightWorks][0];
    const workDifference = (WORK_ORDER.get(leftBook) ?? 999) - (WORK_ORDER.get(rightBook) ?? 999);
    if (workDifference !== 0) return workDifference;
    const unlockDifference = maxUnlockChapter(left.claim) - maxUnlockChapter(right.claim);
    if (unlockDifference !== 0) return unlockDifference;
    const chapterDifference = sourceChapterOrder(left.claim) - sourceChapterOrder(right.claim);
    if (chapterDifference !== 0) return chapterDifference;
  }
  return left.claim.claimId < right.claim.claimId ? -1 :
    left.claim.claimId > right.claim.claimId ? 1 : 0;
}

function buildPresentation(
  facts: readonly SelectedFact[],
): HoidAnswerDisplayProjection | null {
  const ordered = [...facts].sort(compareFacts);
  const segments: HoidPresentedSegment[] = [];
  const allCitations = new Map<string, HoidPresentedCitation>();

  for (const fact of ordered) {
    const citations = fact.claim.sources.map(presentedCitation);
    if (citations.some(item => item === null)) return null;
    const concrete = citations as HoidPresentedCitation[];
    for (const citation of concrete) {
      const previous = allCitations.get(citation.evidenceId);
      if (previous && (
        previous.sourceBookId !== citation.sourceBookId ||
        previous.chapter !== citation.chapter ||
        previous.locatorId !== citation.locatorId
      )) return null;
      allCitations.set(citation.evidenceId, citation);
    }
    const dimensionLabel = DIMENSION_LABEL[fact.annotation.dimension];
    const evidenceLabel = fact.annotation.evidenceKind === "transition"
      ? "cambio documentado"
      : "estado documentado";
    const crossWorkLabel = new Set(fact.claim.sources.map(source => source.sourceBookId)).size > 1
      ? "Evidencia transversal entre obras · "
      : "";
    segments.push(Object.freeze({
      claimId: fact.claim.claimId,
      text: crossWorkLabel + dimensionLabel + " · " + evidenceLabel + ": " + fact.claim.text,
      evidenceIds: Object.freeze(fact.claim.sources.map(source => source.evidenceId)),
      citations: Object.freeze(concrete),
    }));
  }

  const layout = defaultHoidNarrativeLayout(segments.length);
  const composition = composeHoidNarrative({
    segments: segments.map(segment => Object.freeze({
      claimId: segment.claimId,
      text: segment.text,
      evidenceIds: segment.evidenceIds,
    })),
  }, layout);
  if (composition.status !== "ready") return null;

  const presentation: Extract<HoidAnswerPresentation, { status: "ready" }> = Object.freeze({
    status: "ready",
    text: composition.text,
    claimIds: composition.claimIds,
    evidenceIds: composition.evidenceIds,
    citations: Object.freeze([...allCitations.values()].sort((left, right) =>
      (WORK_ORDER.get(left.sourceBookId) ?? 999) - (WORK_ORDER.get(right.sourceBookId) ?? 999) ||
      left.chapter - right.chapter ||
      (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
    )),
    layout: composition.layout,
    segments: Object.freeze(segments),
  });
  return projectHoidAnswerForDisplay(presentation);
}

function unavailable(
  reason: Extract<HoidCharacterEvolutionResult, { status: "unavailable" }>["reason"],
): HoidCharacterEvolutionResult {
  return Object.freeze({ status: "unavailable", reason });
}

function canonicalRequest(value: unknown): Readonly<{
  question: string;
  progress: unknown;
  bookScope: HoidAnswerBookScope;
  depth: HoidExplanationDepth;
}> | null {
  const raw = exactRecord(value, ["question", "progress", "bookScope", "depth"], [
    "question",
    "progress",
    "bookScope",
  ]);
  if (
    !raw ||
    !validText(raw.question) ||
    raw.progress === null ||
    typeof raw.progress !== "object"
  ) return null;
  const bookScope = canonicalizeHoidAnswerBookScope(raw.bookScope);
  const depth = raw.depth === undefined ? "detailed" : raw.depth;
  if (!bookScope || !isHoidExplanationDepth(depth)) return null;
  return Object.freeze({
    question: raw.question,
    progress: raw.progress,
    bookScope,
    depth,
  });
}

function canonicalConfig(value: unknown): AdapterConfig | null {
  const raw = exactRecord(value, ["gateway", "index", "refreshCurrentProgress"]);
  if (
    !raw ||
    !isHoidEntityDossierGateway(raw.gateway) ||
    !isHoidCharacterEvolutionIndex(raw.index) ||
    typeof raw.refreshCurrentProgress !== "function"
  ) return null;
  return Object.freeze({
    gateway: raw.gateway,
    index: raw.index,
    refreshCurrentProgress: raw.refreshCurrentProgress as () => unknown | Promise<unknown>,
  });
}

/**
 * Provider-neutral character evolution projection. It groups only reviewed
 * claims by editorial dimension and evidence availability. It does not infer
 * chronology, causality, personality changes or missing transitions.
 */
export function createHoidCharacterEvolutionExplanationAdapter(
  configInput: unknown,
): HoidCharacterEvolutionExplanationAdapter | null {
  const config = canonicalConfig(configInput);
  if (!config) return null;
  const annotations = EVOLUTION_INDEX_DATA.get(config.index as object);
  if (!annotations) return null;

  return Object.freeze({
    async answer(
      input: unknown,
      options: Readonly<{ signal?: AbortSignal }> = {},
    ): Promise<HoidCharacterEvolutionResult> {
      if (options.signal?.aborted) return unavailable("cancelled");
      const request = canonicalRequest(input);
      if (!request) return unavailable("invalid-request");
      const intent: HoidCharacterEvolutionIntent =
        classifyHoidCharacterEvolutionIntent(request.question);
      if (intent.status === "not-evolution") return Object.freeze({ status: "not-evolution" });
      if (intent.status === "needs-name") return Object.freeze({ status: "needs-name" });
      if (intent.status === "invalid") return unavailable("invalid-request");

      const requested = progressIdentity(request.progress);
      if (!requested) return unavailable("invalid-progress");

      let beforeSnapshot: unknown;
      try {
        beforeSnapshot = await config.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const before = progressIdentity(beforeSnapshot);
      if (!before) return unavailable("invalid-progress");
      if (!sameProgress(requested, before)) return unavailable("progress-changed");

      let gatewayResult: HoidEntityDossierGatewayResult;
      try {
        gatewayResult = config.gateway.getDossier({
          progress: beforeSnapshot,
          query: {
            text: intent.characterName,
            kind: "character",
            bookScope: request.bookScope,
          },
        });
      } catch {
        return unavailable("invalid-dossier");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      if (gatewayResult.status === "unavailable") {
        return unavailable(
          gatewayResult.reason === "progress-changed" ? "progress-changed" :
          gatewayResult.reason === "invalid-progress" ? "invalid-progress" :
          "invalid-dossier",
        );
      }
      if (gatewayResult.status !== "ready") return Object.freeze({ status: "not-found" });
      if (
        gatewayResult.progressRevision !== before.revision ||
        gatewayResult.progressFingerprint !== before.fingerprint
      ) return unavailable("progress-changed");

      const dossier = canonicalDossier(gatewayResult.dossier, request.bookScope, before);
      if (!dossier) return unavailable("invalid-dossier");

      const byClaimId = new Map(dossier.claims.map(claim => [claim.claimId, claim] as const));
      const selected: SelectedFact[] = [];
      for (const annotation of annotations) {
        if (annotation.characterId !== dossier.entity.id) continue;
        const claim = byClaimId.get(annotation.claimId);
        // An absent claim may be locked or outside the reader-selected scope.
        if (!claim) continue;
        if (claim.intent === "recommend") continue;
        if (!claim.participants.some(item =>
          item.id === dossier.entity.id && item.kind === "character"
        )) return unavailable("invalid-index");

        const digest = claimDigest(claim);
        if (
          annotation.review.claimSha256 !== digest ||
          annotation.review.annotationSha256 !== annotationDigest({
            id: annotation.id,
            characterId: annotation.characterId,
            claimId: annotation.claimId,
            dimension: annotation.dimension,
            evidenceKind: annotation.evidenceKind,
          }, digest)
        ) return unavailable("invalid-index");

        if (intent.dimension && annotation.dimension !== intent.dimension) continue;
        if (!annotationCompatible(annotation, claim)) return unavailable("invalid-index");
        selected.push(Object.freeze({ annotation, claim }));
      }

      if (selected.length === 0) return Object.freeze({ status: "not-found" });

      const budget = resolveHoidExplanationDepthBudget(request.depth);
      if (!budget) return unavailable("invalid-request");
      const evidence = new Set<string>();
      const works = new Set<string>();
      let characterCount = 0;
      let hasCrossWorkFact = false;
      for (const fact of selected) {
        const factWorks = new Set(fact.claim.sources.map(source => source.sourceBookId));
        if (factWorks.size >= 2) hasCrossWorkFact = true;
        for (const source of fact.claim.sources) {
          evidence.add(source.evidenceId);
          works.add(source.sourceBookId);
        }
        characterCount += DIMENSION_LABEL[fact.annotation.dimension].length +
          (fact.annotation.evidenceKind === "transition" ? 23 : 22) +
          fact.claim.text.length;
      }
      if (
        selected.length > budget.maxClaims ||
        evidence.size > budget.maxEvidence ||
        works.size > budget.maxWorks ||
        characterCount > budget.maxCharacters ||
        works.size < budget.minimumWorks ||
        (budget.requireCrossWorkSegment && !hasCrossWorkFact)
      ) return unavailable("budget-exceeded");

      const presentation = buildPresentation(selected);
      if (!presentation) return unavailable("invalid-dossier");
      if (presentation.text.length > budget.maxCharacters) return unavailable("budget-exceeded");

      let afterSnapshot: unknown;
      try {
        afterSnapshot = await config.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const after = progressIdentity(afterSnapshot);
      if (!after) return unavailable("invalid-progress");
      if (!sameProgress(before, after)) return unavailable("progress-changed");

      return Object.freeze({
        status: "ready",
        characterLabel: dossier.entity.label,
        semantics: "reading-order-evidence",
        presentation,
        progressRevision: after.revision,
        progressFingerprint: after.fingerprint,
      });
    },
  });
}

/** Production composition uses the empty registry until reviewed facts are promoted. */
export function createProductionHoidCharacterEvolutionIndex(): HoidCharacterEvolutionIndex | null {
  return createHoidCharacterEvolutionIndex(HOID_CHARACTER_EVOLUTION_ANNOTATIONS);
}

export function isHoidCharacterEvolutionDimension(
  value: unknown,
): value is HoidCharacterEvolutionDimension {
  return typeof value === "string" && (DIMENSIONS as readonly string[]).includes(value);
}
