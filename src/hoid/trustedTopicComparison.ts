import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import type { HoidPresentedCitation } from "./answerPresentation";
import type { HoidEvidenceCitation } from "./evidenceScope";
import { resolveProductionHoidTopicAssignments } from "./topicAssignmentActivation";
import {
  getHoidTopicDefinition,
  getHoidTopicDimensionDefinition,
  validateHoidTopicAssignments,
  type HoidTopicAssignment,
  type HoidTopicAssignmentValidation,
  type HoidTopicSubjectKind,
} from "./topicTaxonomy";
import type { HoidTrustedScreenAnswerPort } from "./trustedScreenAnswer";
import { sha256Hex } from "./sha256";

export type HoidTrustedTopicComparisonEntry = Readonly<{
  subjectKind: HoidTopicSubjectKind;
  subjectId: string;
  worldId: string;
  worldLabel: string;
  claimId: string;
  text: string;
  citations: readonly HoidPresentedCitation[];
}>;

export type HoidTrustedTopicComparison = Readonly<{
  comparisonId: string;
  topicId: string;
  topicLabel: string;
  dimensionId: string;
  dimensionLabel: string;
  mode: "side-by-side";
  inference: "none";
  entries: readonly HoidTrustedTopicComparisonEntry[];
}>;

export type HoidTrustedTopicComparisonResult =
  | Readonly<{
      status: "ready";
      comparison: HoidTrustedTopicComparison;
      progressRevision: number;
      progressFingerprint: string;
      verifiedClaimCount: number;
    }>
  | Readonly<{ status: "not-cross-world" }>
  | Readonly<{
      status: "withheld";
      reason:
        | "invalid-input"
        | "assignment-authority-unavailable"
        | "invalid-progress"
        | "progress-changed"
        | "no-authorized-comparison"
        | "approved-claims-unavailable"
        | "claim-presentation-withheld"
        | "invalid-claim-presentation"
        | "assignment-authority-changed";
    }>;

export type HoidTrustedTopicComparisonPresenterConfig = Readonly<{
  /** Local-only loader. It returns claim envelopes, never provider-authored prose. */
  loadApprovedClaims: (
    claimIds: readonly string[],
    progressSnapshot: unknown,
  ) => unknown | Promise<unknown>;
  /** The same host-owned Ed25519 presenter used for ordinary narrative answers. */
  trustedAnswerPort: HoidTrustedScreenAnswerPort;
  /** Durable read-through to the host-owned SQLite cursor coordinator. */
  refreshCurrentProgress: () => unknown | Promise<unknown>;
  /** Trusted host/test seams. Production defaults to the activated local registry and validator. */
  resolveApprovedAssignments?: () => unknown;
  validateAssignments?: (assignments: unknown) => HoidTopicAssignmentValidation;
}>;

export type HoidTrustedTopicComparisonPresenter = Readonly<{
  /** Accepts only topic/dimension/subject IDs; progress, prose and world labels are host-derived. */
  present(input: unknown): Promise<HoidTrustedTopicComparisonResult>;
}>;

type ProgressIdentity = Readonly<{ revision: number; fingerprint: string }>;
type ReceiptIdentity = Readonly<{
  receiptFingerprint: string;
  assignmentFingerprint: string;
  evidenceFingerprint: string;
  assignmentIds: readonly string[];
}>;
type VerifiedClaim = Readonly<{
  text: string;
  evidenceIds: readonly string[];
  citations: readonly HoidPresentedCitation[];
}>;
type CanonicalRequestEntry = Readonly<{
  subjectKind: HoidTopicSubjectKind;
  subjectId: string;
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_ENTRIES = 4;
const MAX_EVIDENCE_PER_CLAIM = 16;
const MAX_CLAIM_TEXT = 6_000;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));

function exactRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowed.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
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

function readDataProperty(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true
    ) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
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

function canonicalIds(value: unknown, minimum: number, maximum: number): readonly string[] | null {
  const entries = denseArray(value, minimum, maximum);
  if (!entries) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (
      typeof entry !== "string" ||
      entry.length > 128 ||
      !ID_PATTERN.test(entry) ||
      seen.has(entry)
    ) return null;
    seen.add(entry);
    ids.push(entry);
  }
  return Object.freeze(ids);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    [...left].sort().join("\n") === [...right].sort().join("\n");
}

