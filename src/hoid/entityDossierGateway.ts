import {
  HoidKnowledgeCatalog,
  canonicalizeHoidKnowledgeEntries,
  type HoidKnowledgeEntry,
} from "./catalog";
import {
  HOID_APPROVED_CLAIMS,
  HOID_EDITORIAL_KNOWLEDGE,
} from "./editorialRegistry";
import {
  HOID_ENTITY_ALIAS_EVIDENCE,
} from "./entityAliasRegistry";
import {
  createHoidEvidenceRuntime,
} from "./evidenceRuntime";
import {
  evidenceCitationFor,
  isEvidenceUnlocked,
  type HoidEvidenceCitation,
} from "./evidenceScope";
import {
  resolveHoidAuthorizedEntities,
  resolveHoidAuthorizedEntityIds,
  resolveHoidAuthorizedEntityMentions,
  type HoidResolvedEntity,
  type HoidResolvedEntitySource,
} from "./entityResolver";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressSnapshot } from "./knowledgeGraph";
import {
  validateHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
  type HoidApprovedClaimIntent,
} from "./approvedClaimIntegrity";
import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";
import { sha256Hex } from "./sha256";

/**
 * A read-only, progress-bound view over already approved entity knowledge.
 * This is a projection, not a second knowledge store or promotion path.
 */
export type HoidEntityDossierQuery = Readonly<{
  text: string;
  kind?: HoidKnowledgeKind;
}>;

export type HoidEntityDossierParticipant = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
  label: string;
}>;

export type HoidEntityDossierClaim = Readonly<{
  claimId: string;
  intent: HoidApprovedClaimIntent;
  text: string;
  participants: readonly HoidEntityDossierParticipant[];
  sources: readonly HoidEvidenceCitation[];
}>;

export type HoidEntityDossier = Readonly<{
  schemaVersion: 1;
  dossierId: string;
  entity: Readonly<{
    id: string;
    kind: HoidKnowledgeKind;
    label: string;
    source: HoidResolvedEntitySource;
    aliasEvidence: readonly Readonly<{
      evidenceId: string;
      source: HoidResolvedEntitySource;
    }>[];
  }>;
  summary: Readonly<{
    text: string;
    source: HoidEvidenceCitation;
  }>;
  claims: readonly HoidEntityDossierClaim[];
  progressRevision: number;
  progressFingerprint: string;
  sourceTextIncluded: false;
  providerEgress: "none";
}>;

export type HoidEntityDossierBuildResult =
  | Readonly<{
      status: "ready";
      dossier: HoidEntityDossier;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "not-found" | "ambiguous";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-query"
        | "invalid-knowledge"
        | "invalid-claims"
        | "invalid-progress"
        | "budget-exceeded";
    }>;

export type HoidEntityDossierGatewayResult = HoidEntityDossierBuildResult | Readonly<{
  status: "unavailable";
  reason: "invalid-request" | "progress-changed";
}>;

export type HoidEntityDossierGateway = Readonly<{
  getDossier(input: unknown): HoidEntityDossierGatewayResult;
}>;

type GatewayConfig = Readonly<{
  knowledge: unknown;
  claims: unknown;
  aliasEvidence: unknown;
  getCurrentProgress: () => unknown;
}>;

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
}>;

const MAX_KNOWLEDGE = 512;
const MAX_CLAIMS = 512;
const MAX_DOSSIER_CLAIMS = 24;
const MAX_DOSSIER_SOURCES = 64;
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

function denseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
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

function canonicalQuery(value: unknown): HoidEntityDossierQuery | null {
  const raw = exactRecord(value, ["text", "kind"], ["text"]);
  if (!raw) return null;
  const text = raw.text;
  if (
    typeof text !== "string" ||
    text.length < 1 ||
    text.length > 256 ||
    text !== text.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(text)
  ) return null;
  if (raw.kind !== undefined && !isHoidKnowledgeKind(raw.kind)) return null;
  return Object.freeze({
    text,
    ...(raw.kind === undefined ? {} : { kind: raw.kind as HoidKnowledgeKind }),
  });
}

