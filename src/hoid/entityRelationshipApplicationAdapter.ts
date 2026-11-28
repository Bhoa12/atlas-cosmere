import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationOptions,
  type HoidConversationApplicationPorts,
  type HoidConversationApplicationResult,
} from "./conversationApplicationService";
import type {
  HoidEntityRelationshipConversationAdapter,
  HoidEntityRelationshipConversationResult,
} from "./entityRelationshipConversation";
import { classifyHoidEntityRelationshipIntent } from "./entityRelationshipIntent";
import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionInput,
} from "./conversationRouteExecution";
import {
  isHoidExplanationDepth,
  type HoidExplanationDepth,
} from "./explanationDepth";

export type HoidEntityRelationshipApplicationDispatch = Readonly<{
  adapter: HoidEntityRelationshipConversationAdapter;
  question: string;
  leftEntityName: string;
  rightEntityName: string;
  progress: unknown;
  depth: HoidExplanationDepth;
  isCurrent: () => boolean;
}>;

export type HoidEntityRelationshipApplicationPorts = Readonly<{
  readProgress: HoidConversationApplicationPorts<HoidEntityRelationshipConversationResult>["readProgress"];
  getCurrentDispatch: () => HoidEntityRelationshipApplicationDispatch | null;
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

function canonicalDispatch(value: unknown): HoidEntityRelationshipApplicationDispatch | null {
  const record = exactDataRecord(value, [
    "adapter",
    "question",
    "leftEntityName",
    "rightEntityName",
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
  const leftEntityName = record.leftEntityName;
  const rightEntityName = record.rightEntityName;
  const progress = record.progress;
  const depth = record.depth;
  const isCurrent = record.isCurrent;
  if (
    !validText(question, 4_000) ||
    !validText(leftEntityName, 256) ||
    !validText(rightEntityName, 256) ||
    leftEntityName.normalize("NFKC").toLowerCase() ===
      rightEntityName.normalize("NFKC").toLowerCase() ||
    progress === null ||
    typeof progress !== "object" ||
    Array.isArray(progress) ||
    !isHoidExplanationDepth(depth) ||
    typeof isCurrent !== "function"
  ) return null;

  const parsedIntent = classifyHoidEntityRelationshipIntent(question);
  if (
    parsedIntent.status !== "ready" ||
    parsedIntent.leftEntityName !== leftEntityName ||
    parsedIntent.rightEntityName !== rightEntityName
  ) return null;

  return Object.freeze({
    adapter: adapter as unknown as HoidEntityRelationshipConversationAdapter,
    question,
    leftEntityName,
    rightEntityName,
    progress,
    depth,
    isCurrent: isCurrent as () => boolean,
  });
}

function unavailable(
  reason: Extract<
    HoidEntityRelationshipConversationResult,
    { status: "unavailable" }
  >["reason"],
): HoidEntityRelationshipConversationResult {
  return Object.freeze({ status: "unavailable", reason });
}

type ApplicationFailureReason = Extract<
  HoidConversationApplicationResult<unknown>,
  { status: "unavailable" }
>["reason"];

function mapApplicationFailure(
  reason: ApplicationFailureReason,
): HoidEntityRelationshipConversationResult {
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
      return unavailable("invalid-request");
    default:
      return unavailable("invalid-request");
  }
}

/**
 * Moves the existing evidence-bound relationship adapter behind the
 * provider-neutral application service. The relationship adapter remains the
 * authority for exact entity resolution, shared approved claims, citations,
 * cross-work scope, explanation budgets and spoiler checks.
 */
export function createHoidEntityRelationshipApplicationAdapter(portsInput: unknown) {
  const ports = exactDataRecord(portsInput, ["readProgress", "getCurrentDispatch"]);
  if (
    !ports ||
    typeof ports.readProgress !== "function" ||
    typeof ports.getCurrentDispatch !== "function"
  ) throw new TypeError("Invalid Hoid entity relationship application ports");

  const application = createHoidConversationApplicationService<HoidEntityRelationshipConversationResult>({
    readProgress: ports.readProgress as HoidEntityRelationshipApplicationPorts["readProgress"],
    executeRoute: async (execution, _context, signal) => {
      if (execution.route !== "relationship") {
        throw new Error("Entity relationship application adapter received a non-relationship route");
      }
      if (signal?.aborted) throw new Error("Entity relationship dispatch was cancelled");

      const dispatch = canonicalDispatch(
        (ports.getCurrentDispatch as HoidEntityRelationshipApplicationPorts["getCurrentDispatch"])(),
      );
      if (
        !dispatch ||
        dispatch.leftEntityName !== execution.intent.leftEntityName ||
        dispatch.rightEntityName !== execution.intent.rightEntityName
      ) throw new Error("No matching entity relationship dispatch is available");

      let current = false;
      try {
        current = dispatch.isCurrent() === true;
      } catch {
        current = false;
      }
      if (!current) throw new Error("Entity relationship dispatch is no longer current");

      const result = await dispatch.adapter.answer({
        question: dispatch.question,
        progress: dispatch.progress,
        bookScope: execution.scope,
        depth: dispatch.depth,
      }, signal ? { signal } : undefined);

      // A route already resolved as a two-entity relationship must not
      // silently degrade into a different intent or incomplete request.
      if (result.status === "not-relationship" || result.status === "needs-names") {
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
    ): Promise<HoidEntityRelationshipConversationResult> {
      const route = resolveHoidConversationRouteExecution(routeInput);
      if (route.status !== "ready" || route.route !== "relationship") {
        return unavailable("invalid-request");
      }
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
