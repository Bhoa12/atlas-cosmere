import {
  isHoidEntityDossierGateway,
  type HoidEntityDossierGateway,
  type HoidEntityDossierGatewayResult,
} from "./entityDossierGateway";
import { classifyHoidEntityProgressTimelineIntent } from "./entityProgressTimelineIntent";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import { canonicalEvidenceScope, type HoidEvidenceCitation } from "./evidenceScope";
import {
  projectHoidAnswerForDisplay,
  type HoidAnswerDisplayProjection,
  type HoidDisplayCitation,
} from "./answerDisplayProjection";
import type { HoidAnswerPresentation, HoidPresentedCitation } from "./answerPresentation";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[];
}>;

type CanonicalClaim = Readonly<{
  claimId: string;
  intent: "explain" | "context" | "recommend";
  text: string;
  sources: readonly HoidEvidenceCitation[];
}>;

type CanonicalDossier = Readonly<{
  entity: Readonly<{ id: string; label: string; kind: HoidKnowledgeKind }>;
  summary: Readonly<{ text: string; source: HoidEvidenceCitation }>;
  claims: readonly CanonicalClaim[];
}>;

export type HoidEntityProgressTimelineItem = Readonly<{
  text: string;
  citations: readonly HoidDisplayCitation[];
}>;

export type HoidEntityProgressTimelineTrack = Readonly<{
  bookId: string;
  title: string;
  ordering: "availability-order";
  items: readonly HoidEntityProgressTimelineItem[];
}>;

export type HoidEntityProgressTimelineCrossWorkItem = Readonly<{
  text: string;
  citations: readonly HoidDisplayCitation[];
  ordering: "unordered";
}>;

export type HoidEntityProgressTimelineResult =
  | Readonly<{ status: "not-timeline" }>
  | Readonly<{ status: "needs-name" }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "ready";
      entity: Readonly<{ label: string; kind: HoidKnowledgeKind }>;
      semantics: "reading-order-evidence";
      crossWorkOrdering: "unordered";
      overview: HoidEntityProgressTimelineItem;
      tracks: readonly HoidEntityProgressTimelineTrack[];
      crossWorkItems: readonly HoidEntityProgressTimelineCrossWorkItem[];
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
        | "budget-exceeded";
    }>;

type AdapterConfig = Readonly<{
  gateway: HoidEntityDossierGateway;
  refreshCurrentProgress: () => unknown | Promise<unknown>;
}>;

export type HoidEntityProgressTimelineAdapter = Readonly<{
  answer(
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<HoidEntityProgressTimelineResult>;
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
const MAX_PRESENTED_EVIDENCE = 64;
const MAX_PRESENTED_CHARACTERS = 24_000;

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
  const source = exactRecord(value, resolvedSource ? RESOLVED_SOURCE_KEYS : CITATION_KEYS);
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

    const participants = denseArray(claim.participants, 1, MAX_PARTICIPANTS);
    if (!participants) return null;
    const participantIds = new Set<string>();
    for (const rawParticipant of participants) {
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
    }
    if (!participantIds.has(entity.id)) return null;

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
      left.sourceBookId < right.sourceBookId ? -1 :
      left.sourceBookId > right.sourceBookId ? 1 :
      left.sourceChapter - right.sourceChapter ||
      (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
    );
    claims.push(Object.freeze({
      claimId: claim.claimId,
      intent: claim.intent,
      text: claim.text,
      sources: Object.freeze(sources),
    }));
  }

  return Object.freeze({
    entity: Object.freeze({
      id: entity.id,
      label: entity.label,
      kind: entity.kind,
    }),
    summary: Object.freeze({ text: summary.text, source: summarySource }),
    claims: Object.freeze(claims),
  });
}

function unavailable(
  reason: Extract<HoidEntityProgressTimelineResult, { status: "unavailable" }>["reason"],
): HoidEntityProgressTimelineResult {
  return Object.freeze({ status: "unavailable", reason });
}

function normalizeGatewayResult(
  value: HoidEntityDossierGatewayResult,
  scope: HoidAnswerBookScope,
  progress: ProgressIdentity,
):
  | Readonly<{ status: "ready"; dossier: CanonicalDossier }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "progress-changed" | "invalid-dossier";
    }> {
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
  if (value.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-dossier" });
  }
  if (
    value.progressRevision !== progress.revision ||
    value.progressFingerprint !== progress.fingerprint
  ) return Object.freeze({ status: "unavailable", reason: "progress-changed" });
  const dossier = canonicalDossier(value.dossier, scope, progress);
  return dossier
    ? Object.freeze({ status: "ready", dossier })
    : Object.freeze({ status: "unavailable", reason: "invalid-dossier" });
}

