import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationOptions,
  type HoidConversationApplicationPorts,
  type HoidConversationApplicationResult,
} from "./conversationApplicationService";
import type {
  HoidCharacterEvolutionExplanationAdapter,
  HoidCharacterEvolutionResult,
  HoidCharacterEvolutionDimension,
} from "./entityEvolutionExplanation";
import { isHoidCharacterEvolutionDimension } from "./entityEvolutionExplanation";
import { classifyHoidCharacterEvolutionIntent } from "./entityEvolutionExplanationIntent";
import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionInput,
} from "./conversationRouteExecution";
import {
  isHoidExplanationDepth,
  type HoidExplanationDepth,
} from "./explanationDepth";

export type HoidCharacterEvolutionApplicationDispatch = Readonly<{
  adapter: HoidCharacterEvolutionExplanationAdapter;
  question: string;
  characterName: string;
  dimension: HoidCharacterEvolutionDimension | null;
  progress: unknown;
  depth: HoidExplanationDepth;
  isCurrent: () => boolean;
}>;

export type HoidCharacterEvolutionApplicationPorts = Readonly<{
  readProgress: HoidConversationApplicationPorts<HoidCharacterEvolutionResult>["readProgress"];
  getCurrentDispatch: () => HoidCharacterEvolutionApplicationDispatch | null;
}>;

function exactDataRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    if (keys.some(key => !Object.prototype.hasOwnProperty.call(record, key))) return null;
    return record;
  } catch {
    return null;
  }
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
}

function canonicalDispatch(
  value: unknown,
): HoidCharacterEvolutionApplicationDispatch | null {
  try {
    const record = exactDataRecord(value, [
      "adapter",
      "question",
      "characterName",
      "dimension",
      "progress",
      "depth",
      "isCurrent",
    ]);
    if (!record || !Object.isFrozen(value)) return null;

    const adapter = record.adapter;
    if (
      adapter === null ||
      typeof adapter !== "object" ||
      Array.isArray(adapter) ||
      Object.getPrototypeOf(adapter) !== Object.prototype ||
      !Object.isFrozen(adapter)
    ) return null;
    const adapterKeys = Reflect.ownKeys(adapter);
    const answer = Object.getOwnPropertyDescriptor(adapter, "answer");
    if (
      adapterKeys.length !== 1 ||
      adapterKeys[0] !== "answer" ||
      !answer ||
      !Object.prototype.hasOwnProperty.call(answer, "value") ||
      typeof answer.value !== "function" ||
      answer.enumerable !== true ||
      answer.writable !== false ||
      answer.configurable !== false
    ) return null;

    const question = record.question;
    const characterName = record.characterName;
    const dimension = record.dimension;
    const progress = record.progress;
    const depth = record.depth;
    const isCurrent = record.isCurrent;
    if (
      !validText(question, 4_000) ||
      !validText(characterName, 256) ||
      (dimension !== null && !isHoidCharacterEvolutionDimension(dimension)) ||
      progress === null ||
      typeof progress !== "object" ||
      Array.isArray(progress) ||
      !isHoidExplanationDepth(depth) ||
      typeof isCurrent !== "function"
    ) return null;

    const parsedIntent = classifyHoidCharacterEvolutionIntent(question);
    if (
      parsedIntent.status !== "ready" ||
      parsedIntent.characterName !== characterName ||
      (parsedIntent.dimension ?? null) !== dimension
    ) return null;

    return Object.freeze({
      adapter: adapter as unknown as HoidCharacterEvolutionExplanationAdapter,
      question,
      characterName,
      dimension,
      progress,
      depth,
      isCurrent: isCurrent as () => boolean,
    });
  } catch {
    return null;
  }
}

function unavailable(
  reason: Extract<
    HoidCharacterEvolutionResult,
    { status: "unavailable" }
  >["reason"],
): HoidCharacterEvolutionResult {
  return Object.freeze({ status: "unavailable", reason });
}

type ApplicationFailureReason = Extract<
  HoidConversationApplicationResult<unknown>,
  { status: "unavailable" }
>["reason"];

function mapApplicationFailure(
  reason: ApplicationFailureReason,
): HoidCharacterEvolutionResult {
  switch (reason) {
    case "invalid-progress":
    case "progress-unavailable":
      return unavailable("invalid-progress");
    case "stale-before-execution":
    case "stale-after-execution":
      return unavailable("progress-changed");
    case "cancelled":
    case "superseded":
      return unavailable("cancelled");
    case "handler-failed":
      return unavailable("invalid-dossier");
    case "route-unavailable":
    default:
      return unavailable("invalid-request");
  }
}

/**
 * Places the existing reviewed, evidence-bound character-evolution adapter
 * behind the provider-neutral application service. The evolution adapter
 * remains authoritative for dossier claims, review digests, book/chapter
 * unlocks, citations, explanation budgets and reading-order semantics.
 *
 * This layer never infers character changes, chronology or causality and
 * never selects a model/provider or reads EPUB content.
 */
export function createHoidCharacterEvolutionApplicationAdapter(portsInput: unknown) {
  const ports = exactDataRecord(portsInput, ["readProgress", "getCurrentDispatch"]);
  if (
    !ports ||
    typeof ports.readProgress !== "function" ||
    typeof ports.getCurrentDispatch !== "function"
  ) throw new TypeError("Invalid Hoid character evolution application ports");

  const application = createHoidConversationApplicationService<HoidCharacterEvolutionResult>({
    readProgress: ports.readProgress as HoidCharacterEvolutionApplicationPorts["readProgress"],
    executeRoute: async (execution, _context, signal) => {
      if (execution.route !== "character-evolution" || execution.intent.status !== "ready") {
        throw new Error("Character evolution application adapter received a non-ready evolution route");
      }
      if (signal?.aborted) throw new Error("Character evolution dispatch was cancelled");

      const dispatch = canonicalDispatch(
        (ports.getCurrentDispatch as HoidCharacterEvolutionApplicationPorts["getCurrentDispatch"])(),
      );
      if (
        !dispatch ||
        dispatch.characterName !== execution.intent.characterName ||
        dispatch.dimension !== (execution.intent.dimension ?? null)
      ) throw new Error("No matching character evolution dispatch is available");

      let current = false;
      try {
        current = dispatch.isCurrent() === true;
      } catch {
        current = false;
      }
      if (!current) throw new Error("Character evolution dispatch is no longer current");

      const result = await dispatch.adapter.answer({
        question: dispatch.question,
        progress: dispatch.progress,
        bookScope: execution.scope,
        depth: dispatch.depth,
      }, signal ? { signal } : undefined);

      // A recognized, named evolution route must never degrade into a generic
      // request or an incomplete intent after crossing the adapter boundary.
      if (result.status === "not-evolution" || result.status === "needs-name") {
        return unavailable("invalid-request");
      }
      return result;
    },
  });

  return Object.freeze({
    async execute(
      routeInput: HoidConversationRouteExecutionInput,
      expectedProgress: unknown,
      options: HoidConversationApplicationOptions = {},
    ): Promise<HoidCharacterEvolutionResult> {
      const route = resolveHoidConversationRouteExecution(routeInput);
      if (
        route.status !== "ready" ||
        route.route !== "character-evolution" ||
        route.intent.status !== "ready"
      ) return unavailable("invalid-request");

      const result = await application.execute(routeInput, expectedProgress, options);
      return result.status === "completed"
        ? result.value
        : mapApplicationFailure(result.reason);
    },
    invalidate(): void {
      application.invalidate();
    },
  });
}
