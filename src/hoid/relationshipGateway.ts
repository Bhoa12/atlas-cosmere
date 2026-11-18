import {
  resolveProductionHoidEntityIds,
  resolveProductionHoidEntityMentions,
  type HoidEntityMentionResolutionResult,
} from "./entityResolver";
import type {
  HoidExplanationGateway,
  HoidExplanationGatewayResult,
} from "./explanationGateway";
import type { HoidKnowledgeGraphSource } from "./knowledgeGraph";
import type { HoidRenderedExplanation, HoidRenderedExplanationSegment } from "./knowledgeGraphQuery";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { sha256Hex } from "./sha256";

export type HoidRelationshipGatewayResult =
  | Readonly<{
      status: "ready";
      explanation: Extract<HoidRenderedExplanation, { status: "ready" }>;
      entityIds: readonly string[];
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "no-path";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "entity-blocked"
        | "entity-ambiguous"
        | "entity-unavailable"
        | "explanation-unavailable";
    }>;

export type HoidRelationshipGatewayConfig = Readonly<{
  getCurrentProgress: () => unknown;
  explanationGateway: Pick<HoidExplanationGateway, "explain">;
  /** Trusted local resolver; production defaults to the reviewed source-controlled registries. */
  resolveEntities?: (progress: unknown, question: string) => HoidEntityMentionResolutionResult;
  /** Revalidates ID-only conversational context against the current reviewed registries. */
  resolveEntityIds?: (progress: unknown, entityIds: readonly string[]) => HoidEntityMentionResolutionResult;
}>;

type ProgressIdentity = Readonly<{ revision: number; fingerprint: string }>;
type CanonicalEntityMention = Readonly<{ id: string; matchedAlias: string }>;
type CanonicalPairExplanation = Extract<HoidRenderedExplanation, { status: "ready" }>;
type PairResolution =
  | Readonly<{ status: "ready"; explanation: CanonicalPairExplanation }>
  | Readonly<{ status: "no-path" }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "progress-changed" | "explanation-unavailable";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const KINDS = new Set(["character", "place", "event", "phenomenon", "concept", "magic", "organization", "object"]);
const SOURCE_KEYS = [
  "evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId",
  "unlockChapter", "editionId", "navigationSha256", "documentSha256",
] as const;
const MAX_RELATIONSHIP_ENTITIES = 4;
const MAX_GROUP_SEGMENTS = 12;
const MAX_GROUP_EVIDENCE = 16;
const MAX_GROUP_TEXT_LENGTH = 32_000;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
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

function canonicalDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validEntitySource(value: unknown): boolean {
  const source = canonicalRecord(value, SOURCE_KEYS);
  return Boolean(
    source &&
    typeof source.evidenceId === "string" && ID_PATTERN.test(source.evidenceId) &&
    typeof source.sourceBookId === "string" && ID_PATTERN.test(source.sourceBookId) &&
    typeof source.sourceChapter === "number" && Number.isSafeInteger(source.sourceChapter) && source.sourceChapter >= 1 &&
    typeof source.locatorId === "string" && source.locatorId.length > 0 && source.locatorId.length <= 256 &&
    typeof source.unlockBookId === "string" && source.unlockBookId === source.sourceBookId &&
    typeof source.unlockChapter === "number" && Number.isSafeInteger(source.unlockChapter) && source.unlockChapter >= source.sourceChapter &&
    typeof source.editionId === "string" && source.editionId.length > 0 && source.editionId.length <= 128 &&
    typeof source.navigationSha256 === "string" && HASH_PATTERN.test(source.navigationSha256) &&
    typeof source.documentSha256 === "string" && HASH_PATTERN.test(source.documentSha256)
  );
}

