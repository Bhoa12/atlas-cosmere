import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationOptions,
  type HoidConversationApplicationPorts,
} from "./conversationApplicationService";
import type {
  HoidEntityDossierConversationAdapter,
  HoidEntityDossierConversationResult,
} from "./entityDossierConversation";
import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionInput,
} from "./conversationRouteExecution";
import {
  isHoidExplanationDepth,
  type HoidExplanationDepth,
} from "./explanationDepth";

export type HoidEntityDossierApplicationDispatch = Readonly<{
  adapter: HoidEntityDossierConversationAdapter;
  question: string;
  entityName: string;
  progress: unknown;
  depth: HoidExplanationDepth;
  isCurrent: () => boolean;
}>;

export type HoidEntityDossierApplicationPorts = Readonly<{
  readProgress: HoidConversationApplicationPorts<HoidEntityDossierConversationResult>["readProgress"];
  getCurrentDispatch: () => HoidEntityDossierApplicationDispatch | null;
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

function canonicalDispatch(value: unknown): HoidEntityDossierApplicationDispatch | null {
  const record = exactDataRecord(value, [
    "adapter",
    "question",
    "entityName",
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
  const entityName = record.entityName;
  const progress = record.progress;
  const depth = record.depth;
  const isCurrent = record.isCurrent;
  if (
    !validText(question, 4_000) ||
    !validText(entityName, 256) ||
    progress === null ||
    typeof progress !== "object" ||
    Array.isArray(progress) ||
    !isHoidExplanationDepth(depth) ||
    typeof isCurrent !== "function"
  ) return null;

  return Object.freeze({
    adapter: adapter as unknown as HoidEntityDossierConversationAdapter,
    question,
    entityName,
    progress,
    depth,
    isCurrent: isCurrent as () => boolean,
  });
}

function unavailable(
  reason: Extract<HoidEntityDossierConversationResult, { status: "unavailable" }>["reason"],
): HoidEntityDossierConversationResult {
  return Object.freeze({ status: "unavailable", reason });
}

function mapApplicationFailure(reason: string): HoidEntityDossierConversationResult {
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
 * Moves the existing local dossier adapter behind the provider-neutral
 * application service. The dossier adapter remains authoritative for exact
 * entity resolution, evidence, scope, explanation budgets and spoiler checks.
 */
export function createHoidEntityDossierApplicationAdapter(portsInput: unknown) {
  const ports = exactDataRecord(portsInput, ["readProgress", "getCurrentDispatch"]);
  if (
    !ports ||
    typeof ports.readProgress !== "function" ||
    typeof ports.getCurrentDispatch !== "function"
  ) throw new TypeError("Invalid Hoid entity dossier application ports");

  const application = createHoidConversationApplicationService<HoidEntityDossierConversationResult>({
    readProgress: ports.readProgress as HoidEntityDossierApplicationPorts["readProgress"],
    executeRoute: async (execution, _context, signal) => {
      if (execution.route !== "dossier") {
        throw new Error("Entity dossier application adapter received a non-dossier route");
      }
      if (signal?.aborted) throw new Error("Entity dossier dispatch was cancelled");

      const dispatch = canonicalDispatch(
        (ports.getCurrentDispatch as HoidEntityDossierApplicationPorts["getCurrentDispatch"])(),
      );
      if (
        !dispatch ||
        dispatch.entityName !== execution.intent.entityName ||
        dispatch.isCurrent() !== true
      ) throw new Error("No current entity dossier dispatch is available");

      return dispatch.adapter.answer({
        question: dispatch.question,
        progress: dispatch.progress,
        bookScope: execution.scope,
        depth: dispatch.depth,
      }, signal ? { signal } : undefined);
    },
  });

  return Object.freeze({
    async execute(
      routeInput: HoidConversationRouteExecutionInput,
      expectedProgress: unknown,
      options: HoidConversationApplicationOptions = {},
    ): Promise<HoidEntityDossierConversationResult> {
      const route = resolveHoidConversationRouteExecution(routeInput);
      if (route.status !== "ready" || route.route !== "dossier") {
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