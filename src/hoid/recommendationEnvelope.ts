import { sha256Hex } from "./sha256";
import { HOID_TOPIC_TAXONOMY, type HoidTopicId } from "./topicTaxonomy";
import {
  getHoidEditionRecommendationDisplayProgressScope,
  getHoidTopicRecommendationDisplayProgressScope,
  isHoidEditionRecommendationDisplayProjection,
  isHoidTopicRecommendationDisplayProjection,
  type HoidEditionRecommendationDisplayProjection,
  type HoidRecommendationProgressScope,
  type HoidTopicRecommendationDisplayItem,
} from "./recommendationDisplayProjection";
import {
  isHoidCuratedPathRecommendationDisplayProjection,
  type HoidCuratedPathRecommendationDisplayProjection,
} from "./curatedPathRecommendationDisplayProjection";

export type HoidResumeReadingRecommendationEnvelope = Readonly<{
  schemaVersion: 1;
  status: "ready";
  kind: "resume-reading";
  progressScope: HoidRecommendationProgressScope;
  display: HoidEditionRecommendationDisplayProjection;
}>;

export type HoidTopicInterestRecommendationEnvelope = Readonly<{
  schemaVersion: 1;
  status: "ready";
  kind: "topic-interest";
  progressScope: HoidRecommendationProgressScope;
  selectedTopicIds: readonly HoidTopicId[];
  selectionFingerprint: string;
  display: readonly HoidTopicRecommendationDisplayItem[];
}>;

export type HoidCuratedPathRecommendationEnvelope = Readonly<{
  schemaVersion: 1;
  status: "ready";
  kind: "curated-path";
  progressScope: HoidRecommendationProgressScope;
  display: Extract<HoidCuratedPathRecommendationDisplayProjection, { status: "ready" }>;
}>;

export type HoidRecommendationKind =
  | "resume-reading"
  | "topic-interest"
  | "curated-path";

export type HoidRecommendationAbstentionReason =
  | "progress-changed"
  | "cancelled"
  | "trust-unavailable"
  | "no-reviewed-match"
  | "invalid-projection"
  | "unavailable";

export type HoidRecommendationAbstentionEnvelope = Readonly<{
  schemaVersion: 1;
  status: "withheld";
  kind: HoidRecommendationKind;
  progressScope: HoidRecommendationProgressScope;
  reason: HoidRecommendationAbstentionReason;
  text: string;
}>;

export type HoidNarrativeRecommendationEnvelope =
  | HoidResumeReadingRecommendationEnvelope
  | HoidTopicInterestRecommendationEnvelope
  | HoidCuratedPathRecommendationEnvelope
  | HoidRecommendationAbstentionEnvelope;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TOPIC_IDS = new Set(HOID_TOPIC_TAXONOMY.map(topic => topic.id));
const ABSTENTION_TEXT: Readonly<Record<HoidRecommendationAbstentionReason, string>> = Object.freeze({
  "progress-changed": "Tu progreso de lectura ha cambiado. He descartado estas recomendaciones; vuelve a calcularlas.",
  cancelled: "Consulta cancelada. No se mostrarán resultados parciales.",
  "trust-unavailable": "No se ha podido verificar la autoridad editorial. Las recomendaciones permanecen ocultas.",
  "no-reviewed-match": "No hay asociaciones editoriales aprobadas para esta selección. No inferiré recomendaciones por semejanza.",
  "invalid-projection": "No se ha podido validar la presentación completa. He descartado las recomendaciones.",
  unavailable: "Las recomendaciones no están disponibles con el contexto de lectura actual.",
});

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
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return keys.every(key => Object.prototype.hasOwnProperty.call(result, key))
      ? result
      : null;
  } catch {
    return null;
  }
}

function canonicalProgressScope(value: unknown): HoidRecommendationProgressScope | null {
  const record = exactRecord(value, ["revision", "fingerprint"]);
  if (
    !record ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    typeof record.fingerprint !== "string" ||
    !SHA256_PATTERN.test(record.fingerprint)
  ) return null;
  return Object.freeze({
    revision: record.revision,
    fingerprint: record.fingerprint,
  });
}

