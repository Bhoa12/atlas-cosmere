import type { HoidConversationIntentResult } from "./conversationIntent";
import type { HoidEntityDossierIntent } from "./entityDossierIntent";
import type { HoidEntityRelationshipIntent } from "./entityRelationshipIntent";
import type { HoidEntityProgressTimelineIntent } from "./entityProgressTimelineIntent";
import type { HoidMagicSystemExplanationIntent } from "./magicSystemExplanationIntent";
import type { HoidCharacterEvolutionIntent } from "./entityEvolutionExplanationIntent";

export type HoidConversationRoute =
  | "invalid-request"
  | "dossier-invalid"
  | "dossier-needs-name"
  | "relationship-invalid"
  | "relationship-needs-names"
  | "timeline-invalid"
  | "timeline-needs-name"
  | "relationship-intent-mismatch"
  | "reread-request"
  | "curated-discovery"
  | "reading-progress"
  | "catalogue-recommendation"
  | "scope-selection-required"
  | "scope-unavailable"
  | "relationship"
  | "timeline"
  | "character-evolution"
  | "magic-system"
  | "dossier"
  | "invalid-intent"
  | "trusted-host-unavailable"
  | "conversation";

export type HoidConversationRoutePlanInput = Readonly<{
  intentPlan: HoidConversationIntentResult;
  dossierIntent: HoidEntityDossierIntent;
  relationshipIntent: HoidEntityRelationshipIntent;
  timelineIntent: HoidEntityProgressTimelineIntent;
  magicSystemIntent: HoidMagicSystemExplanationIntent;
  characterEvolutionIntent: HoidCharacterEvolutionIntent;
  answerScopeStatus: "ready" | "selection-required" | "unavailable";
  trustedConversationAvailable: boolean;
}>;

export type HoidConversationRoutePlanResult =
  | Readonly<{ status: "ready"; route: HoidConversationRoute }>
  | Readonly<{ status: "unavailable"; reason: "invalid-input" }>;

type DataRecord = Record<string, unknown>;

const INPUT_KEYS = [
  "intentPlan",
  "dossierIntent",
  "relationshipIntent",
  "timelineIntent",
  "magicSystemIntent",
  "characterEvolutionIntent",
  "answerScopeStatus",
  "trustedConversationAvailable",
] as const;

const INTENT_MODES = new Set([
  "reread-request",
  "curated-discovery",
  "catalogue-recommendation",
  "reading-progress",
  "narrative-context",
  "relationship-explanation",
  "explanation",
]);
const INTENT_SIGNALS = new Set([
  "reread-cue",
  "discovery-cue",
  "recommendation-cue",
  "progress-position-cue",
  "narrative-recap-cue",
  "relationship-cue",
  "default-explanation",
]);
const CLAIM_INTENTS = new Set(["explain", "recommend", "context"]);
const MAGIC_FACETS = new Set([
  "principle",
  "rule",
  "limitation",
  "cost",
  "application",
  "exception",
  "interaction",
]);
const EVOLUTION_DIMENSIONS = new Set([
  "perspective",
  "knowledge",
  "capability",
  "affiliation",
  "relationship",
  "status",
  "motivation",
  "cause",
]);

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch {
    return null;
  }
}

function exactKeyCount(record: DataRecord, count: number): boolean {
  return Reflect.ownKeys(record).length === count;
}

function validName(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
}

function canonicalIntent(value: unknown): HoidConversationIntentResult | null {
  const record = exactRecord(value, ["status", "intent", "mode", "signal", "reason"], ["status"]);
  if (!record) return null;

  if (record.status === "ready") {
    if (
      !exactKeyCount(record, 4) ||
      !CLAIM_INTENTS.has(String(record.intent)) ||
      typeof record.mode !== "string" ||
      !INTENT_MODES.has(record.mode) ||
      typeof record.signal !== "string" ||
      !INTENT_SIGNALS.has(record.signal)
    ) return null;
    return value as HoidConversationIntentResult;
  }

  if (
    record.status === "unavailable" &&
    exactKeyCount(record, 2) &&
    record.reason === "invalid-question"
  ) return value as HoidConversationIntentResult;

  return null;
}