function canonicalEntity(value: unknown): CanonicalEntityMention | null {
  const record = canonicalRecord(
    value,
    ["id", "kind", "matchedAlias", "entitySource", "aliasEvidence"],
  );
  if (!record) return null;
  const id = record.id;
  const kind = record.kind;
  const alias = record.matchedAlias;
  if (
    typeof id !== "string" || !ID_PATTERN.test(id) ||
    typeof kind !== "string" || !KINDS.has(kind) ||
    typeof alias !== "string" || alias.length < 1 || alias.length > 256 ||
    alias !== alias.trim() || /[\u0000-\u001F\u007F\p{Cf}]/u.test(alias) ||
    !validEntitySource(record.entitySource)
  ) return null;

  const aliasEvidence = canonicalDenseArray(record.aliasEvidence, 1, 8);
  if (!aliasEvidence) return null;
  for (const raw of aliasEvidence) {
    const item = canonicalRecord(raw, ["evidenceId", "source"]);
    if (
      !item ||
      typeof item.evidenceId !== "string" ||
      !ID_PATTERN.test(item.evidenceId) ||
      !validEntitySource(item.source)
    ) return null;
    const source = canonicalRecord(item.source, SOURCE_KEYS);
    if (!source || source.evidenceId !== item.evidenceId) return null;
  }
  return Object.freeze({ id, matchedAlias: alias });
}

