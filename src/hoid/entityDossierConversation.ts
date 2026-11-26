import type { HoidEntityDossierGateway } from "./entityDossierGateway";
import {
  classifyHoidEntityDossierIntent,
  type HoidEntityDossierIntent,
} from "./entityDossierIntent";
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

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export type HoidEntityDossierConversationResult =
  | Readonly<{ status: "not-dossier" }>
  | Readonly<{ status: "needs-name" }>
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

export type HoidEntityDossierConversationAdapter = Readonly<{
  answer(
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<HoidEntityDossierConversationResult>;
}>;

const TITLE_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_CLAIMS = 24;
const MAX_SOURCES_PER_CLAIM = 16;
const MAX_PARTICIPANTS = 4;

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

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
}

function canonicalSource(
  value: unknown,
  scope: HoidAnswerBookScope,
): Readonly<{ citation: HoidPresentedCitation; source: HoidEvidenceCitation }> | null {
  const source = exactRecord(value, [
    "evidenceId",
    "sourceBookId",
    "sourceChapter",
    "locatorId",
    "unlockBookId",
    "unlockChapter",
  ]);
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

  const canonical: HoidEvidenceCitation = Object.freeze({
    evidenceId: source.evidenceId,
    sourceBookId: source.sourceBookId,
    sourceChapter: source.sourceChapter,
    locatorId: source.locatorId,
    unlockBookId: source.unlockBookId,
    unlockChapter: source.unlockChapter,
  });
  const citation: HoidPresentedCitation = Object.freeze({
    evidenceId: canonical.evidenceId,
    sourceBookId: canonical.sourceBookId,
    title: TITLE_BY_ID.get(canonical.sourceBookId)!,
    chapter: canonical.sourceChapter,
    locatorId: canonical.locatorId,
  });
  return Object.freeze({ citation, source: canonical });
}

function projectDossier(
  value: unknown,
  scope: HoidAnswerBookScope,
  depth: HoidExplanationDepth,
  progress: ProgressIdentity,
): HoidAnswerDisplayProjection | null {
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

  const summary = exactRecord(dossier.summary, ["text", "source"]);
  if (!summary || !validText(summary.text, 4_000)) return null;
  const summarySource = canonicalSource(summary.source, scope);
  if (!summarySource) return null;

  const rawClaims = denseArray(dossier.claims, 0, MAX_CLAIMS);
  if (!rawClaims) return null;
  const budget = resolveHoidExplanationDepthBudget(depth);
  if (!budget) return null;

  const summaryClaimId = "dossier-summary-" + dossier.dossierId.slice(0, 16);
  const claimIds = new Set<string>([summaryClaimId]);
  const allEvidence = new Map<string, HoidPresentedCitation>();
  allEvidence.set(summarySource.citation.evidenceId, summarySource.citation);
  const summaryEvidenceIds = Object.freeze([summarySource.citation.evidenceId]);
  const segments: HoidPresentedSegment[] = [Object.freeze({
    claimId: summaryClaimId,
    text: summary.text,
    evidenceIds: summaryEvidenceIds,
    citations: Object.freeze([summarySource.citation]),
  })];

  for (const rawClaim of rawClaims) {
    const claim = exactRecord(rawClaim, ["claimId", "intent", "text", "participants", "sources"]);
    if (
      !claim ||
      typeof claim.claimId !== "string" ||
      !ID_PATTERN.test(claim.claimId) ||
      claimIds.has(claim.claimId) ||
      (claim.intent !== "explain" && claim.intent !== "context" && claim.intent !== "recommend") ||
      !validText(claim.text, 4_000)
    ) return null;
    claimIds.add(claim.claimId);

    const participants = denseArray(claim.participants, 1, MAX_PARTICIPANTS);
    if (!participants) return null;
    const participantIds = new Set<string>();
    for (const rawParticipant of participants) {
      const participant = exactRecord(rawParticipant, ["id", "kind", "label"]);
      if (
        !participant ||
        typeof participant.id !== "string" ||
        !ID_PATTERN.test(participant.id) ||
        !isHoidKnowledgeKind(participant.kind) ||
        !validText(participant.label, 256) ||
        participantIds.has(participant.id)
      ) return null;
      participantIds.add(participant.id);
    }
    if (!participantIds.has(entity.id)) return null;

    const rawSources = denseArray(claim.sources, 1, MAX_SOURCES_PER_CLAIM);
    if (!rawSources) return null;
    const segmentSources = rawSources.map(source => canonicalSource(source, scope));
    if (segmentSources.some(source => source === null)) return null;
    const concreteSources = segmentSources as Readonly<{
      citation: HoidPresentedCitation;
      source: HoidEvidenceCitation;
    }>[];
    const segmentEvidenceIds = concreteSources.map(item => item.citation.evidenceId);
    if (new Set(segmentEvidenceIds).size !== segmentEvidenceIds.length) return null;
    const citations = Object.freeze(concreteSources.map(item => item.citation));
    for (const citation of citations) {
      const existing = allEvidence.get(citation.evidenceId);
      if (existing && (
        existing.sourceBookId !== citation.sourceBookId ||
        existing.chapter !== citation.chapter ||
        existing.locatorId !== citation.locatorId
      )) return null;
      allEvidence.set(citation.evidenceId, citation);
    }
    segments.push(Object.freeze({
      claimId: claim.claimId,
      text: claim.text,
      evidenceIds: Object.freeze(segmentEvidenceIds),
      citations,
    }));
  }

  const evidenceIds = Object.freeze([...allEvidence.keys()].sort());
  const citations = Object.freeze(evidenceIds.map(id => allEvidence.get(id)!));
  const workIds = new Set(citations.map(citation => citation.sourceBookId));
  const text = "Expediente de " + entity.label + "\n\n" + segments.map(segment => segment.text).join("\n\n");
  if (
    segments.length > budget.maxClaims ||
    evidenceIds.length > budget.maxEvidence ||
    workIds.size > budget.maxWorks ||
    workIds.size < budget.minimumWorks ||
    text.length > budget.maxCharacters
  ) return null;

  const presentation: Extract<HoidAnswerPresentation, { status: "ready" }> = Object.freeze({
    status: "ready",
    text,
    claimIds: Object.freeze(segments.map(segment => segment.claimId)),
    evidenceIds,
    citations,
    layout: "grouped",
    segments: Object.freeze(segments),
  });
  return projectHoidAnswerForDisplay(presentation);
}