function canonicalDossier(value: unknown): HoidEntityDossierIntent | null {
  const record = exactRecord(value, ["status", "entityName"], ["status"]);
  if (!record) return null;
  if (record.status === "ready") {
    return exactKeyCount(record, 2) && validName(record.entityName)
      ? value as HoidEntityDossierIntent
      : null;
  }
  return exactKeyCount(record, 1) &&
    (record.status === "not-dossier" || record.status === "needs-name" || record.status === "invalid")
    ? value as HoidEntityDossierIntent
    : null;
}

function canonicalRelationship(value: unknown): HoidEntityRelationshipIntent | null {
  const record = exactRecord(value, ["status", "leftEntityName", "rightEntityName"], ["status"]);
  if (!record) return null;
  if (record.status === "ready") {
    return exactKeyCount(record, 3) &&
      validName(record.leftEntityName) &&
      validName(record.rightEntityName) &&
      record.leftEntityName !== record.rightEntityName
      ? value as HoidEntityRelationshipIntent
      : null;
  }
  return exactKeyCount(record, 1) &&
    (record.status === "not-relationship" || record.status === "needs-names" || record.status === "invalid")
    ? value as HoidEntityRelationshipIntent
    : null;
}

function canonicalTimeline(value: unknown): HoidEntityProgressTimelineIntent | null {
  const record = exactRecord(value, ["status", "entityName"], ["status"]);
  if (!record) return null;
  if (record.status === "ready") {
    return exactKeyCount(record, 2) && validName(record.entityName)
      ? value as HoidEntityProgressTimelineIntent
      : null;
  }
  return exactKeyCount(record, 1) &&
    (record.status === "not-timeline" || record.status === "needs-name" || record.status === "invalid")
    ? value as HoidEntityProgressTimelineIntent
    : null;
}

function canonicalMagic(value: unknown): HoidMagicSystemExplanationIntent | null {
  const record = exactRecord(value, ["status", "systemName", "facet"], ["status"]);
  if (!record) return null;
  if (record.status === "ready") {
    const hasFacet = Object.prototype.hasOwnProperty.call(record, "facet");
    return (exactKeyCount(record, hasFacet ? 3 : 2) &&
      validName(record.systemName) &&
      (!hasFacet || (typeof record.facet === "string" && MAGIC_FACETS.has(record.facet))))
      ? value as HoidMagicSystemExplanationIntent
      : null;
  }
  return exactKeyCount(record, 1) &&
    (record.status === "not-magic" || record.status === "needs-name" || record.status === "invalid")
    ? value as HoidMagicSystemExplanationIntent
    : null;
}

function canonicalEvolution(value: unknown): HoidCharacterEvolutionIntent | null {
  const record = exactRecord(value, ["status", "characterName", "dimension"], ["status"]);
  if (!record) return null;
  if (record.status === "ready") {
    const hasDimension = Object.prototype.hasOwnProperty.call(record, "dimension");
    return (exactKeyCount(record, hasDimension ? 3 : 2) &&
      validName(record.characterName) &&
      (!hasDimension || (
        typeof record.dimension === "string" &&
        EVOLUTION_DIMENSIONS.has(record.dimension)
      )))
      ? value as HoidCharacterEvolutionIntent
      : null;
  }
  return exactKeyCount(record, 1) &&
    (record.status === "not-evolution" || record.status === "needs-name" || record.status === "invalid")
    ? value as HoidCharacterEvolutionIntent
    : null;
}

