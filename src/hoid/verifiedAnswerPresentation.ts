import type { HoidKnowledgeEntry } from "./catalog";
import {
  presentHoidEvidenceAnswer,
  type HoidAnswerPresentation,
  type HoidPresentedSegment,
} from "./answerPresentation";
import {
  validateHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import {
  evidenceCitationFor,
  type HoidEvidenceCitation,
} from "./evidenceScope";

export type HoidVerifiedAnswerPresenter = Readonly<{
  present(answer: unknown, progress: unknown): HoidAnswerPresentation;
}>;

const MAX_KNOWLEDGE = 512;
const MAX_CLAIMS = 512;
const MAX_PRESENTED_CLAIMS = 12;
const MAX_PRESENTED_EVIDENCE = 16;
const MAX_TEXT_LENGTH = 32_000;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SOURCE_KEYS = [
  "evidenceId",
  "sourceBookId",
  "sourceChapter",
  "locatorId",
  "unlockBookId",
  "unlockChapter",
] as const;
const SEGMENT_KEYS = ["claimId", "text", "evidenceIds"] as const;
const AUTHORIZED_ANSWER_KEYS = [
  "status",
  "text",
  "claimIds",
  "evidenceIds",
  "sources",
  "segments",
  "layout",
] as const;
const AUTHORIZED_ANSWER_KEYS_WITH_PROGRESS = [
  ...AUTHORIZED_ANSWER_KEYS,
  "progressBinding",
] as const;

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
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
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function denseArray(value: unknown, maximum: number, minimum = 0): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalId(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= 128 && ID_PATTERN.test(value);
}

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  const values = denseArray(value, maximum, 1);
  if (!values) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    if (!canonicalId(item) || seen.has(item)) return null;
    seen.add(item);
    result.push(item);
  }
  return Object.freeze(result);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  const entries = denseArray(value, MAX_KNOWLEDGE, 1);
  if (!entries) return null;
  const ids = new Set<string>();
  const result: HoidKnowledgeEntry[] = [];
  for (const entry of entries) {
    try {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return null;
      const prototype = Object.getPrototypeOf(entry);
      if (prototype !== Object.prototype && prototype !== null) return null;
      const descriptor = Object.getOwnPropertyDescriptor(entry, "id");
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true ||
          !canonicalId(descriptor.value) || ids.has(descriptor.value)) return null;
      ids.add(descriptor.value);
      result.push(entry as HoidKnowledgeEntry);
    } catch {
      return null;
    }
  }
  return Object.freeze(result);
}

function canonicalClaims(value: unknown, knowledge: readonly HoidKnowledgeEntry[]): readonly HoidApprovedClaim[] | null {
  const entries = denseArray(value, MAX_CLAIMS, 1);
  if (!entries) return null;
  const claims: HoidApprovedClaim[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    const validation = validateHoidApprovedClaimAttestation(entry, knowledge);
    if (validation.status !== "valid" || ids.has(validation.claim.id)) return null;
    ids.add(validation.claim.id);
    claims.push(validation.claim);
  }
  return Object.freeze(claims);
}

function canonicalCitation(value: unknown): HoidEvidenceCitation | null {
  const record = exactRecord(value, SOURCE_KEYS);
  if (!record) return null;
  const { evidenceId, sourceBookId, sourceChapter, locatorId, unlockBookId, unlockChapter } = record;
  if (
    !canonicalId(evidenceId) || !canonicalId(sourceBookId) ||
    typeof sourceChapter !== "number" || !Number.isSafeInteger(sourceChapter) || sourceChapter < 1 ||
    typeof locatorId !== "string" || locatorId.length < 1 || locatorId.length > 256 || /[\u0000-\u001F\u007F]/u.test(locatorId) ||
    !canonicalId(unlockBookId) || unlockBookId !== sourceBookId ||
    typeof unlockChapter !== "number" || !Number.isSafeInteger(unlockChapter) || unlockChapter < sourceChapter
  ) return null;
  return Object.freeze({ evidenceId, sourceBookId, sourceChapter, locatorId, unlockBookId, unlockChapter });
}

function canonicalCitations(value: unknown): readonly HoidEvidenceCitation[] | null {
  const entries = denseArray(value, MAX_PRESENTED_EVIDENCE, 1);
  if (!entries) return null;
  const citations: HoidEvidenceCitation[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    const citation = canonicalCitation(entry);
    if (!citation || ids.has(citation.evidenceId)) return null;
    ids.add(citation.evidenceId);
    citations.push(citation);
  }
  return Object.freeze(citations);
}

function canonicalSegments(value: unknown): readonly HoidPresentedSegment[] | null {
  const entries = denseArray(value, MAX_PRESENTED_CLAIMS, 1);
  if (!entries) return null;
  const segments: HoidPresentedSegment[] = [];
  for (const entry of entries) {
    const record = exactRecord(entry, SEGMENT_KEYS);
    if (!record) return null;
    const claimId = record.claimId;
    const text = record.text;
    const evidenceIds = canonicalIds(record.evidenceIds, MAX_PRESENTED_EVIDENCE);
    if (!canonicalId(claimId) || typeof text !== "string" || text.length < 1 || text.length > 4_000 || text !== text.trim() || !evidenceIds) return null;
    segments.push(Object.freeze({ claimId, text, evidenceIds, citations: Object.freeze([]) }));
  }
  return Object.freeze(segments);
}