function canonicalConfig(value: unknown): AdapterConfig | null {
  const raw = exactRecord(value, ["gateway", "refreshCurrentProgress"]);
  if (!raw || typeof raw.refreshCurrentProgress !== "function") return null;
  const gateway = exactRecord(raw.gateway, ["getDossier"]);
  if (!gateway || typeof gateway.getDossier !== "function") return null;
  return Object.freeze({
    gateway: Object.freeze({ getDossier: gateway.getDossier as HoidEntityDossierGateway["getDossier"] }),
    refreshCurrentProgress: raw.refreshCurrentProgress as () => unknown | Promise<unknown>,
  });
}

function unavailable(
  reason: Extract<HoidEntityDossierConversationResult, { status: "unavailable" }>["reason"],
): HoidEntityDossierConversationResult {
  return Object.freeze({ status: "unavailable", reason });
}

export function createHoidEntityDossierConversationAdapter(
  configInput: unknown,
): HoidEntityDossierConversationAdapter | null {
  const config = canonicalConfig(configInput);
  if (!config) return null;

  return Object.freeze({
    async answer(
      input: unknown,
      options: Readonly<{ signal?: AbortSignal }> = {},
    ): Promise<HoidEntityDossierConversationResult> {
      if (options.signal?.aborted) return unavailable("cancelled");
      const request = exactRecord(input, ["question", "progress", "bookScope", "depth"], [
        "question",
        "progress",
        "bookScope",
      ]);
      if (!request) return unavailable("invalid-request");

      const intent: HoidEntityDossierIntent = classifyHoidEntityDossierIntent(request.question);
      if (intent.status === "not-dossier") return Object.freeze({ status: "not-dossier" });
      if (intent.status === "needs-name") return Object.freeze({ status: "needs-name" });
      if (intent.status === "invalid") return unavailable("invalid-request");

      const bookScope = canonicalizeHoidAnswerBookScope(request.bookScope);
      if (!bookScope) return unavailable("invalid-scope");
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

      let rawResult: unknown;
      try {
        rawResult = config.gateway.getDossier({
          progress: beforeSnapshot,
          query: Object.freeze({
            text: intent.entityName,
            bookScope,
          }),
        });
      } catch {
        return unavailable("invalid-dossier");
      }
      if (options.signal?.aborted) return unavailable("cancelled");

      const result = exactRecord(rawResult, [
        "status",
        "dossier",
        "progressRevision",
        "progressFingerprint",
        "reason",
      ], ["status"]);
      if (!result) return unavailable("invalid-dossier");

      if (result.status === "not-found" || result.status === "ambiguous") {
        // Unknown, locked and ambiguous aliases remain indistinguishable in the UI.
        return Object.freeze({ status: "not-found" });
      }
      if (result.status === "unavailable") {
        if (result.reason === "progress-changed") return unavailable("progress-changed");
        if (result.reason === "invalid-progress") return unavailable("invalid-progress");
        if (result.reason === "invalid-request" || result.reason === "invalid-query") {
          return unavailable("invalid-request");
        }
        if (result.reason === "budget-exceeded") return unavailable("budget-exceeded");
        return unavailable("invalid-dossier");
      }
      if (
        result.status !== "ready" ||
        result.progressRevision !== requestedProgress.revision ||
        result.progressFingerprint !== requestedProgress.fingerprint
      ) return unavailable("invalid-dossier");

      const presentation = projectDossier(result.dossier, bookScope, depth, requestedProgress);
      if (!presentation) return unavailable("budget-exceeded");

      let afterSnapshot: unknown;
      try {
        afterSnapshot = await config.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const after = progressIdentity(afterSnapshot);
      if (!after) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, after)) return unavailable("progress-changed");

      return Object.freeze({
        status: "ready",
        presentation,
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
      });
    },
  });
}
