import {
  isHoidEntityDossierGateway,
  type HoidEntityDossierGateway,
  type HoidEntityDossierGatewayResult,
} from "./entityDossierGateway";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import {
  canonicalEvidenceScope,
  isEvidenceUnlocked,
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
import {
  classifyHoidMagicSystemExplanationIntent,
  type HoidMagicSystemFacet,
  type HoidMagicSystemExplanationIntent,
} from "./magicSystemExplanationIntent";

export type { HoidMagicSystemFacet } from "./magicSystemExplanationIntent";

export type HoidMagicSystemFactAnnotationCore = Readonly<{
  id: string;
  magicSystemId: string;
  claimId: string;
  facet: HoidMagicSystemFacet;
}>;

export type HoidMagicSystemFactReview = Readonly<{
  status: "approved";
  origin: "original-editorial";
  reviewerId: string;
  reviewedAt: string;
  claimSha256: string;
  annotationSha256: string;
}>;

export type HoidMagicSystemFactAnnotation = HoidMagicSystemFactAnnotationCore & Readonly<{
  review: HoidMagicSystemFactReview;
}>;

type CanonicalParticipant = Readonly<{
  id: string;
  kind: string;
  label: string;
}>;

type CanonicalClaim = Readonly<{
  claimId: string;
  intent: "explain" | "context" | "recommend";
  text: string;
  participants: readonly CanonicalParticipant[];
  sources: readonly HoidEvidenceCitation[];
}>;

type CanonicalAnnotation = Readonly<{
  id: string;
  magicSystemId: string;
  claimId: string;
  facet: HoidMagicSystemFacet;
  review: HoidMagicSystemFactReview;
}>;

export type HoidMagicSystemFactIndex = Readonly<{
  getForMagicSystem(magicSystemId: string): readonly HoidMagicSystemFactAnnotation[];
}>;

export type HoidMagicSystemExplanationResult =
  | Readonly<{ status: "not-magic" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "ready";
      systemLabel: string;
      facet?: HoidMagicSystemFacet;
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

export type HoidMagicSystemExplanationAdapter = Readonly<{
  answer(
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<HoidMagicSystemExplanationResult>;
}>;

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[];
}>;

type AdapterConfig = Readonly<{
  gateway: HoidEntityDossierGateway;
  factIndex: HoidMagicSystemFactIndex;
  refreshCurrentProgress: () => unknown | Promise<unknown>;
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const FACETS: readonly HoidMagicSystemFacet[] = Object.freeze([
  "principle",
  "rule",
  "limitation",
  "cost",
  "application",
  "exception",
  "interaction",
]);
const FACET_ORDER = new Map(FACETS.map((facet, index) => [facet, index] as const));
const FACET_LABEL: Readonly<Record<HoidMagicSystemFacet, string>> = Object.freeze({
  principle: "Principio",
  rule: "Regla",
  limitation: "Limitación",
  cost: "Coste",
  application: "Aplicación",
  exception: "Excepción",
  interaction: "Interacción",
});
const TITLE_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
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

const FACT_INDEXES = new WeakSet<object>();
const FACT_INDEX_DATA = new WeakMap<object, readonly CanonicalAnnotation[]>();

/**
 * Production annotations stay empty until original magic-system facts have
 * been independently reviewed and promoted by the trusted host.
 */
export const HOID_MAGIC_SYSTEM_FACT_ANNOTATIONS: readonly unknown[] = Object.freeze([]);

export function getHoidMagicSystemFactRegistryStatus(): "empty" | "ready" {
  return HOID_MAGIC_SYSTEM_FACT_ANNOTATIONS.length > 0 ? "ready" : "empty";
}

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

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\\u0000-\\u001F\\u007F\\p{Cf}]/u.test(value);
}

function validId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 128 &&
    value === value.trim() &&
    ID_PATTERN.test(value);
}

