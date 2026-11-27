import {
  isHoidEntityDossierGateway,
  type HoidEntityDossierGateway,
  type HoidEntityDossierGatewayResult,
} from "./entityDossierGateway";
import { classifyHoidEntityRelationshipIntent } from "./entityRelationshipIntent";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import {
  canonicalEvidenceScope,
  type HoidEvidenceCitation,
} from "./evidenceScope";
import {
  projectHoidAnswerForDisplay,
  type HoidAnswerDisplayProjection,
} from "./answerDisplayProjection";
import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
  HoidPresentedSegment,
} from "./answerPresentation";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  isHoidExplanationDepth,
  resolveHoidExplanationDepthBudget,
  type HoidExplanationDepth,
} from "./explanationDepth";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import {
  composeHoidNarrative,
  defaultHoidNarrativeLayout,
} from "./narrativeComposition";

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[];
}>;

type CanonicalClaim = Readonly<{
  claimId: string;
  intent: "explain" | "context" | "recommend";
  text: string;
  participants: readonly Readonly<{ id: string; kind: string; label: string }>[];
  sources: readonly HoidEvidenceCitation[];
  fingerprint: string;
}>;

type CanonicalDossier = Readonly<{
  entity: Readonly<{ id: string; label: string }>;
  claims: readonly CanonicalClaim[];
}>;

export type HoidEntityRelationshipConversationResult =
  | Readonly<{ status: "not-relationship" }>
  | Readonly<{ status: "needs-names" }>
  | Readonly<{
      status: "ready";
      presentation: HoidAnswerDisplayProjection;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "cancelled"
        | "invalid-scope"
        | "invalid-dossier"
        | "budget-exceeded";
    }>;

type AdapterConfig = Readonly<{
  gateway: HoidEntityDossierGateway;
  refreshCurrentProgress: () => unknown | Promise<unknown>;
}>;