function normalizeAlias(value: string): string {
  return value.normalize("NFKD").replace(/[\p{Cf}\p{Mn}]/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
}

function aliasPosition(question: string, alias: string): number {
  const isWord = (value: string | undefined): boolean =>
    value !== undefined && /[\p{L}\p{N}]/u.test(value);
  let index = question.indexOf(alias);
  while (index >= 0) {
    const before = index > 0 ? question[index - 1] : undefined;
    const afterIndex = index + alias.length;
    const after = afterIndex < question.length ? question[afterIndex] : undefined;
    if (!isWord(before) && !isWord(after)) return index;
    index = question.indexOf(alias, index + 1);
  }
  return -1;
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

function canonicalMentions(
  value: HoidEntityMentionResolutionResult,
  expected: ProgressIdentity,
  question: string,
): readonly CanonicalEntityMention[] | "blocked" | "ambiguous" | "unavailable" {
  const record = canonicalRecord(value, ["status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated"], ["status"]);
  if (!record) return "unavailable";
  if (record.status === "blocked" && Object.keys(record).length === 1) return "blocked";
  if (record.status === "unavailable") return "unavailable";
  if (
    record.status !== "ready" ||
    record.progressRevision !== expected.revision ||
    record.progressFingerprint !== expected.fingerprint ||
    typeof record.truncated !== "boolean"
  ) return "unavailable";

  const matches = canonicalDenseArray(record.matches, 0, 8);
  if (!matches) return "unavailable";
  if (record.resolution === "ambiguous" || record.truncated || matches.length > MAX_RELATIONSHIP_ENTITIES) return "ambiguous";
  if (record.resolution === "not-found" || matches.length < 2) return "unavailable";
  if (record.resolution !== "matched") return "unavailable";

  const entities: CanonicalEntityMention[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const entity = canonicalEntity(raw);
    if (!entity || seen.has(entity.id)) return "unavailable";
    seen.add(entity.id);
    entities.push(entity);
  }

  const normalizedQuestion = normalizeAlias(question);
  const ordered = entities
    .map(entity => ({ ...entity, position: aliasPosition(normalizedQuestion, normalizeAlias(entity.matchedAlias)) }))
    .sort((left, right) => left.position - right.position);
  if (
    ordered.some(entity => entity.position < 0) ||
    ordered.some((entity, index) => index > 0 && entity.position === ordered[index - 1].position)
  ) return "ambiguous";

  return Object.freeze(ordered.map(entity => Object.freeze({
    id: entity.id,
    matchedAlias: entity.matchedAlias,
  })));
}


function canonicalContextMentions(
  value: HoidEntityMentionResolutionResult,
  expected: ProgressIdentity,
  requestedIds: readonly string[],
): readonly CanonicalEntityMention[] | "blocked" | "ambiguous" | "unavailable" {
  const record = canonicalRecord(
    value,
    ["status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated"],
    ["status"],
  );
  if (!record) return "unavailable";
  if (record.status === "blocked" && Object.keys(record).length === 1) return "blocked";
  if (record.status === "unavailable") return "unavailable";
  if (
    record.status !== "ready" ||
    record.progressRevision !== expected.revision ||
    record.progressFingerprint !== expected.fingerprint ||
    record.resolution !== "matched" ||
    record.truncated !== false
  ) return "unavailable";

  const matches = canonicalDenseArray(record.matches, 2, MAX_RELATIONSHIP_ENTITIES);
  if (!matches || matches.length !== requestedIds.length) return "unavailable";
  const entities: CanonicalEntityMention[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < matches.length; index += 1) {
    const entity = canonicalEntity(matches[index]);
    if (!entity || entity.id !== requestedIds[index] || seen.has(entity.id)) return "unavailable";
    seen.add(entity.id);
    entities.push(entity);
  }
  return Object.freeze(entities);
}

function unavailable(
  reason: Extract<HoidRelationshipGatewayResult, { status: "unavailable" }>["reason"],
): HoidRelationshipGatewayResult {
  return Object.freeze({ status: "unavailable", reason });
}

function explanationFailure(reason: unknown): PairResolution {
  if (reason === "invalid-progress") return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  if (reason === "progress-changed") return Object.freeze({ status: "unavailable", reason: "progress-changed" });
  return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
}

function canonicalGraphSource(value: unknown): HoidKnowledgeGraphSource | null {
  const source = canonicalRecord(value, SOURCE_KEYS);
  if (!source || !validEntitySource(source)) return null;
  return Object.freeze({
    evidenceId: source.evidenceId as string,
    sourceBookId: source.sourceBookId as string,
    sourceChapter: source.sourceChapter as number,
    locatorId: source.locatorId as string,
    unlockBookId: source.unlockBookId as string,
    unlockChapter: source.unlockChapter as number,
    editionId: source.editionId as string,
    navigationSha256: source.navigationSha256 as string,
    documentSha256: source.documentSha256 as string,
  });
}

function sourceFingerprint(source: HoidKnowledgeGraphSource): string {
  return JSON.stringify(SOURCE_KEYS.map(key => source[key]));
}

function canonicalPairResult(value: unknown, expected: ProgressIdentity): PairResolution {
  const wrapper = canonicalRecord(
    value,
    ["status", "explanation", "progressRevision", "progressFingerprint", "reason"],
    ["status"],
  );
  if (!wrapper) return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });

  if (wrapper.status === "unavailable") {
    if (Object.keys(wrapper).length !== 2 || typeof wrapper.reason !== "string") {
      return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
    }
    return explanationFailure(wrapper.reason);
  }

  if (
    wrapper.progressRevision !== expected.revision ||
    wrapper.progressFingerprint !== expected.fingerprint
  ) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });

  if (wrapper.status === "no-path") {
    if (Object.keys(wrapper).length !== 3) {
      return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
    }
    return Object.freeze({ status: "no-path" });
  }

  if (wrapper.status !== "ready" || Object.keys(wrapper).length !== 4) {
    return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
  }

  const rawExplanation = canonicalRecord(
    wrapper.explanation,
    ["status", "planId", "progressRevision", "text", "segments", "sources", "truncated"],
  );
  if (
    !rawExplanation ||
    Object.keys(rawExplanation).length !== 7 ||
    rawExplanation.status !== "ready" ||
    rawExplanation.progressRevision !== expected.revision ||
    typeof rawExplanation.planId !== "string" || !HASH_PATTERN.test(rawExplanation.planId) ||
    typeof rawExplanation.text !== "string" ||
    rawExplanation.text.length < 1 || rawExplanation.text.length > MAX_GROUP_TEXT_LENGTH ||
    rawExplanation.text !== rawExplanation.text.trim() ||
    rawExplanation.truncated !== false
  ) return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });

  const rawSources = canonicalDenseArray(rawExplanation.sources, 1, MAX_GROUP_EVIDENCE);
  const rawSegments = canonicalDenseArray(rawExplanation.segments, 1, MAX_GROUP_SEGMENTS);
  if (!rawSources || !rawSegments) return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });

  const sourcesById = new Map<string, HoidKnowledgeGraphSource>();
  for (const rawSource of rawSources) {
    const source = canonicalGraphSource(rawSource);
    if (!source || sourcesById.has(source.evidenceId)) {
      return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
    }
    sourcesById.set(source.evidenceId, source);
  }

  const claimIds = new Set<string>();
  const referencedSourceIds = new Set<string>();
  const segments: HoidRenderedExplanationSegment[] = [];
  const segmentTexts: string[] = [];

  for (const rawSegment of rawSegments) {
    const segment = canonicalRecord(rawSegment, ["claimId", "text", "evidenceIds", "sources"]);
    if (
      !segment ||
      typeof segment.claimId !== "string" || !ID_PATTERN.test(segment.claimId) ||
      claimIds.has(segment.claimId) ||
      typeof segment.text !== "string" ||
      segment.text.length < 1 || segment.text.length > 4_000 ||
      segment.text !== segment.text.trim()
    ) return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });

    const evidenceIds = canonicalDenseArray(segment.evidenceIds, 1, MAX_GROUP_EVIDENCE);
    const rawSegmentSources = canonicalDenseArray(segment.sources, 1, MAX_GROUP_EVIDENCE);
    if (!evidenceIds || !rawSegmentSources || evidenceIds.length !== rawSegmentSources.length) {
      return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
    }

    const canonicalEvidenceIds: string[] = [];
    const canonicalSegmentSources: HoidKnowledgeGraphSource[] = [];
    const localIds = new Set<string>();
    for (let index = 0; index < evidenceIds.length; index += 1) {
      const evidenceId = evidenceIds[index];
      const source = canonicalGraphSource(rawSegmentSources[index]);
      if (
        typeof evidenceId !== "string" || !ID_PATTERN.test(evidenceId) ||
        localIds.has(evidenceId) || !source || source.evidenceId !== evidenceId
      ) return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
      const globalSource = sourcesById.get(evidenceId);
      if (!globalSource || sourceFingerprint(globalSource) !== sourceFingerprint(source)) {
        return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
      }
      localIds.add(evidenceId);
      referencedSourceIds.add(evidenceId);
      canonicalEvidenceIds.push(evidenceId);
      canonicalSegmentSources.push(source);
    }

    claimIds.add(segment.claimId);
    segmentTexts.push(segment.text);
    segments.push(Object.freeze({
      claimId: segment.claimId,
      text: segment.text,
      evidenceIds: Object.freeze(canonicalEvidenceIds),
      sources: Object.freeze(canonicalSegmentSources),
    }));
  }

  if (
    referencedSourceIds.size !== sourcesById.size ||
    segmentTexts.join("\n\n") !== rawExplanation.text
  ) return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });

  return Object.freeze({
    status: "ready",
    explanation: Object.freeze({
      status: "ready",
      planId: rawExplanation.planId as string,
      progressRevision: expected.revision,
      text: rawExplanation.text,
      segments: Object.freeze(segments),
      sources: Object.freeze([...sourcesById.values()]),
      truncated: false,
    }),
  });
}