function canonicalAnnotationCore(value: unknown): HoidMagicSystemFactAnnotationCore | null {
  const raw = exactRecord(value, ["id", "magicSystemId", "claimId", "facet"]);
  if (
    !raw ||
    !validId(raw.id) ||
    !validId(raw.magicSystemId) ||
    !validId(raw.claimId) ||
    typeof raw.facet !== "string" ||
    !(FACETS as readonly string[]).includes(raw.facet)
  ) return null;
  return Object.freeze({
    id: raw.id,
    magicSystemId: raw.magicSystemId,
    claimId: raw.claimId,
    facet: raw.facet as HoidMagicSystemFacet,
  });
}

function canonicalSource(
  value: unknown,
  scope: HoidAnswerBookScope,
  reading: ProgressIdentity["reading"],
  resolved = false,
): HoidEvidenceCitation | null {
  const source = exactRecord(value, resolved ? RESOLVED_SOURCE_KEYS : CITATION_KEYS);
  if (
    !source ||
    !validId(source.evidenceId) ||
    typeof source.sourceBookId !== "string" ||
    !TITLE_BY_ID.has(source.sourceBookId) ||
    typeof source.sourceChapter !== "number" ||
    !Number.isSafeInteger(source.sourceChapter) ||
    source.sourceChapter < 1 ||
    !validText(source.locatorId, 256) ||
    typeof source.unlockBookId !== "string" ||
    source.unlockBookId !== source.sourceBookId ||
    typeof source.unlockChapter !== "number" ||
    !Number.isSafeInteger(source.unlockChapter) ||
    source.unlockChapter < source.sourceChapter ||
    !canonicalEvidenceScope(
      {
        bookId: source.sourceBookId,
        chapter: source.sourceChapter,
        locatorId: source.locatorId,
      },
      {
        bookId: source.unlockBookId,
        chapter: source.unlockChapter,
      },
    ) ||
    !claimEvidenceMatchesHoidBookScope([source.sourceBookId], scope)
  ) return null;

  if (resolved && (
    !validText(source.editionId, 256) ||
    typeof source.navigationSha256 !== "string" ||
    !SHA_PATTERN.test(source.navigationSha256) ||
    typeof source.documentSha256 !== "string" ||
    !SHA_PATTERN.test(source.documentSha256)
  )) return null;

  const citation: HoidEvidenceCitation = Object.freeze({
    evidenceId: source.evidenceId,
    sourceBookId: source.sourceBookId,
    sourceChapter: source.sourceChapter,
    locatorId: source.locatorId,
    unlockBookId: source.unlockBookId,
    unlockChapter: source.unlockChapter,
  });
  return isEvidenceUnlocked(citation, reading) ? citation : null;
}

function sameSource(left: HoidEvidenceCitation, right: HoidEvidenceCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.sourceChapter === right.sourceChapter &&
    left.locatorId === right.locatorId &&
    left.unlockBookId === right.unlockBookId &&
    left.unlockChapter === right.unlockChapter;
}

