import {
  canonicalizeHoidAnswerBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import type { HoidConversationIntentResult } from "./conversationIntent";
import type { HoidEntityDossierIntent } from "./entityDossierIntent";
import type { HoidEntityRelationshipIntent } from "./entityRelationshipIntent";
import type { HoidEntityProgressTimelineIntent } from "./entityProgressTimelineIntent";
import type { HoidMagicSystemExplanationIntent } from "./magicSystemExplanationIntent";
import type { HoidCharacterEvolutionIntent } from "./entityEvolutionExplanationIntent";
import {
  resolveHoidConversationRoutePlan,
  type HoidConversationRoute,
} from "./conversationRoutePlan";
import type { HoidReadingFocusConversationScopeResolution } from "./readingFocusConversationScope";

type UnavailableReadingScope = Extract<HoidReadingFocusConversationScopeResolution, { status: "unavailable" }>;
type RequiredReadingSelection = Extract<HoidReadingFocusConversationScopeResolution, { status: "selection-required" }>;
type RoutedCharacterEvolutionIntent = Exclude<HoidCharacterEvolutionIntent, { status: "not-evolution" }>;
type RoutedMagicSystemIntent = Exclude<HoidMagicSystemExplanationIntent, { status: "not-magic" }>;
type DataFreeRoute = Exclude<
  HoidConversationRoute,
  | "scope-unavailable"
  | "scope-selection-required"
  | "relationship"
  | "timeline"
  | "character-evolution"
  | "magic-system"
  | "dossier"
  | "conversation"
>;

export type HoidConversationRouteExecutionInput = Readonly<{
  intentPlan: HoidConversationIntentResult;
  dossierIntent: HoidEntityDossierIntent;
  relationshipIntent: HoidEntityRelationshipIntent;
  timelineIntent: HoidEntityProgressTimelineIntent;
  magicSystemIntent: HoidMagicSystemExplanationIntent;
  characterEvolutionIntent: HoidCharacterEvolutionIntent;
  answerScope: HoidReadingFocusConversationScopeResolution;
  trustedConversationAvailable: boolean;
}>;

export type HoidConversationRouteExecutionResult =
  | Readonly<{ status: "unavailable"; reason: "invalid-input" | "route-plan-unavailable" | "inconsistent-route-input" }>
  | Readonly<{ status: "ready"; route: "scope-unavailable"; resolution: UnavailableReadingScope }>
  | Readonly<{ status: "ready"; route: "scope-selection-required"; resolution: RequiredReadingSelection }>
  | Readonly<{ status: "ready"; route: "relationship"; intent: Extract<HoidEntityRelationshipIntent, { status: "ready" }>; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "ready"; route: "timeline"; intent: Extract<HoidEntityProgressTimelineIntent, { status: "ready" }>; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "ready"; route: "character-evolution"; intent: RoutedCharacterEvolutionIntent; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "ready"; route: "magic-system"; intent: RoutedMagicSystemIntent; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "ready"; route: "dossier"; intent: Extract<HoidEntityDossierIntent, { status: "ready" }>; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "ready"; route: "conversation"; intent: Extract<HoidConversationIntentResult, { status: "ready" }>; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "ready"; route: DataFreeRoute }>;

const INPUT_KEYS = [
  "intentPlan",
  "dossierIntent",
  "relationshipIntent",
  "timelineIntent",
  "magicSystemIntent",
  "characterEvolutionIntent",
  "answerScope",
  "trustedConversationAvailable",
] as const;
const SCOPE_KEYS = ["status", "scope", "focus", "source", "reason", "choices"] as const;
const SCOPE_FAILURE_REASONS = new Set([
  "invalid-request",
  "invalid-progress",
  "no-active-work",
  "selected-work-not-active",
  "chapter-structure-unavailable",
  "invalid-scope",
]);

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch {
    return null;
  }
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Reflect.ownKeys(record).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(record, key));
}

type CanonicalScopeBinding =
  | Readonly<{ status: "ready"; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "unavailable"; resolution: UnavailableReadingScope }>
  | Readonly<{ status: "selection-required"; resolution: RequiredReadingSelection }>;