function sameProgressScope(
  left: HoidRecommendationProgressScope,
  right: HoidRecommendationProgressScope,
): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function canonicalTopicIds(value: unknown): readonly HoidTopicId[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > HOID_TOPIC_TAXONOMY.length ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: HoidTopicId[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const topicId = descriptor.value;
      if (
        typeof topicId !== "string" ||
        !TOPIC_IDS.has(topicId as HoidTopicId) ||
        seen.has(topicId)
      ) return null;
      seen.add(topicId);
      result.push(topicId as HoidTopicId);
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

/** Stable, provider-neutral identity for an explicit topic selection. */
export function fingerprintHoidTopicSelection(topicIdsInput: unknown): string | null {
  const topicIds = canonicalTopicIds(topicIdsInput);
  return topicIds ? sha256Hex(topicIds.join("\n")) : null;
}

/**
 * Wrap only a display projection produced by the trusted edition projector.
 * The projector's private WeakMap binds it to the exact progress revision and
 * fingerprint; the navigation target remains outside this envelope.
 */
export function createHoidResumeReadingRecommendationEnvelope(
  input: unknown,
): HoidResumeReadingRecommendationEnvelope | null {
  const record = exactRecord(input, ["display", "progressScope"]);
  if (!record || !isHoidEditionRecommendationDisplayProjection(record.display)) return null;
  const progressScope = canonicalProgressScope(record.progressScope);
  const projectedScope = getHoidEditionRecommendationDisplayProgressScope(record.display);
  if (!progressScope || !projectedScope || !sameProgressScope(progressScope, projectedScope)) return null;
  return Object.freeze({
    schemaVersion: 1,
    status: "ready",
    kind: "resume-reading",
    progressScope,
    display: record.display,
  });
}

/**
 * Wrap only a display projection emitted by the trusted topic projector and
 * bind it to both the verified progress identity and the user's exact topic set.
 */
export function createHoidTopicInterestRecommendationEnvelope(
  input: unknown,
): HoidTopicInterestRecommendationEnvelope | null {
  const record = exactRecord(input, ["display", "progressScope", "selectedTopicIds"]);
  if (!record || !isHoidTopicRecommendationDisplayProjection(record.display)) return null;
  const progressScope = canonicalProgressScope(record.progressScope);
  const projectedScope = getHoidTopicRecommendationDisplayProgressScope(record.display);
  const selectedTopicIds = canonicalTopicIds(record.selectedTopicIds);
  if (
    !progressScope ||
    !projectedScope ||
    !sameProgressScope(progressScope, projectedScope) ||
    !selectedTopicIds
  ) return null;

  const selectedLabels = new Set(
    HOID_TOPIC_TAXONOMY
      .filter(topic => selectedTopicIds.includes(topic.id))
      .map(topic => topic.label),
  );
  for (const item of record.display) {
    for (const match of item.matches) {
      if (!selectedLabels.has(match.topicLabel)) return null;
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    status: "ready",
    kind: "topic-interest",
    progressScope,
    selectedTopicIds,
    selectionFingerprint: sha256Hex(selectedTopicIds.join("\n")),
    display: record.display,
  });
}

/**
 * Curated routes arrive through a host-branded screen port that revalidates
 * signatures, anti-rollback state and live progress. The projection itself is
 * privately branded by its trusted display projector; navigation remains manual.
 */
export function createHoidCuratedPathRecommendationEnvelope(
  input: unknown,
): HoidCuratedPathRecommendationEnvelope | null {
  const record = exactRecord(input, ["display", "progressScope"]);
  if (!record || !isHoidCuratedPathRecommendationDisplayProjection(record.display)) return null;
  const progressScope = canonicalProgressScope(record.progressScope);
  if (!progressScope) return null;
  return Object.freeze({
    schemaVersion: 1,
    status: "ready",
    kind: "curated-path",
    progressScope,
    display: record.display,
  });
}

/** Fixed-copy recommendation abstention; no provider-authored text is accepted. */
export function createHoidRecommendationAbstentionEnvelope(
  input: unknown,
): HoidRecommendationAbstentionEnvelope | null {
  const record = exactRecord(input, ["kind", "progressScope", "reason"]);
  if (
    !record ||
    (record.kind !== "resume-reading" && record.kind !== "topic-interest" && record.kind !== "curated-path") ||
    typeof record.reason !== "string" ||
    !Object.prototype.hasOwnProperty.call(ABSTENTION_TEXT, record.reason)
  ) return null;
  const progressScope = canonicalProgressScope(record.progressScope);
  if (!progressScope) return null;
  const reason = record.reason as HoidRecommendationAbstentionReason;
  return Object.freeze({
    schemaVersion: 1,
    status: "withheld",
    kind: record.kind,
    progressScope,
    reason,
    text: ABSTENTION_TEXT[reason],
  });
}