function canonicalClaim(value: unknown): CanonicalClaim | null {
  const raw = exactRecord(value, ["claimId", "intent", "text", "participants", "sources"]);
  if (
    !raw ||
    !validId(raw.claimId) ||
    (raw.intent !== "explain" && raw.intent !== "context" && raw.intent !== "recommend") ||
    !validText(raw.text, 4_000)
  ) return null;

  const rawParticipants = denseArray(raw.participants, 1, MAX_PARTICIPANTS);
  const rawSources = denseArray(raw.sources, 1, MAX_SOURCES_PER_CLAIM);
  if (!rawParticipants || !rawSources) return null;

  const participants: CanonicalParticipant[] = [];
  const participantIds = new Set<string>();
  for (const item of rawParticipants) {
    const participant = exactRecord(item, ["id", "kind", "label"]);
    if (
      !participant ||
      !validId(participant.id) ||
      typeof participant.kind !== "string" ||
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

  const sources: HoidEvidenceCitation[] = [];
  const evidenceIds = new Set<string>();
  for (const item of rawSources) {
    const source = exactRecord(item, CITATION_KEYS);
    if (!source || !validId(source.evidenceId) || evidenceIds.has(source.evidenceId)) return null;
    evidenceIds.add(source.evidenceId);
    // Full progress/scope checks are applied when the dossier is projected.
    if (
      typeof source.sourceBookId !== "string" ||
      !TITLE_BY_ID.has(source.sourceBookId) ||
      typeof source.sourceChapter !== "number" ||
      !Number.isSafeInteger(source.sourceChapter) ||
      source.sourceChapter < 1 ||
      !validText(source.locatorId, 256) ||
      typeof source.unlockBookId !== "string" ||
      source.unlockBookId !== source.sourceBookId ||
      typeof source.unlockChapter !== "number" ||
      !Number.isSafeInteger(source.unlockChapter) ||
      source.unlockChapter < source.sourceChapter
    ) return null;
    sources.push(Object.freeze({
      evidenceId: source.evidenceId,
      sourceBookId: source.sourceBookId,
      sourceChapter: source.sourceChapter,
      locatorId: source.locatorId,
      unlockBookId: source.unlockBookId,
      unlockChapter: source.unlockChapter,
    }));
  }

  participants.sort((left, right) => left.id.localeCompare(right.id));
  sources.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  return Object.freeze({
    claimId: raw.claimId,
    intent: raw.intent,
    text: raw.text,
    participants: Object.freeze(participants),
    sources: Object.freeze(sources),
  });
}

function canonicalReview(value: unknown): HoidMagicSystemFactReview | null {
  const raw = exactRecord(value, [
    "status",
    "origin",
    "reviewerId",
    "reviewedAt",
    "claimSha256",
    "annotationSha256",
  ]);
  if (
    !raw ||
    raw.status !== "approved" ||
    raw.origin !== "original-editorial" ||
    !validText(raw.reviewerId, 64) ||
    !/^[a-z0-9][a-z0-9._-]{1,63}$/u.test(raw.reviewerId) ||
    typeof raw.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(raw.reviewedAt)) ||
    new Date(raw.reviewedAt).toISOString() !== raw.reviewedAt ||
    typeof raw.claimSha256 !== "string" ||
    !SHA_PATTERN.test(raw.claimSha256) ||
    typeof raw.annotationSha256 !== "string" ||
    !SHA_PATTERN.test(raw.annotationSha256)
  ) return null;
  return Object.freeze({
    status: "approved",
    origin: "original-editorial",
    reviewerId: raw.reviewerId,
    reviewedAt: raw.reviewedAt,
    claimSha256: raw.claimSha256,
    annotationSha256: raw.annotationSha256,
  });
}

function claimDigest(claim: CanonicalClaim): string {
  // Bind stable participant identity, not the alias selected by the reader.
  // The dossier gateway separately authorizes every displayed participant label.
  return sha256Hex(JSON.stringify({
    claimId: claim.claimId,
    intent: claim.intent,
    text: claim.text,
    participants: claim.participants.map(item => ({
      id: item.id,
      kind: item.kind,
    })),
    sources: claim.sources,
  }));
}

function annotationDigest(
  core: HoidMagicSystemFactAnnotationCore,
  claimSha256: string,
): string {
  return sha256Hex(JSON.stringify({
    schemaVersion: 1,
    annotation: core,
    claimSha256,
  }));
}

/**
 * Creates deterministic review digests for an editorial fact annotation.
 * The digest detects later changes; it is not a digital signature and does
 * not authenticate reviewer identity. Production promotion remains host-owned.
 */
export function createHoidMagicSystemFactReview(
  annotationInput: unknown,
  claimInput: unknown,
  reviewerInput: unknown,
): HoidMagicSystemFactReview | null {
  const annotation = canonicalAnnotationCore(annotationInput);
  const claim = canonicalClaim(claimInput);
  const reviewer = exactRecord(reviewerInput, ["reviewerId", "reviewedAt"]);
  if (!annotation || !claim || !reviewer) return null;
  if (
    claim.claimId !== annotation.claimId ||
    !claim.participants.some(item => item.id === annotation.magicSystemId && item.kind === "magic") ||
    claim.intent === "recommend" ||
    !validText(reviewer.reviewerId, 64) ||
    !/^[a-z0-9][a-z0-9._-]{1,63}$/u.test(reviewer.reviewerId) ||
    typeof reviewer.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(reviewer.reviewedAt)) ||
    new Date(reviewer.reviewedAt).toISOString() !== reviewer.reviewedAt
  ) return null;

  const claimSha256 = claimDigest(claim);
  return Object.freeze({
    status: "approved",
    origin: "original-editorial",
    reviewerId: reviewer.reviewerId,
    reviewedAt: reviewer.reviewedAt,
    claimSha256,
    annotationSha256: annotationDigest(annotation, claimSha256),
  });
}