function progressIdentity(value: unknown): ProgressIdentity | null {
  const result = fingerprintHoidCursorProgressSnapshot(value);
  return result.status === "ready"
    ? Object.freeze({ revision: result.revision, fingerprint: result.sha256 })
    : null;
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function unavailable(
  reason: Extract<HoidEntityDossierBuildResult, { status: "unavailable" }>["reason"],
): HoidEntityDossierBuildResult {
  return Object.freeze({ status: "unavailable", reason });
}

function canonicalKnowledge(value: unknown): readonly HoidKnowledgeEntry[] | null {
  const raw = denseArray(value, MAX_KNOWLEDGE);
  if (!raw) return null;
  const entries = canonicalizeHoidKnowledgeEntries(raw);
  if (entries.length !== raw.length) return null;
  return Object.freeze(entries);
}

function canonicalClaims(
  value: unknown,
  knowledge: readonly HoidKnowledgeEntry[],
): readonly HoidApprovedClaim[] | null {
  const rawClaims = denseArray(value, MAX_CLAIMS);
  if (!rawClaims) return null;

  // Reuse the complete production runtime validator. No selector is supplied,
  // so this operation cannot invoke a model or provider.
  if (!createHoidEvidenceRuntime({
    knowledge,
    claims: rawClaims,
    selector: null,
  })) return null;

  const claims: HoidApprovedClaim[] = [];
  const seen = new Set<string>();
  for (const raw of rawClaims) {
    const validation = validateHoidApprovedClaimAttestation(raw, knowledge);
    if (validation.status !== "valid") {
      if (validation.reason === "unverified-source") continue;
      return null;
    }
    if (seen.has(validation.claim.id)) return null;
    seen.add(validation.claim.id);
    claims.push(validation.claim);
  }
  return Object.freeze(claims);
}

function intentOrder(intent: HoidApprovedClaimIntent): number {
  if (intent === "explain") return 0;
  if (intent === "context") return 1;
  return 2;
}

/**
 * Build a dossier exclusively from source-controlled, approved knowledge.
 *
 * The resolver independently gates the entity name and every alias disclosure.
 * The catalog independently gates the complete summary. Each attached claim
 * is included only when all of its evidence and every referenced participant
 * are safe at the same exact progress snapshot.
 */
export function buildHoidAuthorizedEntityDossier(
  knowledgeInput: unknown,
  claimsInput: unknown,
  aliasEvidenceInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidEntityDossierBuildResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");

  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return unavailable("invalid-progress");
  const progress = progressIdentity(progressInput);
  if (!progress) return unavailable("invalid-progress");

  const resolution = resolveHoidAuthorizedEntities(
    knowledgeInput,
    aliasEvidenceInput,
    progressInput,
    query,
  );
  if (resolution.status === "unavailable") {
    return unavailable(
      resolution.reason === "invalid-progress" ? "invalid-progress" : "invalid-knowledge",
    );
  }
  if (resolution.resolution === "not-found") {
    return Object.freeze({
      status: "not-found",
      progressRevision: progress.revision,
      progressFingerprint: progress.fingerprint,
    });
  }
  if (resolution.resolution === "ambiguous" || resolution.matches.length !== 1) {
    return Object.freeze({
      status: "ambiguous",
      progressRevision: progress.revision,
      progressFingerprint: progress.fingerprint,
    });
  }

  const knowledge = canonicalKnowledge(knowledgeInput);
  if (!knowledge) return unavailable("invalid-knowledge");
  const claims = canonicalClaims(claimsInput, knowledge);
  if (!claims) return unavailable("invalid-claims");

  const resolvedEntity = resolution.matches[0];
  const catalog = new HoidKnowledgeCatalog(knowledge);
  const safeEntries = catalog.entriesForContext(projection.reading);
  const safeEntity = safeEntries.find(entry => entry.id === resolvedEntity.id);
  if (
    !safeEntity ||
    typeof safeEntity.summary !== "string" ||
    safeEntity.provenance !== "verified"
  ) {
    return Object.freeze({
      status: "not-found",
      progressRevision: progress.revision,
      progressFingerprint: progress.fingerprint,
    });
  }
  const summarySource = evidenceCitationFor(safeEntity);
  if (!summarySource) return unavailable("invalid-knowledge");
  const summaryMentions = resolveHoidAuthorizedEntityMentions(
    knowledge,
    aliasEvidenceInput,
    progressInput,
    safeEntity.summary,
  );
  if (summaryMentions.status === "unavailable") {
    return unavailable(
      summaryMentions.reason === "invalid-progress" ? "invalid-progress" : "invalid-knowledge",
    );
  }
  if (
    summaryMentions.status === "blocked" ||
    summaryMentions.resolution === "ambiguous" ||
    summaryMentions.truncated
  ) {
    return Object.freeze({
      status: "not-found",
      progressRevision: progress.revision,
      progressFingerprint: progress.fingerprint,
    });
  }

  const knowledgeById = new Map(knowledge.map(entry => [entry.id, entry]));
  const visibleClaims: HoidEntityDossierClaim[] = [];
  let sourceCount = 1;

  for (const claim of claims) {
    const entityIds = claim.entityIds;
    if (!entityIds || !entityIds.includes(resolvedEntity.id)) continue;
    if (entityIds.length > MAX_PARTICIPANTS) return unavailable("budget-exceeded");

    // Entity IDs are disclosure facts too. Do not show a claim that names a
    // participant whose identity or alias is still locked.
    let participantMatches: readonly HoidResolvedEntity[] = Object.freeze([resolvedEntity]);
    if (entityIds.length > 1) {
      const participants = resolveHoidAuthorizedEntityIds(
        knowledge,
        aliasEvidenceInput,
        progressInput,
        entityIds,
      );
      if (
        participants.status !== "ready" ||
        participants.resolution !== "matched" ||
        participants.matches.length !== entityIds.length
      ) {
        if (participants.status === "unavailable" && participants.reason === "invalid-progress") {
          return unavailable("invalid-progress");
        }
        continue;
      }
      participantMatches = participants.matches;
    }

    // Scan approved prose against the independently gated alias registry. A
    // locked alias, ambiguous mention, or named entity missing from entityIds
    // withholds the whole claim rather than relying on the summary watermark.
    const mentions = resolveHoidAuthorizedEntityMentions(
      knowledge,
      aliasEvidenceInput,
      progressInput,
      claim.text,
    );
    if (mentions.status === "unavailable") {
      if (mentions.reason === "invalid-progress") return unavailable("invalid-progress");
      return unavailable("invalid-claims");
    }
    if (
      mentions.status === "blocked" ||
      mentions.resolution === "ambiguous" ||
      mentions.truncated ||
      (mentions.resolution === "matched" &&
        mentions.matches.some(match => !entityIds.includes(match.id)))
    ) continue;

    const evidenceEntries = claim.evidenceIds.map(id => knowledgeById.get(id));
    if (evidenceEntries.some(entry => !entry)) return unavailable("invalid-claims");
    const concreteEntries = evidenceEntries as HoidKnowledgeEntry[];
    if (!concreteEntries.every(entry =>
      entry.provenance === "verified" &&
      isEvidenceUnlocked(entry, projection.reading) &&
      evidenceCitationFor(entry) !== null
    )) continue;

    const sources = concreteEntries.map(entry => evidenceCitationFor(entry));
    if (sources.some(source => source === null)) return unavailable("invalid-claims");
    const canonicalSources = Object.freeze(sources as HoidEvidenceCitation[]);
    sourceCount += canonicalSources.length;
    if (
      visibleClaims.length >= MAX_DOSSIER_CLAIMS ||
      sourceCount > MAX_DOSSIER_SOURCES
    ) return unavailable("budget-exceeded");

    const canonicalParticipants = Object.freeze(
      participantMatches
        .map(match => Object.freeze({
          id: match.id,
          kind: match.kind,
          label: match.matchedAlias,
        }))
        .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
    visibleClaims.push(Object.freeze({
      claimId: claim.id,
      intent: claim.intent,
      text: claim.text,
      participants: canonicalParticipants,
      sources: canonicalSources,
    }));
  }

  visibleClaims.sort((left, right) => {
    const order = intentOrder(left.intent) - intentOrder(right.intent);
    if (order !== 0) return order;
    return left.claimId < right.claimId ? -1 : left.claimId > right.claimId ? 1 : 0;
  });

  const aliasEvidence = Object.freeze(resolvedEntity.aliasEvidence.map(item =>
    Object.freeze({
      evidenceId: item.evidenceId,
      source: item.source,
    }),
  ));
  const dossierId = sha256Hex(JSON.stringify([
    "hoid-entity-dossier-v1",
    progress.fingerprint,
    resolvedEntity.id,
    resolvedEntity.kind,
    resolvedEntity.matchedAlias,
    resolvedEntity.entitySource,
    aliasEvidence,
    sha256Hex(safeEntity.summary),
    visibleClaims.map(claim => [
      claim.claimId,
      claim.intent,
      sha256Hex(claim.text),
      claim.participants.map(participant => [participant.id, participant.kind, participant.label]),
      claim.sources,
    ]),
  ]));

  const dossier: HoidEntityDossier = Object.freeze({
    schemaVersion: 1,
    dossierId,
    entity: Object.freeze({
      id: resolvedEntity.id,
      kind: resolvedEntity.kind,
      label: resolvedEntity.matchedAlias,
      source: resolvedEntity.entitySource,
      aliasEvidence,
    }),
    summary: Object.freeze({
      text: safeEntity.summary,
      source: summarySource,
    }),
    claims: Object.freeze(visibleClaims),
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
    sourceTextIncluded: false,
    providerEgress: "none",
  });

  return Object.freeze({
    status: "ready",
    dossier,
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

function canonicalConfig(value: unknown): GatewayConfig | null {
  const raw = exactRecord(
    value,
    ["knowledge", "claims", "aliasEvidence", "getCurrentProgress"],
  );
  if (!raw || typeof raw.getCurrentProgress !== "function") return null;
  return Object.freeze({
    knowledge: raw.knowledge,
    claims: raw.claims,
    aliasEvidence: raw.aliasEvidence,
    getCurrentProgress: raw.getCurrentProgress as () => unknown,
  });
}

/**
 * A synchronous provider-neutral gateway that discards a dossier if progress
 * changes during construction. It never stores progress or mutates a cursor.
 */
export function createHoidEntityDossierGateway(
  configInput: unknown,
): HoidEntityDossierGateway | null {
  const config = canonicalConfig(configInput);
  if (!config) return null;

  return Object.freeze({
    getDossier(input: unknown): HoidEntityDossierGatewayResult {
      const request = exactRecord(input, ["progress", "query"]);
      if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-request" });

      const requested = progressIdentity(request.progress);
      if (!requested) return unavailable("invalid-progress");

      let beforeSnapshot: unknown;
      try {
        beforeSnapshot = config.getCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      const before = progressIdentity(beforeSnapshot);
      if (!before) return unavailable("invalid-progress");
      if (!sameProgress(requested, before)) {
        return Object.freeze({ status: "unavailable", reason: "progress-changed" });
      }

      const result = buildHoidAuthorizedEntityDossier(
        config.knowledge,
        config.claims,
        config.aliasEvidence,
        request.progress,
        request.query,
      );

      let afterSnapshot: unknown;
      try {
        afterSnapshot = config.getCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      const after = progressIdentity(afterSnapshot);
      if (!after) return unavailable("invalid-progress");
      if (!sameProgress(requested, after)) {
        return Object.freeze({ status: "unavailable", reason: "progress-changed" });
      }
      return result;
    },
  });
}

/** Production composition uses only the trusted source-controlled registries. */
export function createProductionHoidEntityDossierGateway(
  getCurrentProgress: (() => unknown) | null,
): HoidEntityDossierGateway | null {
  if (typeof getCurrentProgress !== "function") return null;
  return createHoidEntityDossierGateway({
    knowledge: HOID_EDITORIAL_KNOWLEDGE,
    claims: HOID_APPROVED_CLAIMS,
    aliasEvidence: HOID_ENTITY_ALIAS_EVIDENCE,
    getCurrentProgress,
  });
}