function canonicalInput(value: unknown): HoidConversationRoutePlanInput | null {
  const record = exactRecord(value, INPUT_KEYS, INPUT_KEYS);
  if (
    !record ||
    (record.answerScopeStatus !== "ready" &&
      record.answerScopeStatus !== "selection-required" &&
      record.answerScopeStatus !== "unavailable") ||
    typeof record.trustedConversationAvailable !== "boolean"
  ) return null;

  const intentPlan = canonicalIntent(record.intentPlan);
  const dossierIntent = canonicalDossier(record.dossierIntent);
  const relationshipIntent = canonicalRelationship(record.relationshipIntent);
  const timelineIntent = canonicalTimeline(record.timelineIntent);
  const magicSystemIntent = canonicalMagic(record.magicSystemIntent);
  const characterEvolutionIntent = canonicalEvolution(record.characterEvolutionIntent);
  if (
    !intentPlan ||
    !dossierIntent ||
    !relationshipIntent ||
    !timelineIntent ||
    !magicSystemIntent ||
    !characterEvolutionIntent
  ) return null;

  return Object.freeze({
    intentPlan,
    dossierIntent,
    relationshipIntent,
    timelineIntent,
    magicSystemIntent,
    characterEvolutionIntent,
    answerScopeStatus: record.answerScopeStatus,
    trustedConversationAvailable: record.trustedConversationAvailable,
  });
}

function ready(route: HoidConversationRoute): HoidConversationRoutePlanResult {
  return Object.freeze({ status: "ready", route });
}

/**
 * Centralizes the precedence used by HoidScreen before any narrative adapter or
 * provider can run. Specialized malformed/incomplete intents are terminal:
 * they never fall through to a broader route. Scope gating remains ahead of
 * narrative entity routes, while progress and catalogue navigation retain
 * their explicit metadata-only behavior.
 */
export function resolveHoidConversationRoutePlan(
  input: unknown,
): HoidConversationRoutePlanResult {
  const request = canonicalInput(input);
  if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-input" });

  const intentReady = request.intentPlan.status === "ready";
  const intentMode = intentReady ? request.intentPlan.mode : null;

  // Preserve the screen's original fail-closed handling for an invalid
  // general question when neither specialized magic/evolution parser matched.
  if (
    !intentReady &&
    request.magicSystemIntent.status === "not-magic" &&
    request.characterEvolutionIntent.status === "not-evolution"
  ) return ready("invalid-request");

  if (request.dossierIntent.status === "invalid") return ready("dossier-invalid");
  if (request.dossierIntent.status === "needs-name") return ready("dossier-needs-name");
  if (request.relationshipIntent.status === "invalid") return ready("relationship-invalid");
  if (request.relationshipIntent.status === "needs-names") return ready("relationship-needs-names");
  if (request.timelineIntent.status === "invalid") return ready("timeline-invalid");
  if (request.timelineIntent.status === "needs-name") return ready("timeline-needs-name");

  if (
    intentMode === "relationship-explanation" &&
    request.relationshipIntent.status === "not-relationship"
  ) return ready("relationship-intent-mismatch");

  if (intentMode === "reread-request") return ready("reread-request");
  if (intentMode === "curated-discovery") return ready("curated-discovery");
  if (intentMode === "reading-progress") return ready("reading-progress");
  if (intentMode === "catalogue-recommendation") return ready("catalogue-recommendation");

  if (request.answerScopeStatus === "selection-required") return ready("scope-selection-required");
  if (request.answerScopeStatus === "unavailable") return ready("scope-unavailable");

  if (request.relationshipIntent.status === "ready") return ready("relationship");
  if (request.timelineIntent.status === "ready") return ready("timeline");

  if (
    request.characterEvolutionIntent.status === "ready" ||
    request.characterEvolutionIntent.status === "needs-name" ||
    request.characterEvolutionIntent.status === "invalid"
  ) return ready("character-evolution");

  if (
    request.magicSystemIntent.status === "ready" ||
    request.magicSystemIntent.status === "needs-name" ||
    request.magicSystemIntent.status === "invalid"
  ) return ready("magic-system");

  if (request.dossierIntent.status === "ready") return ready("dossier");
  if (!intentReady) return ready("invalid-intent");
  if (!request.trustedConversationAvailable) return ready("trusted-host-unavailable");
  return ready("conversation");
}