function combinePairExplanations(
  explanations: readonly CanonicalPairExplanation[],
  entities: readonly CanonicalEntityMention[],
  progress: ProgressIdentity,
): CanonicalPairExplanation | null {
  if (explanations.length < 1 || explanations.length > 6) return null;

  const segmentsByClaim = new Map<string, Readonly<{ segment: HoidRenderedExplanationSegment; fingerprint: string }>>();
  const sourcesById = new Map<string, Readonly<{ source: HoidKnowledgeGraphSource; fingerprint: string }>>();
  const pairPlanIds: string[] = [];

  for (const explanation of explanations) {
    pairPlanIds.push(explanation.planId);
    for (const source of explanation.sources) {
      const fingerprint = sourceFingerprint(source);
      const existing = sourcesById.get(source.evidenceId);
      if (existing && existing.fingerprint !== fingerprint) return null;
      if (!existing) sourcesById.set(source.evidenceId, Object.freeze({ source, fingerprint }));
    }
    for (const segment of explanation.segments) {
      const fingerprint = JSON.stringify({
        claimId: segment.claimId,
        text: segment.text,
        evidenceIds: segment.evidenceIds,
        sources: segment.sources.map(sourceFingerprint),
      });
      const existing = segmentsByClaim.get(segment.claimId);
      if (existing && existing.fingerprint !== fingerprint) return null;
      if (!existing) segmentsByClaim.set(segment.claimId, Object.freeze({ segment, fingerprint }));
    }
  }

  const segments = [...segmentsByClaim.values()].map(item => item.segment);
  const sources = [...sourcesById.values()].map(item => item.source);
  if (
    segments.length < 1 || segments.length > MAX_GROUP_SEGMENTS ||
    sources.length < 1 || sources.length > MAX_GROUP_EVIDENCE
  ) return null;

  const text = segments.map(segment => segment.text).join("\n\n");
  if (text.length < 1 || text.length > MAX_GROUP_TEXT_LENGTH) return null;

  const planId = sha256Hex(JSON.stringify({
    schemaVersion: 1,
    entityIds: entities.map(entity => entity.id),
    pairPlanIds,
  }));
  return Object.freeze({
    status: "ready",
    planId,
    progressRevision: progress.revision,
    text,
    segments: Object.freeze(segments),
    sources: Object.freeze(sources),
    truncated: false,
  });
}