function canonicalAnnotation(value: unknown): CanonicalAnnotation | null {
  const raw = exactRecord(value, ["id", "magicSystemId", "claimId", "facet", "review"]);
  if (!raw) return null;
  const core = canonicalAnnotationCore({
    id: raw.id,
    magicSystemId: raw.magicSystemId,
    claimId: raw.claimId,
    facet: raw.facet,
  });
  const review = canonicalReview(raw.review);
  if (!core || !review) return null;
  return Object.freeze({ ...core, review });
}

export function createHoidMagicSystemFactIndex(
  value: unknown,
): HoidMagicSystemFactIndex | null {
  const raw = denseArray(value, 0, MAX_ANNOTATIONS);
  if (!raw) return null;
  const annotations: CanonicalAnnotation[] = [];
  const ids = new Set<string>();
  const claims = new Set<string>();

  for (const item of raw) {
    const annotation = canonicalAnnotation(item);
    if (
      !annotation ||
      ids.has(annotation.id) ||
      claims.has(annotation.claimId)
    ) return null;
    ids.add(annotation.id);
    claims.add(annotation.claimId);
    annotations.push(annotation);
  }

  annotations.sort((left, right) =>
    (FACET_ORDER.get(left.facet) ?? 0) - (FACET_ORDER.get(right.facet) ?? 0) ||
    left.id.localeCompare(right.id)
  );
  const frozen = Object.freeze(annotations);
  const index: HoidMagicSystemFactIndex = Object.freeze({
    getForMagicSystem(magicSystemId: string): readonly HoidMagicSystemFactAnnotation[] {
      if (!validId(magicSystemId)) return Object.freeze([]);
      return Object.freeze(
        frozen
          .filter(item => item.magicSystemId === magicSystemId)
          .map(item => Object.freeze({
            id: item.id,
            magicSystemId: item.magicSystemId,
            claimId: item.claimId,
            facet: item.facet,
            review: item.review,
          })),
      );
    },
  });
  FACT_INDEXES.add(index as object);
  FACT_INDEX_DATA.set(index as object, frozen);
  return index;
}

export function isHoidMagicSystemFactIndex(value: unknown): value is HoidMagicSystemFactIndex {
  return value !== null &&
    typeof value === "object" &&
    FACT_INDEXES.has(value as object);
}

function progressIdentity(value: unknown): ProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
    reading: projection.reading,
  });
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function unavailable(
  reason: Extract<HoidMagicSystemExplanationResult, { status: "unavailable" }>["reason"],
): HoidMagicSystemExplanationResult {
  return Object.freeze({ status: "unavailable", reason });
}

