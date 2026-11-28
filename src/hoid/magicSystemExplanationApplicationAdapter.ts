import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationOptions,
  type HoidConversationApplicationPorts,
  type HoidConversationApplicationResult,
} from "./conversationApplicationService";
import type {
  HoidMagicSystemExplanationAdapter,
  HoidMagicSystemExplanationResult,
  HoidMagicSystemFacet,
} from "./magicSystemExplanation";
import {
  classifyHoidMagicSystemExplanationIntent,
} from "./magicSystemExplanationIntent";
import { isHoidMagicSystemFacet } from "./magicSystemExplanation";
import {
  isHoidExplanationDepth,
  type HoidExplanationDepth,
} from "./explanationDepth";
import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionInput,
} from "./conversationRouteExecution";

export type HoidMagicSystemExplanationApplicationDispatch = Readonly<{
  adapter: HoidMagicSystemExplanationAdapter;
  question: string;
  systemName: string;
  facet: HoidMagicSystemFacet | null;
  progress: unknown;
  depth: HoidExplanationDepth;
  isCurrent: () => boolean;
}>;

export type HoidMagicSystemExplanationApplicationPorts = Readonly<{
  readProgress: HoidConversationApplicationPorts<HoidMagicSystemExplanationResult>["readProgress"];
  getCurrentDispatch: () => HoidMagicSystemExplanationApplicationDispatch | null;
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
): HoidMagicSystemExplanationApplicationDispatch | null {
  try {
    const record = exactDataRecord(value, [
      "adapter",
      "question",
      "systemName",
      "facet",
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
    const systemName = record.systemName;
    const facet = record.facet;
    const progress = record.progress;
    const depth = record.depth;
    const isCurrent = record.isCurrent;
    if (
      !validText(question, 4_000) ||
      !validText(systemName, 256) ||
      (facet !== null && !isHoidMagicSystemFacet(facet)) ||
      progress === null ||
      typeof progress !== "object" ||
      Array.isArray(progress) ||
      !isHoidExplanationDepth(depth) ||
      typeof isCurrent !== "function"
    ) return null;

    const parsedIntent = classifyHoidMagicSystemExplanationIntent(question);
    if (
      parsedIntent.status !== "ready" ||
      parsedIntent.systemName !== systemName ||
      (parsedIntent.facet ?? null) !== facet
    ) return null;

    return Object.freeze({
      adapter: adapter as unknown as HoidMagicSystemExplanationAdapter,
      question,
      systemName,
      facet: facet as HoidMagicSystemFacet | null,
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
    HoidMagicSystemExplanationResult,
    { status: "unavailable" }
  >["reason"],
): HoidMagicSystemExplanationResult {
  return Object.freeze({ status: "unavailable", reason });
}

type ApplicationFailureReason = Extract<
  HoidConversationApplicationResult<unknown>,
  { status: "unavailable" }
>["reason"];

function mapApplicationFailure(
  reason: ApplicationFailureReason,
): HoidMagicSystemExplanationResult {
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
 * Places the existing reviewed, evidence-bound magic-system adapter behind
 * the provider-neutral conversation application service. The magic adapter
 * remains authoritative for exact dossier resolution, reviewed facet
 * annotations, source/unlock chapters, scope, citations and explanation
 * budgets. This layer never infers rules or reads EPUB content.
 */
export function createHoidMagicSystemExplanationApplicationAdapter(portsInput: unknown) {
  const ports = exactDataRecord(portsInput, ["readProgress", "getCurrentDispatch"]);
  if (
    !ports ||
    typeof ports.readProgress !== "function" ||
    typeof ports.getCurrentDispatch !== "function"
  ) throw new TypeError("Invalid Hoid magic-system application ports");

  const application = createHoidConversationApplicationService<HoidMagicSystemExplanationResult>({
    readProgress: ports.readProgress as HoidMagicSystemExplanationApplicationPorts["readProgress"],
    executeRoute: async (execution, _context, signal) => {
      if (execution.route !== "magic-system" || execution.intent.status !== "ready") {
        throw new Error("Magic-system application adapter received a non-ready magic route");
      }
      if (signal?.aborted) throw new Error("Magic-system dispatch was cancelled");

      const dispatch = canonicalDispatch(
        (ports.getCurrentDispatch as HoidMagicSystemExplanationApplicationPorts["getCurrentDispatch"])(),
      );
      if (
        !dispatch ||
        dispatch.systemName !== execution.intent.systemName ||
        dispatch.facet !== (execution.intent.facet ?? null)
      ) throw new Error("No matching magic-system dispatch is available");

      let current = false;
      try {
        current = dispatch.isCurrent() === true;
      } catch {
        current = false;
      }
      if (!current) throw new Error("Magic-system dispatch is no longer current");

      const result = await dispatch.adapter.answer({
        question: dispatch.question,
        progress: dispatch.progress,
        bookScope: execution.scope,
        depth: dispatch.depth,
      }, signal ? { signal } : undefined);

      // A named, routed magic request must not degrade into an unrelated or
      // incomplete intent after crossing the application boundary.
      if (result.status === "not-magic" || result.status === "needs-name") {
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
    ): Promise<HoidMagicSystemExplanationResult> {
      const route = resolveHoidConversationRouteExecution(routeInput);
      if (
        route.status !== "ready" ||
        route.route !== "magic-system" ||
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