function sameCitation(left: HoidEvidenceCitation, right: HoidEvidenceCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.sourceChapter === right.sourceChapter &&
    left.locatorId === right.locatorId &&
    left.unlockBookId === right.unlockBookId &&
    left.unlockChapter === right.unlockChapter;
}

function invalidPresentation(progress: unknown): HoidAnswerPresentation {
  return presentHoidEvidenceAnswer({ status: "authorized", text: "", claimIds: [], evidenceIds: [], sources: [] }, progress);
}

/**
 * Creates the final presentation boundary from the trusted local registries.
 * The runtime answer is a selection manifest only; prose and citations are
 * reconstructed from validated approved claims and edition-bound knowledge.
 */
export function createHoidVerifiedAnswerPresenter(configInput: unknown): HoidVerifiedAnswerPresenter | null {
  const config = exactRecord(configInput, ["knowledge", "claims"]);
  if (!config) return null;
  const knowledge = canonicalKnowledge(config.knowledge);
  if (!knowledge) return null;
  const claims = canonicalClaims(config.claims, knowledge);
  if (!claims) return null;

  const knowledgeById = new Map(knowledge.map(entry => [entry.id, entry]));
  const citationsById = new Map<string, HoidEvidenceCitation>();
  for (const claim of claims) {
    for (const evidenceId of claim.evidenceIds) {
      const entry = knowledgeById.get(evidenceId);
      if (!entry) return null;
      const citation = evidenceCitationFor(entry);
      if (!citation) return null;
      const existing = citationsById.get(evidenceId);
      if (existing && !sameCitation(existing, citation)) return null;
      citationsById.set(evidenceId, Object.freeze({ ...citation }));
    }
  }
  const orderedClaims = Object.freeze([...claims]);

  const present = (answerInput: unknown, progress: unknown): HoidAnswerPresentation => {
    try {
      const status = ownDataValue(answerInput, "status");
      if (status !== "authorized") return presentHoidEvidenceAnswer(answerInput, progress);

      const answer = exactRecord(answerInput, AUTHORIZED_ANSWER_KEYS)
        ?? exactRecord(answerInput, AUTHORIZED_ANSWER_KEYS_WITH_PROGRESS);
      if (!answer || answer.status !== "authorized") return invalidPresentation(progress);
      const claimIds = canonicalIds(answer.claimIds, MAX_PRESENTED_CLAIMS);
      const evidenceIds = canonicalIds(answer.evidenceIds, MAX_PRESENTED_EVIDENCE);
      const sources = canonicalCitations(answer.sources);
      const segments = canonicalSegments(answer.segments);
      const layout = answer.layout;
      const text = answer.text;
      if (
        !claimIds || !evidenceIds || !sources || !segments ||
        (layout !== "plain" && layout !== "numbered" && layout !== "grouped") ||
        typeof text !== "string" || text.length < 1 || text.length > MAX_TEXT_LENGTH || text !== text.trim()
      ) return invalidPresentation(progress);

      const selectedIds = new Set(claimIds);
      const selectedClaims = orderedClaims.filter(claim => selectedIds.has(claim.id));
      if (
        selectedClaims.length !== claimIds.length ||
        !sameStrings(selectedClaims.map(claim => claim.id), claimIds) ||
        segments.length !== selectedClaims.length
      ) return invalidPresentation(progress);

      const expectedEvidenceIds = [...new Set(selectedClaims.flatMap(claim => claim.evidenceIds))].sort();
      if (!sameStrings(expectedEvidenceIds, evidenceIds)) return invalidPresentation(progress);

      const expectedSegments = selectedClaims.map(claim => Object.freeze({
        claimId: claim.id,
        text: claim.text,
        evidenceIds: claim.evidenceIds,
      }));
      for (let index = 0; index < expectedSegments.length; index += 1) {
        const expected = expectedSegments[index];
        const actual = segments[index];
        if (actual.claimId !== expected.claimId || actual.text !== expected.text ||
            !sameStrings(actual.evidenceIds, expected.evidenceIds)) return invalidPresentation(progress);
      }

      const expectedSources: HoidEvidenceCitation[] = [];
      for (const evidenceId of expectedEvidenceIds) {
        const citation = citationsById.get(evidenceId);
        if (!citation) return invalidPresentation(progress);
        expectedSources.push(citation);
      }
      if (sources.length !== expectedSources.length ||
          !sources.every((source, index) => sameCitation(source, expectedSources[index]))) return invalidPresentation(progress);

      return presentHoidEvidenceAnswer({
        status: "authorized",
        text,
        claimIds,
        evidenceIds,
        sources: expectedSources,
        segments: expectedSegments,
        layout,
        ...(Object.prototype.hasOwnProperty.call(answer, "progressBinding")
          ? { progressBinding: answer.progressBinding }
          : {}),
      }, progress);
    } catch {
      return invalidPresentation(progress);
    }
  };

  return Object.freeze({ present });
}
