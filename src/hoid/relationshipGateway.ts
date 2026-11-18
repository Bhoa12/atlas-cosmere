import {
  resolveProductionHoidEntityMentions,
  type HoidEntityMentionResolutionResult,
} from "./entityResolver";
import type {
  HoidExplanationGateway,
  HoidExplanationGatewayResult,
} from "./explanationGateway";
import type { HoidRenderedExplanation } from "./knowledgeGraphQuery";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

export type HoidRelationshipGatewayResult =
  | Readonly<{
      status: "ready";
      explanation: Extract<HoidRenderedExplanation, { status: "ready" }>;
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
}>;

type ProgressIdentity = Readonly<{ revision: number; fingerprint: string }>;
type CanonicalEntityMention = Readonly<{ id: string; matchedAlias: string }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const KINDS = new Set(["character", "place", "event", "concept", "magic", "organization", "object"]);
const SOURCE_KEYS = [
  "evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId",
  "unlockChapter", "editionId", "navigationSha256", "documentSha256",
] as const;

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
  if (record.resolution === "ambiguous" || record.truncated || matches.length > 2) return "ambiguous";
  if (record.resolution === "not-found" || matches.length !== 2) return "unavailable";
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
    ordered[0].position === ordered[1].position
  ) return "ambiguous";

  return Object.freeze(ordered.map(entity => Object.freeze({
    id: entity.id,
    matchedAlias: entity.matchedAlias,
  })));
}

function unavailable(
  reason: Extract<HoidRelationshipGatewayResult, { status: "unavailable" }>["reason"],
): HoidRelationshipGatewayResult {
  return Object.freeze({ status: "unavailable", reason });
}

function explanationFailure(
  result: Extract<HoidExplanationGatewayResult, { status: "unavailable" }>,
): Extract<HoidRelationshipGatewayResult, { status: "unavailable" }>["reason"] {
  if (result.reason === "invalid-progress") return "invalid-progress";
  if (result.reason === "progress-changed") return "progress-changed";
  return "explanation-unavailable";
}

/**
 * Resolves exactly two reviewed, currently disclosed aliases and asks the
 * local graph gateway for a bounded directed path. The reverse direction is
 * attempted only when the first direction has no path. No fuzzy matching,
 * provider-generated entity IDs or provider-authored facts are accepted.
 */
export class HoidRelationshipGateway {
  constructor(private readonly config: HoidRelationshipGatewayConfig) {}

  answer(input: unknown): HoidRelationshipGatewayResult {
    const request = canonicalRecord(input, ["question", "progress"]);
    if (
      !request ||
      typeof request.question !== "string" ||
      request.question.length < 1 ||
      request.question.length > 4_000 ||
      request.question !== request.question.trim() ||
      /[\u0000-\u001F\u007F\p{Cf}]/u.test(request.question) ||
      !Object.prototype.hasOwnProperty.call(request, "progress")
    ) return unavailable("invalid-request");

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
      rawMentions = (this.config.resolveEntities ?? resolveProductionHoidEntityMentions)(
        request.progress,
        request.question,
      );
    } catch {
      return unavailable("entity-unavailable");
    }
    const mentions = canonicalMentions(rawMentions, requested, request.question);
    if (mentions === "blocked") return unavailable("entity-blocked");
    if (mentions === "ambiguous") return unavailable("entity-ambiguous");
    if (mentions === "unavailable") return unavailable("entity-unavailable");

    const firstQuery = Object.freeze({
      fromId: mentions[0].id,
      toId: mentions[1].id,
      maxDepth: 4,
      maxPaths: 1,
    });

    let firstResult: HoidExplanationGatewayResult;
    try {
      firstResult = this.config.explanationGateway.explain({
        progress: request.progress,
        query: firstQuery,
      });
    } catch {
      return unavailable("explanation-unavailable");
    }

    let selected: Extract<HoidExplanationGatewayResult, { status: "ready" }> | null = null;
    if (firstResult.status === "ready") {
      selected = firstResult;
    } else if (firstResult.status === "unavailable") {
      return unavailable(explanationFailure(firstResult));
    } else {
      if (
        firstResult.progressRevision !== requested.revision ||
        firstResult.progressFingerprint !== requested.fingerprint
      ) return unavailable("invalid-progress");

      let reverseResult: HoidExplanationGatewayResult;
      try {
        reverseResult = this.config.explanationGateway.explain({
          progress: request.progress,
          query: Object.freeze({
            fromId: mentions[1].id,
            toId: mentions[0].id,
            maxDepth: 4,
            maxPaths: 1,
          }),
        });
      } catch {
        return unavailable("explanation-unavailable");
      }
      if (reverseResult.status === "unavailable") return unavailable(explanationFailure(reverseResult));
      if (reverseResult.status === "ready") selected = reverseResult;
      else if (
        reverseResult.progressRevision !== requested.revision ||
        reverseResult.progressFingerprint !== requested.fingerprint
      ) return unavailable("invalid-progress");
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

    if (!selected) {
      return Object.freeze({
        status: "no-path",
        progressRevision: requested.revision,
        progressFingerprint: requested.fingerprint,
      });
    }
    if (
      selected.progressRevision !== requested.revision ||
      selected.progressFingerprint !== requested.fingerprint
    ) return unavailable("invalid-progress");

    return Object.freeze({
      status: "ready",
      explanation: selected.explanation,
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
    (config.resolveEntities !== undefined && typeof config.resolveEntities !== "function")
  ) return null;
  return new HoidRelationshipGateway(config);
}