function requestPair(
  gateway: Pick<HoidExplanationGateway, "explain">,
  progressInput: unknown,
  progress: ProgressIdentity,
  fromId: string,
  toId: string,
): PairResolution {
  let raw: HoidExplanationGatewayResult;
  try {
    raw = gateway.explain({
      progress: progressInput,
      query: Object.freeze({ fromId, toId, maxDepth: 4, maxPaths: 1 }),
    });
  } catch {
    return Object.freeze({ status: "unavailable", reason: "explanation-unavailable" });
  }
  return canonicalPairResult(raw, progress);
}

/**
 * Resolves two to four reviewed, currently disclosed aliases. Two entities
 * produce the existing single-pair explanation; three or four entities produce
 * a complete pairwise explanation matrix. Every pair must have a verified path:
 * one missing/locked/invalid pair withholds the entire result. Pair count is
 * bounded to six, each path to depth four and one path, and no provider can
 * invent entities, edges or response text.
 */
export class HoidRelationshipGateway {
  constructor(private readonly config: HoidRelationshipGatewayConfig) {}

  answer(input: unknown): HoidRelationshipGatewayResult {
    const request = canonicalRecord(input, ["question", "progress", "entityIds"], ["question", "progress"]);
    if (
      !request ||
      typeof request.question !== "string" ||
      request.question.length < 1 ||
      request.question.length > 4_000 ||
      request.question !== request.question.trim() ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(request.question) ||
      !Object.prototype.hasOwnProperty.call(request, "progress")
    ) return unavailable("invalid-request");

    const rawRequestedEntityIds = request.entityIds === undefined
      ? null
      : canonicalDenseArray(request.entityIds, 2, MAX_RELATIONSHIP_ENTITIES);
    if (
      request.entityIds !== undefined &&
      (!rawRequestedEntityIds ||
        rawRequestedEntityIds.some(id => typeof id !== "string" || !ID_PATTERN.test(id)) ||
        new Set(rawRequestedEntityIds).size !== rawRequestedEntityIds.length)
    ) return unavailable("invalid-request");
    const requestedEntityIds: readonly string[] | null = rawRequestedEntityIds
      ? Object.freeze(rawRequestedEntityIds.map(id => id as string))
      : null;

    const requested = progressIdentity(request.progress);
    if (!requested) return unavailable("invalid-progress");

    let currentBefore: unknown;
    try {
      currentBefore = this.config.getCurrentProgress();
    } catch {
      return unavailable("invalid-progress");
    }
    const before = progressIdentity(currentBefore);
    if (!before) return unavailable("invalid-progress");
    if (!sameProgress(requested, before)) return unavailable("progress-changed");

    let rawMentions: HoidEntityMentionResolutionResult;
    try {
      rawMentions = requestedEntityIds
        ? (this.config.resolveEntityIds ?? resolveProductionHoidEntityIds)(
            request.progress,
            requestedEntityIds,
          )
        : (this.config.resolveEntities ?? resolveProductionHoidEntityMentions)(
            request.progress,
            request.question,
          );
    } catch {
      return unavailable("entity-unavailable");
    }
    const mentions = requestedEntityIds
      ? canonicalContextMentions(rawMentions, requested, requestedEntityIds)
      : canonicalMentions(rawMentions, requested, request.question);
    if (mentions === "blocked") return unavailable("entity-blocked");
    if (mentions === "ambiguous") return unavailable("entity-ambiguous");
    if (mentions === "unavailable") return unavailable("entity-unavailable");

    const pairExplanations: CanonicalPairExplanation[] = [];
    let missingPath = false;

    for (let left = 0; left < mentions.length; left += 1) {
      for (let right = left + 1; right < mentions.length; right += 1) {
        let pair = requestPair(
          this.config.explanationGateway,
          request.progress,
          requested,
          mentions[left].id,
          mentions[right].id,
        );

        if (pair.status === "no-path") {
          pair = requestPair(
            this.config.explanationGateway,
            request.progress,
            requested,
            mentions[right].id,
            mentions[left].id,
          );
        }

        if (pair.status === "unavailable") return unavailable(pair.reason);
        if (pair.status === "no-path") {
          missingPath = true;
          break;
        }
        pairExplanations.push(pair.explanation);
      }
      if (missingPath) break;
    }

    let currentAfter: unknown;
    try {
      currentAfter = this.config.getCurrentProgress();
    } catch {
      return unavailable("invalid-progress");
    }
    const after = progressIdentity(currentAfter);
    if (!after) return unavailable("invalid-progress");
    if (!sameProgress(requested, after)) return unavailable("progress-changed");

    if (missingPath) {
      return Object.freeze({
        status: "no-path",
        progressRevision: requested.revision,
        progressFingerprint: requested.fingerprint,
      });
    }

    const explanation = combinePairExplanations(pairExplanations, mentions, requested);
    if (!explanation) return unavailable("explanation-unavailable");

    return Object.freeze({
      status: "ready",
      explanation,
      entityIds: Object.freeze(mentions.map(entity => entity.id)),
      progressRevision: requested.revision,
      progressFingerprint: requested.fingerprint,
    });
  }
}

export function createHoidRelationshipGateway(
  config: HoidRelationshipGatewayConfig | null,
): HoidRelationshipGateway | null {
  if (
    config === null ||
    typeof config !== "object" ||
    typeof config.getCurrentProgress !== "function" ||
    config.explanationGateway === null ||
    typeof config.explanationGateway !== "object" ||
    typeof config.explanationGateway.explain !== "function" ||
    (config.resolveEntities !== undefined && typeof config.resolveEntities !== "function") ||
    (config.resolveEntityIds !== undefined && typeof config.resolveEntityIds !== "function")
  ) return null;
  return new HoidRelationshipGateway(config);
}