export type HoidEntityRelationshipConversationAdapter = Readonly<{
  answer(
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<HoidEntityRelationshipConversationResult>;
}>;

const TITLE_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
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
const MAX_CLAIMS = 24;
const MAX_SOURCES_PER_CLAIM = 16;
const MAX_PARTICIPANTS = 4;
const MAX_ALIAS_EVIDENCE = 64;

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
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
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

function sourceIsUnlocked(
  source: HoidEvidenceCitation,
  reading: ProgressIdentity["reading"],
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
  scope: HoidAnswerBookScope,
  reading: ProgressIdentity["reading"],
  resolvedSource = false,
): HoidEvidenceCitation | null {
  const keys = resolvedSource ? RESOLVED_SOURCE_KEYS : CITATION_KEYS;
  const source = exactRecord(value, keys);
  if (
    !source ||
    typeof source.evidenceId !== "string" ||
    !ID_PATTERN.test(source.evidenceId) ||
    typeof source.sourceBookId !== "string" ||
    !TITLE_BY_ID.has(source.sourceBookId) ||
    typeof source.sourceChapter !== "number" ||
    !Number.isSafeInteger(source.sourceChapter) ||
    source.sourceChapter < 1 ||
    typeof source.locatorId !== "string" ||
    source.locatorId.length < 1 ||
    source.locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(source.locatorId) ||
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

  if (resolvedSource && (
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
  return sourceIsUnlocked(citation, reading) ? citation : null;
}

function sameCitation(left: HoidEvidenceCitation, right: HoidEvidenceCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.sourceChapter === right.sourceChapter &&
    left.locatorId === right.locatorId &&
    left.unlockBookId === right.unlockBookId &&
    left.unlockChapter === right.unlockChapter;
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
    typeof entity.id !== "string" ||
    !ID_PATTERN.test(entity.id) ||
    !isHoidKnowledgeKind(entity.kind) ||
    !validText(entity.label, 256)
  ) return null;

  const entitySource = canonicalCitation(entity.source, scope, progress.reading, true);
  if (!entitySource || entitySource.evidenceId !== entity.id) return null;

  const aliasEvidence = denseArray(entity.aliasEvidence, 1, MAX_ALIAS_EVIDENCE);
  if (!aliasEvidence) return null;
  const aliasEvidenceIds = new Set<string>();
  for (const rawAlias of aliasEvidence) {
    const alias = exactRecord(rawAlias, ["evidenceId", "source"]);
    if (
      !alias ||
      typeof alias.evidenceId !== "string" ||
      !ID_PATTERN.test(alias.evidenceId) ||
      aliasEvidenceIds.has(alias.evidenceId) ||
      !canonicalCitation(alias.source, scope, progress.reading, true)
    ) return null;
    aliasEvidenceIds.add(alias.evidenceId);
  }

  const summary = exactRecord(dossier.summary, ["text", "source"]);
  if (!summary || !validText(summary.text, 4_000)) return null;
  const summarySource = canonicalCitation(summary.source, scope, progress.reading);
  if (!summarySource || !sameCitation(entitySource, summarySource)) return null;

  const rawClaims = denseArray(dossier.claims, 0, MAX_CLAIMS);
  if (!rawClaims) return null;
  const claims: CanonicalClaim[] = [];
  const claimIds = new Set<string>();

  for (const rawClaim of rawClaims) {
    const claim = exactRecord(rawClaim, [
      "claimId",
      "intent",
      "text",
      "participants",
      "sources",
    ]);
    if (
      !claim ||
      typeof claim.claimId !== "string" ||
      !ID_PATTERN.test(claim.claimId) ||
      claimIds.has(claim.claimId) ||
      (claim.intent !== "explain" && claim.intent !== "context" && claim.intent !== "recommend") ||
      !validText(claim.text, 4_000)
    ) return null;
    claimIds.add(claim.claimId);

    const rawParticipants = denseArray(claim.participants, 1, MAX_PARTICIPANTS);
    if (!rawParticipants) return null;
    const participants: { id: string; kind: string; label: string }[] = [];
    const participantIds = new Set<string>();
    for (const rawParticipant of rawParticipants) {
      const participant = exactRecord(rawParticipant, ["id", "kind", "label"]);
      if (
        !participant ||
        typeof participant.id !== "string" ||
        !ID_PATTERN.test(participant.id) ||
        participantIds.has(participant.id) ||
        !isHoidKnowledgeKind(participant.kind) ||
        !validText(participant.label, 256)
      ) return null;
      participantIds.add(participant.id);
      participants.push(Object.freeze({
        id: participant.id,
        kind: participant.kind,
        label: participant.label,
      }));
    }
    if (!participantIds.has(entity.id)) return null;
    participants.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

    const rawSources = denseArray(claim.sources, 1, MAX_SOURCES_PER_CLAIM);
    if (!rawSources) return null;
    const sources: HoidEvidenceCitation[] = [];
    const sourceIds = new Set<string>();
    for (const rawSource of rawSources) {
      const source = canonicalCitation(rawSource, scope, progress.reading);
      if (!source || sourceIds.has(source.evidenceId)) return null;
      sourceIds.add(source.evidenceId);
      sources.push(source);
    }
    sources.sort((left, right) =>
      left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0
    );

    const frozenParticipants = Object.freeze(participants);
    const frozenSources = Object.freeze(sources);
    const fingerprint = JSON.stringify([
      claim.claimId,
      claim.intent,
      claim.text,
      frozenParticipants.map(item => [item.id, item.kind, item.label]),
      frozenSources.map(item => [
        item.evidenceId,
        item.sourceBookId,
        item.sourceChapter,
        item.locatorId,
        item.unlockBookId,
        item.unlockChapter,
      ]),
    ]);
    claims.push(Object.freeze({
      claimId: claim.claimId,
      intent: claim.intent,
      text: claim.text,
      participants: frozenParticipants,
      sources: frozenSources,
      fingerprint,
    }));
  }

  return Object.freeze({
    entity: Object.freeze({ id: entity.id, label: entity.label }),
    claims: Object.freeze(claims),
  });
}

function unavailable(
  reason: Extract<HoidEntityRelationshipConversationResult, { status: "unavailable" }>["reason"],
): HoidEntityRelationshipConversationResult {
  return Object.freeze({ status: "unavailable", reason });
}

function buildRelationshipPresentation(
  left: CanonicalDossier,
  right: CanonicalDossier,
  scope: HoidAnswerBookScope,
  depth: HoidExplanationDepth,
): HoidEntityRelationshipConversationResult | Readonly<{
  status: "ready";
  presentation: HoidAnswerDisplayProjection;
}> {
  if (left.entity.id === right.entity.id) return unavailable("invalid-dossier");

  const rightClaims = new Map(right.claims.map(claim => [claim.claimId, claim] as const));
  const shared: CanonicalClaim[] = [];
  for (const claim of left.claims) {
    if (claim.intent === "recommend") continue;
    const participantIds = new Set(claim.participants.map(item => item.id));
    if (!participantIds.has(left.entity.id) || !participantIds.has(right.entity.id)) continue;
    const counterpart = rightClaims.get(claim.claimId);
    if (!counterpart) continue;
    if (counterpart.fingerprint !== claim.fingerprint) return unavailable("invalid-dossier");
    const evidenceIds = new Set(claim.sources.map(source => source.evidenceId));
    if (!evidenceIds.has(left.entity.id) || !evidenceIds.has(right.entity.id)) {
      return unavailable("invalid-dossier");
    }
    shared.push(claim);
  }

  if (shared.length === 0) return Object.freeze({ status: "not-found" });
  shared.sort((leftClaim, rightClaim) =>
    leftClaim.claimId < rightClaim.claimId ? -1 : leftClaim.claimId > rightClaim.claimId ? 1 : 0
  );

  const budget = resolveHoidExplanationDepthBudget(depth);
  if (!budget) return unavailable("invalid-request");

  const evidenceById = new Map<string, HoidEvidenceCitation>();
  const segments: HoidPresentedSegment[] = [];
  for (const claim of shared) {
    const citations: HoidPresentedCitation[] = [];
    for (const source of claim.sources) {
      const existing = evidenceById.get(source.evidenceId);
      if (existing && !sameCitation(existing, source)) return unavailable("invalid-dossier");
      evidenceById.set(source.evidenceId, source);
      citations.push(Object.freeze({
        evidenceId: source.evidenceId,
        sourceBookId: source.sourceBookId,
        title: TITLE_BY_ID.get(source.sourceBookId)!,
        chapter: source.sourceChapter,
        locatorId: source.locatorId,
      }));
    }
    citations.sort((leftCitation, rightCitation) =>
      leftCitation.sourceBookId < rightCitation.sourceBookId ? -1 :
      leftCitation.sourceBookId > rightCitation.sourceBookId ? 1 :
      leftCitation.chapter - rightCitation.chapter ||
      (leftCitation.evidenceId < rightCitation.evidenceId ? -1 :
        leftCitation.evidenceId > rightCitation.evidenceId ? 1 : 0)
    );
    segments.push(Object.freeze({
      claimId: claim.claimId,
      text: claim.text,
      evidenceIds: Object.freeze(claim.sources.map(source => source.evidenceId)),
      citations: Object.freeze(citations),
    }));
  }

  const evidenceIds = Object.freeze([...evidenceById.keys()].sort());
  const citations = Object.freeze(evidenceIds.map(id => {
    const source = evidenceById.get(id)!;
    return Object.freeze({
      evidenceId: source.evidenceId,
      sourceBookId: source.sourceBookId,
      title: TITLE_BY_ID.get(source.sourceBookId)!,
      chapter: source.sourceChapter,
      locatorId: source.locatorId,
    });
  }));
  const workIds = new Set(citations.map(citation => citation.sourceBookId));
  const layout = defaultHoidNarrativeLayout(segments.length);
  const composition = composeHoidNarrative({
    segments: segments.map(segment => Object.freeze({
      claimId: segment.claimId,
      text: segment.text,
      evidenceIds: segment.evidenceIds,
    })),
  }, layout);
  if (composition.status !== "ready") return unavailable("invalid-dossier");

  if (
    segments.length > budget.maxClaims ||
    evidenceIds.length > budget.maxEvidence ||
    workIds.size > budget.maxWorks ||
    workIds.size < budget.minimumWorks ||
    composition.text.length > budget.maxCharacters
  ) return unavailable("budget-exceeded");

  if (
    budget.requireCrossWorkSegment &&
    !segments.some(segment =>
      new Set(segment.citations.map(citation => citation.sourceBookId)).size >= 2
    )
  ) return unavailable("budget-exceeded");

  const presentation: Extract<HoidAnswerPresentation, { status: "ready" }> = Object.freeze({
    status: "ready",
    text: composition.text,
    claimIds: composition.claimIds,
    evidenceIds: composition.evidenceIds,
    citations,
    layout: composition.layout,
    segments: Object.freeze(segments),
  });
  const projected = projectHoidAnswerForDisplay(presentation);
  if (!projected) return unavailable("invalid-dossier");
  return Object.freeze({ status: "ready", presentation: projected });
}

function canonicalConfig(value: unknown): AdapterConfig | null {
  const raw = exactRecord(value, ["gateway", "refreshCurrentProgress"]);
  if (
    !raw ||
    !isHoidEntityDossierGateway(raw.gateway) ||
    typeof raw.refreshCurrentProgress !== "function"
  ) return null;
  return Object.freeze({
    gateway: raw.gateway,
    refreshCurrentProgress: raw.refreshCurrentProgress as () => unknown | Promise<unknown>,
  });
}

function normalizeGatewayResult(
  value: HoidEntityDossierGatewayResult,
  scope: HoidAnswerBookScope,
  progress: ProgressIdentity,
): Readonly<{ status: "ready"; dossier: CanonicalDossier }> |
   Readonly<{ status: "not-found" }> |
   Readonly<{ status: "unavailable"; reason: "invalid-progress" | "progress-changed" | "invalid-dossier" }> {
  if (value.status === "not-found" || value.status === "ambiguous") {
    return Object.freeze({ status: "not-found" });
  }
  if (value.status === "unavailable") {
    return Object.freeze({
      status: "unavailable",
      reason: value.reason === "invalid-progress"
        ? "invalid-progress"
        : value.reason === "progress-changed"
          ? "progress-changed"
          : "invalid-dossier",
    });
  }
  if (
    value.progressRevision !== progress.revision ||
    value.progressFingerprint !== progress.fingerprint
  ) return Object.freeze({ status: "unavailable", reason: "invalid-dossier" });
  const dossier = canonicalDossier(value.dossier, scope, progress);
  return dossier
    ? Object.freeze({ status: "ready", dossier })
    : Object.freeze({ status: "unavailable", reason: "invalid-dossier" });
}

/**
 * Explain a relationship only when the same independently approved claim is
 * present in both progress- and scope-bound dossiers. The adapter has no
 * provider port and never infers a relationship from co-occurrence alone.
 */
export function createHoidEntityRelationshipConversationAdapter(
  configInput: unknown,
): HoidEntityRelationshipConversationAdapter | null {
  const config = canonicalConfig(configInput);
  if (!config) return null;

  return Object.freeze({
    async answer(
      input: unknown,
      options: Readonly<{ signal?: AbortSignal }> = {},
    ): Promise<HoidEntityRelationshipConversationResult> {
      if (options.signal?.aborted) return unavailable("cancelled");
      const request = exactRecord(
        input,
        ["question", "progress", "bookScope", "depth"],
        ["question", "progress", "bookScope"],
      );
      if (!request) return unavailable("invalid-request");

      const intent = classifyHoidEntityRelationshipIntent(request.question);
      if (intent.status === "not-relationship") return Object.freeze({ status: "not-relationship" });
      if (intent.status === "needs-names") return Object.freeze({ status: "needs-names" });
      if (intent.status === "invalid") return unavailable("invalid-request");

      const scope = canonicalizeHoidAnswerBookScope(request.bookScope);
      if (!scope) return unavailable("invalid-scope");
      const depth = request.depth === undefined ? "detailed" : request.depth;
      if (!isHoidExplanationDepth(depth)) return unavailable("invalid-request");

      const requestedProgress = progressIdentity(request.progress);
      if (!requestedProgress) return unavailable("invalid-progress");

      let beforeSnapshot: unknown;
      try {
        beforeSnapshot = await config.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const before = progressIdentity(beforeSnapshot);
      if (!before) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, before)) return unavailable("progress-changed");

      let leftRaw: HoidEntityDossierGatewayResult;
      let rightRaw: HoidEntityDossierGatewayResult;
      try {
        leftRaw = config.gateway.getDossier({
          progress: beforeSnapshot,
          query: Object.freeze({ text: intent.leftEntityName, bookScope: scope }),
        });
        if (options.signal?.aborted) return unavailable("cancelled");
        rightRaw = config.gateway.getDossier({
          progress: beforeSnapshot,
          query: Object.freeze({ text: intent.rightEntityName, bookScope: scope }),
        });
      } catch {
        return unavailable("invalid-dossier");
      }
      if (options.signal?.aborted) return unavailable("cancelled");

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

      const left = normalizeGatewayResult(leftRaw, scope, before);
      const right = normalizeGatewayResult(rightRaw, scope, before);
      if (left.status === "unavailable" || right.status === "unavailable") {
        return unavailable(
          left.reason === "progress-changed" || right.reason === "progress-changed"
            ? "progress-changed"
            : left.reason === "invalid-progress" || right.reason === "invalid-progress"
              ? "invalid-progress"
              : "invalid-dossier",
        );
      }
      if (left.status === "not-found" || right.status === "not-found") {
        return Object.freeze({ status: "not-found" });
      }

      const projected = buildRelationshipPresentation(left.dossier, right.dossier, scope, depth);
      if (projected.status !== "ready") return projected;
      return Object.freeze({
        status: "ready",
        presentation: projected.presentation,
        progressRevision: before.revision,
        progressFingerprint: before.fingerprint,
      });
    },
  });
}