function safeText(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_CLAIM_TEXT &&
    value === value.trim() &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

function canonicalRequest(value: unknown): Readonly<{
  topicId: string;
  dimensionId: string;
  entries: readonly CanonicalRequestEntry[];
}> | null {
  const raw = exactRecord(value, ["topicId", "dimensionId", "entries"]);
  if (
    !raw ||
    typeof raw.topicId !== "string" ||
    !ID_PATTERN.test(raw.topicId) ||
    typeof raw.dimensionId !== "string" ||
    !ID_PATTERN.test(raw.dimensionId)
  ) return null;
  const rawEntries = denseArray(raw.entries, 2, MAX_ENTRIES);
  if (!rawEntries) return null;
  const entries: CanonicalRequestEntry[] = [];
  const subjects = new Set<string>();
  let subjectKind: HoidTopicSubjectKind | null = null;
  for (const item of rawEntries) {
    const entry = exactRecord(item, ["subjectKind", "subjectId"]);
    if (
      !entry ||
      (entry.subjectKind !== "entity" && entry.subjectKind !== "work") ||
      typeof entry.subjectId !== "string" ||
      !ID_PATTERN.test(entry.subjectId)
    ) return null;
    if (subjectKind !== null && subjectKind !== entry.subjectKind) return null;
    subjectKind = entry.subjectKind;
    const key = entry.subjectKind + ":" + entry.subjectId;
    if (subjects.has(key)) return null;
    subjects.add(key);
    entries.push(Object.freeze({
      subjectKind: entry.subjectKind,
      subjectId: entry.subjectId,
    }));
  }
  return Object.freeze({
    topicId: raw.topicId,
    dimensionId: raw.dimensionId,
    entries: Object.freeze(entries),
  });
}

function progressIdentity(value: unknown): ProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

async function readProgress(refresh: () => unknown | Promise<unknown>): Promise<unknown | null> {
  try {
    return await refresh();
  } catch {
    return null;
  }
}

function canonicalReceiptIdentity(
  receipt: unknown,
  assignments: readonly HoidTopicAssignment[],
): ReceiptIdentity | null {
  const receiptFingerprint = readDataProperty(receipt, "receiptFingerprint");
  const assignmentFingerprint = readDataProperty(receipt, "assignmentFingerprint");
  const evidenceFingerprint = readDataProperty(receipt, "evidenceFingerprint");
  const assignmentIds = canonicalIds(readDataProperty(receipt, "assignmentIds"), 0, 512);
  if (
    typeof receiptFingerprint !== "string" || !SHA_PATTERN.test(receiptFingerprint) ||
    typeof assignmentFingerprint !== "string" || !SHA_PATTERN.test(assignmentFingerprint) ||
    typeof evidenceFingerprint !== "string" || !SHA_PATTERN.test(evidenceFingerprint) ||
    !assignmentIds
  ) return null;
  const expectedIds = assignments.map(item => item.id).sort();
  if (!sameIds(assignmentIds, expectedIds)) return null;
  return Object.freeze({
    receiptFingerprint,
    assignmentFingerprint,
    evidenceFingerprint,
    assignmentIds,
  });
}

function sameReceipt(left: ReceiptIdentity, right: ReceiptIdentity): boolean {
  return left.receiptFingerprint === right.receiptFingerprint &&
    left.assignmentFingerprint === right.assignmentFingerprint &&
    left.evidenceFingerprint === right.evidenceFingerprint &&
    sameIds(left.assignmentIds, right.assignmentIds);
}

function resolveActiveAssignments(
  resolver: () => unknown,
  validator: (assignments: unknown) => HoidTopicAssignmentValidation,
): Readonly<{
  assignments: readonly HoidTopicAssignment[];
  evidenceCitations: readonly HoidEvidenceCitation[];
  entityFirstAppearances: readonly Readonly<{
    entityId: string;
    bookId: string;
    chapter: number;
  }>[];
  receipt: ReceiptIdentity;
}> | null {
  let resolution: unknown;
  try {
    resolution = resolver();
  } catch {
    return null;
  }
  const active = exactRecord(resolution, ["status", "assignments", "receipt"]);
  if (!active || active.status !== "active") return null;
  let validation: HoidTopicAssignmentValidation;
  try {
    validation = validator(active.assignments);
  } catch {
    return null;
  }
  if (validation.status !== "valid") return null;
  const receipt = canonicalReceiptIdentity(active.receipt, validation.assignments);
  if (!receipt) return null;
  return Object.freeze({
    assignments: validation.assignments,
    evidenceCitations: validation.evidenceCitations,
    entityFirstAppearances: validation.entityFirstAppearances,
    receipt,
  });
}

function findAssignment(
  assignments: readonly HoidTopicAssignment[],
  entry: CanonicalRequestEntry,
  topicId: string,
  dimensionId: string,
): HoidTopicAssignment | null {
  const matches = assignments.filter(item =>
    item.subjectKind === entry.subjectKind &&
    item.subjectId === entry.subjectId &&
    item.topicId === topicId &&
    item.dimensionId === dimensionId
  );
  return matches.length === 1 ? matches[0] : null;
}

function subjectIsDisclosed(
  assignment: HoidTopicAssignment,
  firstAppearances: readonly Readonly<{ entityId: string; bookId: string; chapter: number }>[],
  progress: unknown,
): boolean {
  const reading = buildHoidCursorReadingContext(progress);
  if (reading.status !== "ready") return false;
  if (assignment.subjectKind === "work") {
    // A work's world membership can itself be a spoiler. The current taxonomy
    // has no chapter-scoped first-safe marker for work subjects, so require an
    // explicit completion rather than guessing that chapter one is sufficient.
    const work = reading.context.positions.find(item => item.bookId === assignment.subjectId);
    return work?.status === "completed";
  }
  const first = firstAppearances.find(item => item.entityId === assignment.subjectId);
  if (!first) return false;
  const position = reading.context.positions.find(item => item.bookId === first.bookId);
  return Boolean(
    position &&
    (position.status === "completed" ||
      (position.status === "in-progress" &&
        position.completedThroughChapter !== null &&
        position.completedThroughChapter >= first.chapter)),
  );
}

function canonicalClaimRecords(
  value: unknown,
  expectedClaimIds: readonly string[],
): ReadonlyMap<string, unknown> | null {
  const entries = denseArray(value, expectedClaimIds.length, expectedClaimIds.length);
  if (!entries) return null;
  const expected = new Set(expectedClaimIds);
  const records = new Map<string, unknown>();
  for (const item of entries) {
    const record = exactRecord(item, ["claimId", "answer"]);
    if (
      !record ||
      typeof record.claimId !== "string" ||
      !expected.has(record.claimId) ||
      records.has(record.claimId) ||
      record.answer === null ||
      typeof record.answer !== "object" ||
      Array.isArray(record.answer)
    ) return null;
    records.set(record.claimId, record.answer);
  }
  return records.size === expected.size ? records : null;
}

function canonicalCitation(value: unknown): HoidPresentedCitation | null {
  const raw = exactRecord(value, [
    "evidenceId", "sourceBookId", "title", "chapter", "locatorId",
  ]);
  if (
    !raw ||
    typeof raw.evidenceId !== "string" ||
    !ID_PATTERN.test(raw.evidenceId) ||
    typeof raw.sourceBookId !== "string" ||
    !TITLES.has(raw.sourceBookId) ||
    raw.title !== TITLES.get(raw.sourceBookId) ||
    typeof raw.chapter !== "number" ||
    !Number.isSafeInteger(raw.chapter) ||
    raw.chapter < 1 ||
    typeof raw.locatorId !== "string" ||
    raw.locatorId.length < 1 ||
    raw.locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(raw.locatorId)
  ) return null;
  return Object.freeze({
    evidenceId: raw.evidenceId,
    sourceBookId: raw.sourceBookId,
    title: raw.title as string,
    chapter: raw.chapter,
    locatorId: raw.locatorId,
  });
}

function canonicalCitations(value: unknown): readonly HoidPresentedCitation[] | null {
  const entries = denseArray(value, 1, MAX_EVIDENCE_PER_CLAIM);
  if (!entries) return null;
  const citations: HoidPresentedCitation[] = [];
  const seen = new Set<string>();
  for (const item of entries) {
    const citation = canonicalCitation(item);
    if (!citation || seen.has(citation.evidenceId)) return null;
    seen.add(citation.evidenceId);
    citations.push(citation);
  }
  return Object.freeze(citations);
}

function sameCitation(left: HoidPresentedCitation, right: HoidPresentedCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.locatorId === right.locatorId;
}

function sameCitations(
  left: readonly HoidPresentedCitation[],
  right: readonly HoidPresentedCitation[],
): boolean {
  return left.length === right.length &&
    left.every((item, index) => sameCitation(item, right[index]));
}

function citationsMatchRegistry(
  citations: readonly HoidPresentedCitation[],
  evidenceIds: readonly string[],
  evidenceCitations: readonly Readonly<{
    evidenceId: string;
    sourceBookId: string;
    sourceChapter: number;
    locatorId: string;
    unlockBookId: string;
    unlockChapter: number;
  }>[],
): boolean {
  if (citations.length !== evidenceIds.length) return false;
  for (const evidenceId of evidenceIds) {
    const citation = citations.find(item => item.evidenceId === evidenceId);
    const source = evidenceCitations.find(item => item.evidenceId === evidenceId);
    const title = source ? TITLES.get(source.sourceBookId) : undefined;
    if (
      !citation || !source || !title ||
      citation.sourceBookId !== source.sourceBookId ||
      citation.chapter !== source.sourceChapter ||
      citation.locatorId !== source.locatorId ||
      citation.title !== title ||
      source.unlockBookId !== source.sourceBookId ||
      source.unlockChapter < source.sourceChapter
    ) return false;
  }
  return true;
}

function canonicalTrustedClaimPresentation(
  value: unknown,
  expectedClaimId: string,
): VerifiedClaim | null {
  const result = exactRecord(value, ["status", "depth", "metrics", "presentation"]);
  if (!result || result.status !== "ready" || result.depth !== "brief") return null;
  const presentation = exactRecord(result.presentation, [
    "status", "text", "claimIds", "evidenceIds", "citations", "layout", "segments",
  ]);
  if (
    !presentation ||
    presentation.status !== "ready" ||
    !safeText(presentation.text) ||
    (presentation.layout !== "plain" && presentation.layout !== "numbered" && presentation.layout !== "grouped")
  ) return null;
  const claimIds = canonicalIds(presentation.claimIds, 1, 1);
  const evidenceIds = canonicalIds(presentation.evidenceIds, 1, MAX_EVIDENCE_PER_CLAIM);
  const citations = canonicalCitations(presentation.citations);
  const segments = denseArray(presentation.segments, 1, 1);
  if (
    !claimIds || claimIds[0] !== expectedClaimId ||
    !evidenceIds || !citations || !segments
  ) return null;
  const segment = exactRecord(segments[0], ["claimId", "text", "evidenceIds", "citations"]);
  if (!segment || segment.claimId !== expectedClaimId || !safeText(segment.text)) return null;
  const segmentEvidenceIds = canonicalIds(segment.evidenceIds, 1, MAX_EVIDENCE_PER_CLAIM);
  const segmentCitations = canonicalCitations(segment.citations);
  if (
    !segmentEvidenceIds ||
    !segmentCitations ||
    !sameIds(evidenceIds, segmentEvidenceIds) ||
    !sameCitations(citations, segmentCitations) ||
    !sameIds(segmentEvidenceIds, segmentCitations.map(item => item.evidenceId)) ||
    segment.text !== presentation.text
  ) return null;
  const metrics = exactRecord(result.metrics, [
    "claimCount", "evidenceCount", "workCount", "characterCount",
  ]);
  const workCount = new Set(citations.map(item => item.sourceBookId)).size;
  if (
    !metrics ||
    metrics.claimCount !== 1 ||
    metrics.evidenceCount !== evidenceIds.length ||
    metrics.workCount !== workCount ||
    metrics.characterCount !== presentation.text.length
  ) return null;
  return Object.freeze({
    text: segment.text,
    evidenceIds,
    citations: segmentCitations,
  });
}

function assignmentEvidenceMatches(
  assignment: HoidTopicAssignment,
  claim: VerifiedClaim,
  evidenceCitations: readonly Readonly<{
    evidenceId: string;
    sourceBookId: string;
    sourceChapter: number;
    locatorId: string;
    unlockBookId: string;
    unlockChapter: number;
  }>[],
): boolean {
  return assignment.claimTextSha256 === sha256Hex(claim.text) &&
    sameIds(assignment.evidenceIds, claim.evidenceIds) &&
    sameIds(assignment.evidenceIds, claim.citations.map(item => item.evidenceId)) &&
    citationsMatchRegistry(claim.citations, assignment.evidenceIds, evidenceCitations);
}

function withheld(
  reason: Extract<HoidTrustedTopicComparisonResult, { status: "withheld" }>["reason"],
): HoidTrustedTopicComparisonResult {
  return Object.freeze({ status: "withheld", reason });
}

/**
 * Trusted cross-world comparison boundary. The caller supplies only canonical
 * subject IDs; the host resolves assignments, progress, claim text and source
 * provenance. Every claim is re-authenticated by the shared Ed25519 presenter.
 *
 * The result is strictly side-by-side. This service never infers equivalence,
 * similarity, causality, chronology or relationships between worlds.
 */
export function createHoidTrustedTopicComparisonPresenter(
  configInput: unknown,
): HoidTrustedTopicComparisonPresenter | null {
  const config = exactRecord(
    configInput,
    ["loadApprovedClaims", "trustedAnswerPort", "refreshCurrentProgress"],
    ["resolveApprovedAssignments", "validateAssignments"],
  );
  if (
    !config ||
    typeof config.loadApprovedClaims !== "function" ||
    typeof config.refreshCurrentProgress !== "function" ||
    (config.resolveApprovedAssignments !== undefined && typeof config.resolveApprovedAssignments !== "function") ||
    (config.validateAssignments !== undefined && typeof config.validateAssignments !== "function")
  ) return null;

  let presentDescriptor: PropertyDescriptor | undefined;
  try {
    presentDescriptor = config.trustedAnswerPort !== null &&
      typeof config.trustedAnswerPort === "object"
      ? Object.getOwnPropertyDescriptor(config.trustedAnswerPort, "present")
      : undefined;
  } catch {
    return null;
  }
  if (
    !presentDescriptor ||
    !Object.prototype.hasOwnProperty.call(presentDescriptor, "value") ||
    typeof presentDescriptor.value !== "function"
  ) return null;

  const loadApprovedClaims = config.loadApprovedClaims as (
    claimIds: readonly string[],
    progressSnapshot: unknown,
  ) => unknown | Promise<unknown>;
  const refreshCurrentProgress = config.refreshCurrentProgress as () => unknown | Promise<unknown>;
  const resolveApprovedAssignments = (config.resolveApprovedAssignments as (() => unknown) | undefined) ??
    resolveProductionHoidTopicAssignments;
  const validateAssignments = (config.validateAssignments as
    ((assignments: unknown) => HoidTopicAssignmentValidation) | undefined) ??
    validateHoidTopicAssignments;
  const presentClaim = (presentDescriptor.value as HoidTrustedScreenAnswerPort["present"])
    .bind(config.trustedAnswerPort);

  return Object.freeze({
    async present(input: unknown): Promise<HoidTrustedTopicComparisonResult> {
      const request = canonicalRequest(input);
      if (!request) return withheld("invalid-input");
      const topic = getHoidTopicDefinition(request.topicId);
      const dimension = getHoidTopicDimensionDefinition(request.topicId, request.dimensionId);
      if (!topic || !dimension) return withheld("invalid-input");

      const initialProgress = await readProgress(refreshCurrentProgress);
      const initialIdentity = initialProgress === null ? null : progressIdentity(initialProgress);
      if (!initialProgress || !initialIdentity) return withheld("invalid-progress");
      const reading = buildHoidCursorReadingContext(initialProgress);
      if (reading.status !== "ready") return withheld("invalid-progress");

      const initialResolution = resolveActiveAssignments(resolveApprovedAssignments, validateAssignments);
      if (!initialResolution) return withheld("assignment-authority-unavailable");

      const selectedAssignments: HoidTopicAssignment[] = [];
      for (const entry of request.entries) {
        const assignment = findAssignment(
          initialResolution.assignments,
          entry,
          topic.id,
          dimension.id,
        );
        if (!assignment || !subjectIsDisclosed(
          assignment,
          initialResolution.entityFirstAppearances,
          initialProgress,
        )) return withheld("no-authorized-comparison");
        selectedAssignments.push(assignment);
      }

      const claimIds = Object.freeze([...new Set(selectedAssignments.map(item => item.claimId))].sort());
      if (claimIds.length < 1 || claimIds.length > MAX_ENTRIES) {
        return withheld("no-authorized-comparison");
      }

      let rawClaims: unknown;
      try {
        rawClaims = await loadApprovedClaims(claimIds, initialProgress);
      } catch {
        return withheld("approved-claims-unavailable");
      }
      const claims = canonicalClaimRecords(rawClaims, claimIds);
      if (!claims) return withheld("approved-claims-unavailable");

      const verifiedClaims = new Map<string, VerifiedClaim>();
      for (const claimId of claimIds) {
        let rawResult: unknown;
        try {
          rawResult = await presentClaim(claims.get(claimId), "brief");
        } catch {
          return withheld("claim-presentation-withheld");
        }
        const status = readDataProperty(rawResult, "status");
        if (status === "withheld") return withheld("claim-presentation-withheld");
        const verified = canonicalTrustedClaimPresentation(rawResult, claimId);
        if (!verified) return withheld("invalid-claim-presentation");
        verifiedClaims.set(claimId, verified);
      }

      const entries: HoidTrustedTopicComparisonEntry[] = [];
      for (const assignment of selectedAssignments) {
        const claim = verifiedClaims.get(assignment.claimId);
        if (
          !claim ||
          !assignmentEvidenceMatches(assignment, claim, initialResolution.evidenceCitations)
        ) return withheld("invalid-claim-presentation");
        entries.push(Object.freeze({
          subjectKind: assignment.subjectKind,
          subjectId: assignment.subjectId,
          worldId: assignment.worldId,
          worldLabel: assignment.worldLabel,
          claimId: assignment.claimId,
          text: claim.text,
          citations: claim.citations,
        }));
      }

      if (new Set(entries.map(item => item.worldId)).size < 2) {
        const finalProgress = await readProgress(refreshCurrentProgress);
        const finalIdentity = finalProgress === null ? null : progressIdentity(finalProgress);
        if (!finalIdentity) return withheld("invalid-progress");
        if (!sameProgress(initialIdentity, finalIdentity)) return withheld("progress-changed");
        const finalResolution = resolveActiveAssignments(resolveApprovedAssignments, validateAssignments);
        if (!finalResolution || !sameReceipt(initialResolution.receipt, finalResolution.receipt)) {
          return withheld("assignment-authority-changed");
        }
        return Object.freeze({ status: "not-cross-world" });
      }

      const finalProgress = await readProgress(refreshCurrentProgress);
      const finalIdentity = finalProgress === null ? null : progressIdentity(finalProgress);
      if (!finalIdentity) return withheld("invalid-progress");
      if (!sameProgress(initialIdentity, finalIdentity)) return withheld("progress-changed");

      const finalResolution = resolveActiveAssignments(resolveApprovedAssignments, validateAssignments);
      if (!finalResolution || !sameReceipt(initialResolution.receipt, finalResolution.receipt)) {
        return withheld("assignment-authority-changed");
      }

      const comparisonId = sha256Hex(JSON.stringify([
        "hoid-trusted-topic-comparison-v1",
        topic.id,
        dimension.id,
        initialIdentity.revision,
        initialIdentity.fingerprint,
        entries.map(entry => [
          entry.subjectKind,
          entry.subjectId,
          entry.worldId,
          entry.worldLabel,
          entry.claimId,
          sha256Hex(entry.text),
          entry.citations.map(citation => [
            citation.evidenceId,
            citation.sourceBookId,
            citation.chapter,
            citation.locatorId,
          ]),
        ]),
        initialResolution.receipt.receiptFingerprint,
      ]));

      return Object.freeze({
        status: "ready",
        comparison: Object.freeze({
          comparisonId,
          topicId: topic.id,
          topicLabel: topic.label,
          dimensionId: dimension.id,
          dimensionLabel: dimension.label,
          mode: "side-by-side",
          inference: "none",
          entries: Object.freeze(entries),
        }),
        progressRevision: initialIdentity.revision,
        progressFingerprint: initialIdentity.fingerprint,
        verifiedClaimCount: verifiedClaims.size,
      });
    },
  });
}