type CanonicalDossier = Readonly<{
  entity: Readonly<{ id: string; label: string }>;
  claims: readonly CanonicalClaim[];
}>;

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
    !validText(dossier.dossierId, 64) ||
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
    entity.kind !== "magic" ||
    !validText(entity.label, 256)
  ) return null;
  const entitySource = canonicalSource(entity.source, scope, progress.reading, true);
  if (!entitySource || entitySource.evidenceId !== entity.id) return null;

  const aliases = denseArray(entity.aliasEvidence, 1, MAX_ALIAS_EVIDENCE);
  if (!aliases) return null;
  const aliasIds = new Set<string>();
  for (const item of aliases) {
    const alias = exactRecord(item, ["evidenceId", "source"]);
    if (
      !alias ||
      !validId(alias.evidenceId) ||
      aliasIds.has(alias.evidenceId)
    ) return null;
    const source = canonicalSource(alias.source, scope, progress.reading, true);
    if (!source || source.evidenceId !== alias.evidenceId) return null;
    aliasIds.add(alias.evidenceId);
  }

  const summary = exactRecord(dossier.summary, ["text", "source"]);
  if (!summary || !validText(summary.text, 4_000)) return null;
  const summarySource = canonicalSource(summary.source, scope, progress.reading);
  if (!summarySource || !sameSource(entitySource, summarySource)) return null;

  const rawClaims = denseArray(dossier.claims, 0, MAX_CLAIMS);
  if (!rawClaims) return null;
  const claims: CanonicalClaim[] = [];
  const claimIds = new Set<string>();
  for (const rawClaim of rawClaims) {
    const claim = canonicalClaim(rawClaim);
    if (!claim || claimIds.has(claim.claimId)) return null;
    claimIds.add(claim.claimId);
    if (!claim.participants.some(item => item.id === entity.id && item.kind === "magic")) {
      return null;
    }
    for (const source of claim.sources) {
      if (!canonicalSource(source, scope, progress.reading)) return null;
    }
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

function buildPresentation(
  facts: readonly Readonly<{ annotation: CanonicalAnnotation; claim: CanonicalClaim }>[],
): HoidAnswerDisplayProjection | null {
  const segments: HoidPresentedSegment[] = [];
  const allCitations = new Map<string, HoidPresentedCitation>();
  for (const fact of facts) {
    const citations = fact.claim.sources.map(presentedCitation);
    if (citations.some(item => item === null)) return null;
    const concrete = citations as HoidPresentedCitation[];
    for (const citation of concrete) {
      const existing = allCitations.get(citation.evidenceId);
      if (existing && (
        existing.sourceBookId !== citation.sourceBookId ||
        existing.chapter !== citation.chapter ||
        existing.locatorId !== citation.locatorId
      )) return null;
      allCitations.set(citation.evidenceId, citation);
    }
    segments.push(Object.freeze({
      claimId: fact.claim.claimId,
      text: FACET_LABEL[fact.annotation.facet] + ": " + fact.claim.text,
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
      left.sourceBookId.localeCompare(right.sourceBookId) ||
      left.chapter - right.chapter ||
      left.evidenceId.localeCompare(right.evidenceId)
    )),
    layout: composition.layout,
    segments: Object.freeze(segments),
  });
  return projectHoidAnswerForDisplay(presentation);
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
    !validText(raw.question, 4_000) ||
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
  const raw = exactRecord(value, ["gateway", "factIndex", "refreshCurrentProgress"]);
  if (
    !raw ||
    !isHoidEntityDossierGateway(raw.gateway) ||
    !isHoidMagicSystemFactIndex(raw.factIndex) ||
    typeof raw.refreshCurrentProgress !== "function"
  ) return null;
  return Object.freeze({
    gateway: raw.gateway,
    factIndex: raw.factIndex,
    refreshCurrentProgress: raw.refreshCurrentProgress as () => unknown | Promise<unknown>,
  });
}

/**
 * A provider-neutral, progress-bound magic-system explanation adapter.
 * It consumes only a branded local dossier gateway and independently reviewed
 * facet annotations that point to claims already present in that dossier.
 */
export function createHoidMagicSystemExplanationAdapter(
  configInput: unknown,
): HoidMagicSystemExplanationAdapter | null {
  const config = canonicalConfig(configInput);
  if (!config) return null;
  const annotations = FACT_INDEX_DATA.get(config.factIndex as object);
  if (!annotations) return null;

  return Object.freeze({
    async answer(
      input: unknown,
      options: Readonly<{ signal?: AbortSignal }> = {},
    ): Promise<HoidMagicSystemExplanationResult> {
      if (options.signal?.aborted) return unavailable("cancelled");
      const request = canonicalRequest(input);
      if (!request) return unavailable("invalid-request");
      const intent: HoidMagicSystemExplanationIntent =
        classifyHoidMagicSystemExplanationIntent(request.question);
      if (intent.status === "not-magic") return Object.freeze({ status: "not-magic" });
      if (intent.status === "needs-name") return Object.freeze({ status: "needs-name" });
      if (intent.status === "invalid") return unavailable("invalid-request");

      const scope = request.bookScope;
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
            text: intent.systemName,
            kind: "magic",
            bookScope: scope,
          },
        });
      } catch {
        return unavailable("invalid-dossier");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      if (gatewayResult.status === "not-found" || gatewayResult.status === "ambiguous") {
        return Object.freeze({ status: "not-found" });
      }
      if (gatewayResult.status === "unavailable") {
        return unavailable(
          gatewayResult.reason === "progress-changed" ? "progress-changed" :
          gatewayResult.reason === "invalid-progress" ? "invalid-progress" :
          "invalid-dossier",
        );
      }

      const dossier = canonicalDossier(gatewayResult.dossier, scope, before);
      if (!dossier) return unavailable("invalid-dossier");

      const byClaimId = new Map(dossier.claims.map(claim => [claim.claimId, claim] as const));
      const selected: { annotation: CanonicalAnnotation; claim: CanonicalClaim }[] = [];
      for (const annotation of annotations) {
        if (annotation.magicSystemId !== dossier.entity.id) continue;
        const claim = byClaimId.get(annotation.claimId);
        // Missing claims are intentionally indistinguishable from claims whose
        // source or participant remains locked and therefore absent in the dossier.
        if (!claim) continue;
        if (claim.intent === "recommend") continue;
        if (!claim.participants.some(item => item.id === dossier.entity.id && item.kind === "magic")) {
          return unavailable("invalid-index");
        }
        const digest = claimDigest(claim);
        if (
          annotation.review.claimSha256 !== digest ||
          annotation.review.annotationSha256 !== annotationDigest({
            id: annotation.id,
            magicSystemId: annotation.magicSystemId,
            claimId: annotation.claimId,
            facet: annotation.facet,
          }, digest)
        ) return unavailable("invalid-index");
        if (intent.facet && annotation.facet !== intent.facet) continue;
        if (annotation.facet === "interaction" && claim.participants.length < 2) {
          return unavailable("invalid-index");
        }
        selected.push({ annotation, claim });
      }

      if (selected.length === 0) return Object.freeze({ status: "not-found" });

      const budget = resolveHoidExplanationDepthBudget(request.depth);
      if (!budget) return unavailable("invalid-request");
      const claimCount = selected.length;
      const evidence = new Map<string, HoidEvidenceCitation>();
      const works = new Set<string>();
      let characterCount = 0;
      let hasCrossWorkFact = false;
      for (const item of selected) {
        const factWorks = new Set(item.claim.sources.map(source => source.sourceBookId));
        if (factWorks.size >= 2) hasCrossWorkFact = true;
        for (const source of item.claim.sources) {
          evidence.set(source.evidenceId, source);
          works.add(source.sourceBookId);
        }
        characterCount += FACET_LABEL[item.annotation.facet].length + 2 + item.claim.text.length;
      }
      if (
        claimCount > budget.maxClaims ||
        evidence.size > budget.maxEvidence ||
        works.size > budget.maxWorks ||
        characterCount > budget.maxCharacters ||
        works.size < budget.minimumWorks ||
        (budget.requireCrossWorkSegment && !hasCrossWorkFact)
      ) return unavailable("budget-exceeded");

      const presentation = buildPresentation(selected);
      if (!presentation) return unavailable("invalid-dossier");

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
        systemLabel: dossier.entity.label,
        ...(intent.facet ? { facet: intent.facet } : {}),
        presentation,
        progressRevision: after.revision,
        progressFingerprint: after.fingerprint,
      });
    },
  });
}

/** Compose against the empty production registry until reviewed facts exist. */
export function createProductionHoidMagicSystemFactIndex(): HoidMagicSystemFactIndex | null {
  return createHoidMagicSystemFactIndex(HOID_MAGIC_SYSTEM_FACT_ANNOTATIONS);
}

/** Exposes the intent parser's closed facet set to UI and validation code. */
export function isHoidMagicSystemFacet(value: unknown): value is HoidMagicSystemFacet {
  return typeof value === "string" && (FACETS as readonly string[]).includes(value);
}