function canonicalScopeBinding(value: unknown): CanonicalScopeBinding | null {
  const record = exactDataRecord(value, SCOPE_KEYS, ["status"]);
  if (!record) return null;

  if (record.status === "ready") {
    if (
      !exactKeys(record, ["status", "scope", "focus", "source"]) ||
      (record.source !== "automatic-focus" &&
        record.source !== "explicit-single-work" &&
        record.source !== "explicit-cross-work") ||
      (record.focus !== null && (typeof record.focus !== "object" || Array.isArray(record.focus)))
    ) return null;
    const scope = canonicalizeHoidAnswerBookScope(record.scope);
    return scope ? Object.freeze({ status: "ready" as const, scope }) : null;
  }

  if (record.status === "unavailable") {
    if (
      !exactKeys(record, ["status", "reason"]) ||
      typeof record.reason !== "string" ||
      !SCOPE_FAILURE_REASONS.has(record.reason)
    ) return null;
    return Object.freeze({
      status: "unavailable" as const,
      resolution: Object.freeze({ status: "unavailable" as const, reason: record.reason }) as UnavailableReadingScope,
    });
  }

  if (record.status === "selection-required") {
    if (
      !exactKeys(record, ["status", "reason", "choices"]) ||
      record.reason !== "multiple-active-works" ||
      !Array.isArray(record.choices) ||
      Object.getPrototypeOf(record.choices) !== Array.prototype
    ) return null;
    return Object.freeze({
      status: "selection-required" as const,
      resolution: value as RequiredReadingSelection,
    });
  }

  return null;
}

function unavailable(
  reason: Extract<HoidConversationRouteExecutionResult, { status: "unavailable" }>["reason"],
): HoidConversationRouteExecutionResult {
  return Object.freeze({ status: "unavailable" as const, reason });
}

/**
 * Bind a deterministic route plan to the exact discriminated inputs required by
 * its handler. Narrative routes carry a canonical reading scope and a narrowed
 * classifier result; metadata routes carry neither. This function never calls
 * a provider, handler, storage adapter or EPUB port.
 */
export function resolveHoidConversationRouteExecution(
  input: unknown,
): HoidConversationRouteExecutionResult {
  const record = exactDataRecord(input, INPUT_KEYS, INPUT_KEYS);
  if (!record || typeof record.trustedConversationAvailable !== "boolean") return unavailable("invalid-input");

  const scopeBinding = canonicalScopeBinding(record.answerScope);
  if (!scopeBinding) return unavailable("invalid-input");

  const request = record as unknown as HoidConversationRouteExecutionInput;
  const plan = resolveHoidConversationRoutePlan({
    intentPlan: request.intentPlan,
    dossierIntent: request.dossierIntent,
    relationshipIntent: request.relationshipIntent,
    timelineIntent: request.timelineIntent,
    magicSystemIntent: request.magicSystemIntent,
    characterEvolutionIntent: request.characterEvolutionIntent,
    answerScopeStatus: scopeBinding.status,
    trustedConversationAvailable: request.trustedConversationAvailable,
  });
  if (plan.status !== "ready") return unavailable("route-plan-unavailable");

  switch (plan.route) {
    case "scope-unavailable":
      return scopeBinding.status === "unavailable"
        ? Object.freeze({ status: "ready" as const, route: plan.route, resolution: scopeBinding.resolution })
        : unavailable("inconsistent-route-input");

    case "scope-selection-required":
      return scopeBinding.status === "selection-required"
        ? Object.freeze({ status: "ready" as const, route: plan.route, resolution: scopeBinding.resolution })
        : unavailable("inconsistent-route-input");

    case "relationship":
      return scopeBinding.status === "ready" && request.relationshipIntent.status === "ready"
        ? Object.freeze({ status: "ready" as const, route: plan.route, intent: request.relationshipIntent, scope: scopeBinding.scope })
        : unavailable("inconsistent-route-input");

    case "timeline":
      return scopeBinding.status === "ready" && request.timelineIntent.status === "ready"
        ? Object.freeze({ status: "ready" as const, route: plan.route, intent: request.timelineIntent, scope: scopeBinding.scope })
        : unavailable("inconsistent-route-input");

    case "character-evolution":
      return scopeBinding.status === "ready" && request.characterEvolutionIntent.status !== "not-evolution"
        ? Object.freeze({ status: "ready" as const, route: plan.route, intent: request.characterEvolutionIntent, scope: scopeBinding.scope })
        : unavailable("inconsistent-route-input");

    case "magic-system":
      return scopeBinding.status === "ready" && request.magicSystemIntent.status !== "not-magic"
        ? Object.freeze({ status: "ready" as const, route: plan.route, intent: request.magicSystemIntent, scope: scopeBinding.scope })
        : unavailable("inconsistent-route-input");

    case "dossier":
      return scopeBinding.status === "ready" && request.dossierIntent.status === "ready"
        ? Object.freeze({ status: "ready" as const, route: plan.route, intent: request.dossierIntent, scope: scopeBinding.scope })
        : unavailable("inconsistent-route-input");

    case "conversation":
      return scopeBinding.status === "ready" &&
        request.intentPlan.status === "ready" &&
        request.trustedConversationAvailable
        ? Object.freeze({ status: "ready" as const, route: plan.route, intent: request.intentPlan, scope: scopeBinding.scope })
        : unavailable("inconsistent-route-input");

    default:
      return Object.freeze({ status: "ready" as const, route: plan.route });
  }
}
