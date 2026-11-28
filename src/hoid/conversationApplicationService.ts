import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionResult,
} from "./conversationRouteExecution";
import { awaitHoidOperationWithSignal } from "./abortableOperation";

export type HoidConversationApplicationProgress = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export type HoidReadyConversationRouteExecution = Exclude<
  HoidConversationRouteExecutionResult,
  { status: "unavailable" }
>;

export type HoidConversationApplicationContext = Readonly<{
  schemaVersion: 1;
  turnSequence: number;
  route: HoidReadyConversationRouteExecution["route"];
  progress: HoidConversationApplicationProgress;
}>;

export type HoidConversationApplicationResult =
  | Readonly<{
      status: "completed";
      context: HoidConversationApplicationContext;
      value: unknown;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-progress"
        | "progress-unavailable"
        | "stale-before-execution"
        | "route-unavailable"
        | "handler-failed"
        | "stale-after-execution"
        | "superseded"
        | "cancelled";
    }>;

export type HoidConversationApplicationOptions = Readonly<{
  signal?: AbortSignal;
  /** Optional UI/session capability. A false result makes late work inert. */
  isCurrent?: () => boolean;
}>;

export type HoidConversationApplicationPorts = Readonly<{
  /** Returns only the current durable progress identity, never narrative data. */
  readProgress: (signal?: AbortSignal) => unknown | PromiseLike<unknown>;
  /** Dispatches the typed route to its existing local/trusted gateway. */
  executeRoute: (
    execution: HoidReadyConversationRouteExecution,
    context: HoidConversationApplicationContext,
    signal?: AbortSignal,
  ) => unknown | PromiseLike<unknown>;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function canonicalProgress(value: unknown): HoidConversationApplicationProgress | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 2 ||
      !keys.includes("revision") ||
      !keys.includes("fingerprint")
    ) return null;

    const revision = Object.getOwnPropertyDescriptor(value, "revision");
    const fingerprint = Object.getOwnPropertyDescriptor(value, "fingerprint");
    if (
      !revision ||
      !fingerprint ||
      !Object.prototype.hasOwnProperty.call(revision, "value") ||
      !Object.prototype.hasOwnProperty.call(fingerprint, "value") ||
      revision.enumerable !== true ||
      fingerprint.enumerable !== true ||
      typeof revision.value !== "number" ||
      !Number.isSafeInteger(revision.value) ||
      revision.value < 0 ||
      typeof fingerprint.value !== "string" ||
      !SHA256_PATTERN.test(fingerprint.value)
    ) return null;

    return Object.freeze({
      revision: revision.value,
      fingerprint: fingerprint.value,
    });
  } catch {
    return null;
  }
}

function sameProgress(
  left: HoidConversationApplicationProgress,
  right: HoidConversationApplicationProgress,
): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function unavailable(
  reason: Extract<HoidConversationApplicationResult, { status: "unavailable" }>["reason"],
): HoidConversationApplicationResult {
  return Object.freeze({ status: "unavailable" as const, reason });
}

/**
 * Provider-neutral application boundary for one Hoid conversation turn.
 *
 * It binds the deterministic route to a fresh progress identity, dispatches
 * the already-typed route, then re-reads progress before releasing the value.
 * The service never persists data, reads EPUB content, authorizes claims or
 * projects provider output for display. Those remain gateway/presenter duties.
 */
export function createHoidConversationApplicationService(
  ports: HoidConversationApplicationPorts,
) {
  if (
    ports === null ||
    typeof ports !== "object" ||
    typeof ports.readProgress !== "function" ||
    typeof ports.executeRoute !== "function"
  ) throw new TypeError("Invalid Hoid conversation application ports");

  let latestSequence = 0;

  const isLive = (
    sequence: number,
    options: HoidConversationApplicationOptions,
  ): "live" | "cancelled" | "superseded" => {
    if (options.signal?.aborted) return "cancelled";
    if (sequence !== latestSequence) return "superseded";
    if (options.isCurrent) {
      try {
        if (options.isCurrent() !== true) return "superseded";
      } catch {
        return "superseded";
      }
    }
    return "live";
  };

  const nextSequence = (): number => {
    latestSequence = latestSequence >= Number.MAX_SAFE_INTEGER ? 1 : latestSequence + 1;
    return latestSequence;
  };

  const execute = async (
    routeInput: unknown,
    expectedProgressInput: unknown,
    options: HoidConversationApplicationOptions = {},
  ): Promise<HoidConversationApplicationResult> => {
    const sequence = nextSequence();
    const expectedProgress = canonicalProgress(expectedProgressInput);
    if (!expectedProgress) return unavailable("invalid-progress");

    let live = isLive(sequence, options);
    if (live !== "live") return unavailable(live);

    let initialRaw: unknown;
    try {
      initialRaw = await awaitHoidOperationWithSignal(
        () => ports.readProgress(options.signal),
        options.signal,
      );
    } catch {
      live = isLive(sequence, options);
      return unavailable(live === "live" ? "progress-unavailable" : live);
    }

    live = isLive(sequence, options);
    if (live !== "live") return unavailable(live);

    const initialProgress = canonicalProgress(initialRaw);
    if (!initialProgress) return unavailable("invalid-progress");
    if (!sameProgress(expectedProgress, initialProgress)) {
      return unavailable("stale-before-execution");
    }

    let execution: HoidConversationRouteExecutionResult;
    try {
      execution = resolveHoidConversationRouteExecution(routeInput);
    } catch {
      return unavailable("route-unavailable");
    }
    if (!("route" in execution)) return unavailable("route-unavailable");

    const context: HoidConversationApplicationContext = Object.freeze({
      schemaVersion: 1,
      turnSequence: sequence,
      route: execution.route,
      progress: initialProgress,
    });

    let value: unknown;
    try {
      value = await awaitHoidOperationWithSignal(
        () => ports.executeRoute(execution, context, options.signal),
        options.signal,
      );
    } catch {
      live = isLive(sequence, options);
      return unavailable(live === "live" ? "handler-failed" : live);
    }

    live = isLive(sequence, options);
    if (live !== "live") return unavailable(live);

    let finalRaw: unknown;
    try {
      finalRaw = await awaitHoidOperationWithSignal(
        () => ports.readProgress(options.signal),
        options.signal,
      );
    } catch {
      live = isLive(sequence, options);
      return unavailable(live === "live" ? "progress-unavailable" : live);
    }

    live = isLive(sequence, options);
    if (live !== "live") return unavailable(live);

    const finalProgress = canonicalProgress(finalRaw);
    if (!finalProgress) return unavailable("invalid-progress");
    if (!sameProgress(initialProgress, finalProgress)) {
      return unavailable("stale-after-execution");
    }

    return Object.freeze({
      status: "completed" as const,
      context,
      value,
    });
  };

  return Object.freeze({
    execute,
    /** Invalidates all in-flight turns without requiring access to their promises. */
    invalidate(): void {
      latestSequence = latestSequence >= Number.MAX_SAFE_INTEGER ? 1 : latestSequence + 1;
    },
  });
}
