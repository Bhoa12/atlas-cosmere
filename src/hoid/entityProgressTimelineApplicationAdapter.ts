import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationOptions,
  type HoidConversationApplicationPorts,
  type HoidConversationApplicationResult,
} from "./conversationApplicationService";
import type {
  HoidEntityProgressTimelineAdapter,
  HoidEntityProgressTimelineResult,
} from "./entityProgressTimeline";
import { classifyHoidEntityProgressTimelineIntent } from "./entityProgressTimelineIntent";
import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionInput,
} from "./conversationRouteExecution";

export type HoidEntityProgressTimelineApplicationDispatch = Readonly<{
  adapter: HoidEntityProgressTimelineAdapter;
  question: string;
  entityName: string;
  progress: unknown;
  isCurrent: () => boolean;
}>;

export type HoidEntityProgressTimelineApplicationPorts = Readonly<{
  readProgress: HoidConversationApplicationPorts<HoidEntityProgressTimelineResult>["readProgress"];
  getCurrentDispatch: () => HoidEntityProgressTimelineApplicationDispatch | null;
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
): HoidEntityProgressTimelineApplicationDispatch | null {
  const record = exactDataRecord(value, [
    "adapter",
    "question",
    "entityName",
    "progress",
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
  const entityName = record.entityName;
  const progress = record.progress;
  const isCurrent = record.isCurrent;
  if (
    !validText(question, 4_000) ||
    !validText(entityName, 256) ||
    progress === null ||
    typeof progress !== "object" ||
    Array.isArray(progress) ||
    typeof isCurrent !== "function"
  ) return null;

  const parsedIntent = classifyHoidEntityProgressTimelineIntent(question);
  if (parsedIntent.status !== "ready" || parsedIntent.entityName !== entityName) return null;

  return Object.freeze({
    adapter: adapter as unknown as HoidEntityProgressTimelineAdapter,
    question,
    entityName,
    progress,
    isCurrent: isCurrent as () => boolean,
  });
}

function unavailable(
  reason: Extract<
    HoidEntityProgressTimelineResult,
    { status: "unavailable" }
  >["reason"],
): HoidEntityProgressTimelineResult {
  return Object.freeze({ status: "unavailable", reason });
}

type ApplicationFailureReason = Extract<
  HoidConversationApplicationResult<unknown>,
  { status: "unavailable" }
>["reason"];

function mapApplicationFailure(
  reason: ApplicationFailureReason,
): HoidEntityProgressTimelineResult {
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
 * Moves the existing evidence-bound timeline adapter behind the
 * provider-neutral conversation application service. The timeline adapter
 * remains authoritative for exact entity resolution, approved evidence,
 * source/unlock chapters, reading-order semantics, citations, scope and
 * progress freshness. This layer never infers in-world chronology.
 */
export function createHoidEntityProgressTimelineApplicationAdapter(portsInput: unknown) {
  const ports = exactDataRecord(portsInput, ["readProgress", "getCurrentDispatch"]);
  if (
    !ports ||
    typeof ports.readProgress !== "function" ||
    typeof ports.getCurrentDispatch !== "function"
  ) throw new TypeError("Invalid Hoid entity progress timeline application ports");

  const application = createHoidConversationApplicationService<HoidEntityProgressTimelineResult>({
    readProgress: ports.readProgress as HoidEntityProgressTimelineApplicationPorts["readProgress"],
    executeRoute: async (execution, _context, signal) => {
      if (execution.route !== "timeline") {
        throw new Error("Entity progress timeline application adapter received a non-timeline route");
      }
      if (signal?.aborted) throw new Error("Entity progress timeline dispatch was cancelled");

      const dispatch = canonicalDispatch(
        (ports.getCurrentDispatch as HoidEntityProgressTimelineApplicationPorts["getCurrentDispatch"])(),
      );
      if (!dispatch || dispatch.entityName !== execution.intent.entityName) {
        throw new Error("No matching entity progress timeline dispatch is available");
      }

      let current = false;
      try {
        current = dispatch.isCurrent() === true;
      } catch {
        current = false;
      }
      if (!current) throw new Error("Entity progress timeline dispatch is no longer current");

      const result = await dispatch.adapter.answer({
        question: dispatch.question,
        progress: dispatch.progress,
        bookScope: execution.scope,
      }, signal ? { signal } : undefined);

      // A route already resolved as a named timeline must not degrade into an
      // incomplete or unrelated intent after crossing the adapter boundary.
      if (result.status === "not-timeline" || result.status === "needs-name") {
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
    ): Promise<HoidEntityProgressTimelineResult> {
      const route = resolveHoidConversationRouteExecution(routeInput);
      if (route.status !== "ready" || route.route !== "timeline") {
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