function toPresentedCitation(source: HoidEvidenceCitation): HoidPresentedCitation {
  return Object.freeze({
    evidenceId: source.evidenceId,
    sourceBookId: source.sourceBookId,
    title: TITLE_BY_ID.get(source.sourceBookId)!,
    chapter: source.sourceChapter,
    locatorId: source.locatorId,
  });
}

type InternalTimelineItem = Readonly<{
  claimId: string;
  text: string;
  sortUnlockChapter: number;
  sortSourceChapter: number;
  citations: readonly HoidEvidenceCitation[];
}>;

function projectCitations(
  sources: readonly HoidEvidenceCitation[],
): readonly HoidDisplayCitation[] | null {
  const projected = projectHoidAnswerForDisplay(Object.freeze({
    status: "ready",
    text: "citation projection",
    claimIds: Object.freeze([]),
    evidenceIds: Object.freeze(sources.map(source => source.evidenceId)),
    citations: Object.freeze(sources.map(source => toPresentedCitation(source))),
  }));
  return projected ? projected.citations : null;
}

function buildTimeline(
  dossier: CanonicalDossier,
  progress: ProgressIdentity,
): HoidEntityProgressTimelineResult {
  const tracks = new Map<string, InternalTimelineItem[]>();
  const crossWorkItems: Readonly<{
    claimId: string;
    text: string;
    citations: readonly HoidEvidenceCitation[];
  }>[] = [];
  const evidenceById = new Map<string, HoidEvidenceCitation>();
  evidenceById.set(dossier.summary.source.evidenceId, dossier.summary.source);

  for (const claim of dossier.claims) {
    if (claim.intent === "recommend") continue;
    const workIds = [...new Set(claim.sources.map(source => source.sourceBookId))];
    for (const source of claim.sources) {
      const existing = evidenceById.get(source.evidenceId);
      if (existing && !sameCitation(existing, source)) return unavailable("invalid-dossier");
      evidenceById.set(source.evidenceId, source);
    }

    if (workIds.length > 1) {
      crossWorkItems.push(Object.freeze({
        claimId: claim.claimId,
        text: claim.text,
        citations: claim.sources,
      }));
      continue;
    }

    const bookId = workIds[0];
    if (!bookId) return unavailable("invalid-dossier");
    const list = tracks.get(bookId) ?? [];
    list.push(Object.freeze({
      claimId: claim.claimId,
      text: claim.text,
      sortUnlockChapter: Math.max(...claim.sources.map(source => source.unlockChapter)),
      sortSourceChapter: Math.max(...claim.sources.map(source => source.sourceChapter)),
      citations: claim.sources,
    }));
    tracks.set(bookId, list);
  }

  if (evidenceById.size > MAX_PRESENTED_EVIDENCE) return unavailable("budget-exceeded");

  const sortedTracks = [...tracks.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([bookId, items]) => {
      items.sort((left, right) =>
        left.sortUnlockChapter - right.sortUnlockChapter ||
        left.sortSourceChapter - right.sortSourceChapter ||
        (left.claimId < right.claimId ? -1 : left.claimId > right.claimId ? 1 : 0)
      );
      const title = TITLE_BY_ID.get(bookId);
      if (!title) return null;
      const projectedItems: HoidEntityProgressTimelineItem[] = [];
      for (const item of items) {
        const citations = projectCitations(item.citations);
        if (!citations) return null;
        projectedItems.push(Object.freeze({
          text: item.text,
          citations,
        }));
      }
      return Object.freeze({
        bookId,
        title,
        ordering: "availability-order" as const,
        items: Object.freeze(projectedItems),
      });
    });
  if (sortedTracks.some(track => track === null)) return unavailable("invalid-dossier");

  const projectedCrossWorkItems: HoidEntityProgressTimelineCrossWorkItem[] = [];
  crossWorkItems.sort((left, right) =>
    left.claimId < right.claimId ? -1 : left.claimId > right.claimId ? 1 : 0
  );
  for (const item of crossWorkItems) {
    const citations = projectCitations(item.citations);
    if (!citations) return unavailable("invalid-dossier");
    projectedCrossWorkItems.push(Object.freeze({
      text: item.text,
      citations,
      ordering: "unordered" as const,
    }));
  }

  const displayCitations = [...evidenceById.values()]
    .sort((left, right) =>
      left.sourceBookId < right.sourceBookId ? -1 :
      left.sourceBookId > right.sourceBookId ? 1 :
      left.sourceChapter - right.sourceChapter ||
      (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
    )
    .map(toPresentedCitation);

  const lines: string[] = [
    "Recorrido documental de " + dossier.entity.label,
    "Ordenado por disponibilidad de evidencias dentro de cada obra. No representa una cronología canónica de acontecimientos. Las afirmaciones que requieren varias obras se muestran aparte, sin imponer un orden global.",
    "Contexto autorizado: " + dossier.summary.text,
  ];

  for (const track of sortedTracks) {
    if (!track) continue;
    lines.push("");
    lines.push(track.title);
    for (const item of track.items) {
      lines.push("• " + item.text);
    }
  }

  if (projectedCrossWorkItems.length > 0) {
    lines.push("");
    lines.push("Conexiones respaldadas por varias obras (sin orden cronológico global)");
    for (const item of projectedCrossWorkItems) {
      lines.push("• " + item.text);
    }
  }

  if (sortedTracks.length === 0 && projectedCrossWorkItems.length === 0) {
    lines.push("");
    lines.push("Todavía no hay afirmaciones de evolución aprobadas y desbloqueadas para este ámbito.");
  }

  const text = lines.join("\n");
  if (text.length > MAX_PRESENTED_CHARACTERS) return unavailable("budget-exceeded");

  const claimIds = Object.freeze(dossier.claims
    .filter(claim => claim.intent !== "recommend")
    .map(claim => claim.claimId)
    .sort());
  const evidenceIds = Object.freeze([...evidenceById.keys()].sort());
  const presentation: Extract<HoidAnswerPresentation, { status: "ready" }> = Object.freeze({
    status: "ready",
    text,
    claimIds,
    evidenceIds,
    citations: Object.freeze(displayCitations),
  });
  const projected = projectHoidAnswerForDisplay(presentation);
  if (!projected) return unavailable("invalid-dossier");

  const overviewCitations = projectCitations([dossier.summary.source]);
  if (!overviewCitations || overviewCitations.length !== 1) {
    return unavailable("invalid-dossier");
  }

  return Object.freeze({
    status: "ready",
    entity: Object.freeze({
      label: dossier.entity.label,
      kind: dossier.entity.kind,
    }),
    semantics: "reading-order-evidence",
    crossWorkOrdering: "unordered",
    overview: Object.freeze({
      text: dossier.summary.text,
      citations: overviewCitations,
    }),
    tracks: Object.freeze(sortedTracks as HoidEntityProgressTimelineTrack[]),
    crossWorkItems: Object.freeze(projectedCrossWorkItems),
    presentation: projected,
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

/** Read-only, progress-bound evidence timeline. It never infers story chronology. */
export function createHoidEntityProgressTimelineAdapter(
  configInput: unknown,
): HoidEntityProgressTimelineAdapter | null {
  const config = exactRecord(configInput, ["gateway", "refreshCurrentProgress"]);
  if (
    !config ||
    !isHoidEntityDossierGateway(config.gateway) ||
    typeof config.refreshCurrentProgress !== "function"
  ) return null;

  const adapterConfig: AdapterConfig = Object.freeze({
    gateway: config.gateway,
    refreshCurrentProgress: config.refreshCurrentProgress as () => unknown | Promise<unknown>,
  });

  return Object.freeze({
    async answer(
      input: unknown,
      options: Readonly<{ signal?: AbortSignal }> = {},
    ): Promise<HoidEntityProgressTimelineResult> {
      if (options.signal?.aborted) return unavailable("cancelled");
      const request = exactRecord(
        input,
        ["question", "progress", "bookScope"],
      );
      if (!request) return unavailable("invalid-request");

      const intent = classifyHoidEntityProgressTimelineIntent(request.question);
      if (intent.status === "not-timeline") return Object.freeze({ status: "not-timeline" });
      if (intent.status === "needs-name") return Object.freeze({ status: "needs-name" });
      if (intent.status === "invalid") return unavailable("invalid-request");

      const scope = canonicalizeHoidAnswerBookScope(request.bookScope);
      if (!scope) return unavailable("invalid-scope");
      const requestedProgress = progressIdentity(request.progress);
      if (!requestedProgress) return unavailable("invalid-progress");

      let beforeSnapshot: unknown;
      try {
        beforeSnapshot = await adapterConfig.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const before = progressIdentity(beforeSnapshot);
      if (!before) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, before)) return unavailable("progress-changed");

      let raw: HoidEntityDossierGatewayResult;
      try {
        raw = adapterConfig.gateway.getDossier({
          progress: beforeSnapshot,
          query: Object.freeze({ text: intent.entityName, bookScope: scope }),
        });
      } catch {
        return unavailable("invalid-dossier");
      }
      if (options.signal?.aborted) return unavailable("cancelled");

      let afterSnapshot: unknown;
      try {
        afterSnapshot = await adapterConfig.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const after = progressIdentity(afterSnapshot);
      if (!after) return unavailable("invalid-progress");
      if (!sameProgress(before, after)) return unavailable("progress-changed");

      const normalized = normalizeGatewayResult(raw, scope, before);
      if (normalized.status === "unavailable") return unavailable(normalized.reason);
      if (normalized.status !== "ready") return Object.freeze({ status: "not-found" });
      return buildTimeline(normalized.dossier, before);
    },
  });
}
