import {
  createHoidTrustedCursorConversationComposition,
  type HoidTrustedCursorConversationCompositionResult,
} from "./trustedConversationComposition";
import {
  createHoidTrustedConversationScreenPort,
  type HoidTrustedConversationScreenPort,
} from "./trustedConversationScreenPort";
import type { HoidCursorProgressInvalidationSource } from "./cursorBackedUnitProgressStore";
import type { HoidCursorProgressStore } from "./cursorSqliteProgressStore";

export type HoidTrustedApplicationBootstrapSnapshot =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; screenPort: HoidTrustedConversationScreenPort }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-dependencies"
        | "progress-unavailable"
        | "composition-unavailable"
        | "screen-port-unavailable"
        | "bootstrap-failed";
    }>
  | Readonly<{ status: "disposed" }>;

export type HoidTrustedApplicationDependencies = Readonly<{
  compositionConfig: unknown;
  cursorStore: HoidCursorProgressStore;
  invalidationSource: HoidCursorProgressInvalidationSource;
  sessionId: string;
}>;

export type HoidTrustedApplicationDependencyLoader = (
  signal: AbortSignal,
) => Promise<unknown>;

export type HoidTrustedApplicationBootstrap = Readonly<{
  getSnapshot(): HoidTrustedApplicationBootstrapSnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<HoidTrustedApplicationBootstrapSnapshot>;
  dispose(): void;
}>;

const DEPENDENCY_KEYS = [
  "compositionConfig",
  "cursorStore",
  "invalidationSource",
  "sessionId",
] as const;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;

function exactDependencies(value: unknown): HoidTrustedApplicationDependencies | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== DEPENDENCY_KEYS.length ||
      keys.some(key => typeof key !== "string" || !DEPENDENCY_KEYS.includes(key as typeof DEPENDENCY_KEYS[number]))
    ) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of DEPENDENCY_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }

    const compositionConfig = record.compositionConfig;
    const cursorStore = record.cursorStore;
    const invalidationSource = record.invalidationSource;
    const sessionId = record.sessionId;
    if (
      compositionConfig === null ||
      typeof compositionConfig !== "object" ||
      Array.isArray(compositionConfig) ||
      cursorStore === null ||
      typeof cursorStore !== "object" ||
      invalidationSource === null ||
      typeof invalidationSource !== "object" ||
      typeof sessionId !== "string" ||
      !SESSION_ID_PATTERN.test(sessionId)
    ) return null;

    return Object.freeze({
      compositionConfig,
      cursorStore: cursorStore as HoidCursorProgressStore,
      invalidationSource: invalidationSource as HoidCursorProgressInvalidationSource,
      sessionId,
    });
  } catch {
    return null;
  }
}

/**
 * App-level lifecycle boundary for the trusted exact-unit conversation port.
 *
 * Platform code supplies native trust, durable anti-rollback, signed editorial
 * sources, provider transport and the existing cursor-v2 store. This module
 * does not manufacture keys or storage guarantees. The signed host continues
 * to revalidate trust and progress on every turn.
 */
export function createHoidTrustedApplicationBootstrap(
  loadDependencies: HoidTrustedApplicationDependencyLoader,
  now?: () => string,
): HoidTrustedApplicationBootstrap | null {
  if (typeof loadDependencies !== "function" || (now !== undefined && typeof now !== "function")) {
    return null;
  }

  type State = {
    snapshot: HoidTrustedApplicationBootstrapSnapshot;
    listeners: Set<() => void>;
    initialization: Promise<HoidTrustedApplicationBootstrapSnapshot> | null;
    controller: AbortController | null;
    screenPort: HoidTrustedConversationScreenPort | null;
    disposeComposition: (() => void) | null;
    disposed: boolean;
  };

  const state: State = {
    snapshot: Object.freeze({ status: "idle" }),
    listeners: new Set(),
    initialization: null,
    controller: null,
    screenPort: null,
    disposeComposition: null,
    disposed: false,
  };

  const publish = (
    snapshot: HoidTrustedApplicationBootstrapSnapshot,
  ): HoidTrustedApplicationBootstrapSnapshot => {
    state.snapshot = snapshot;
    for (const listener of [...state.listeners]) {
      try {
        listener();
      } catch {
        // Observers cannot interrupt bootstrap or change its trust decision.
      }
    }
    return state.snapshot;
  };

  const blocked = (
    reason: Extract<HoidTrustedApplicationBootstrapSnapshot, { status: "blocked" }>["reason"],
  ) => publish(Object.freeze({ status: "blocked", reason }));

  const run = async (
    controller: AbortController,
  ): Promise<HoidTrustedApplicationBootstrapSnapshot> => {
    let ownedComposition: Extract<
      HoidTrustedCursorConversationCompositionResult,
      { status: "composed" }
    > | null = null;

    try {
      if (state.disposed || controller.signal.aborted) return state.snapshot;
      const rawDependencies = await loadDependencies(controller.signal);
      if (state.disposed || controller.signal.aborted) return state.snapshot;

      const dependencies = exactDependencies(rawDependencies);
      if (!dependencies) return blocked("invalid-dependencies");

      const result = await createHoidTrustedCursorConversationComposition(
        dependencies.compositionConfig,
        dependencies.cursorStore,
        dependencies.invalidationSource,
        now,
      );

      if (state.disposed || controller.signal.aborted) {
        if (result.status === "composed") result.dispose();
        return state.snapshot;
      }

      if (result.status !== "composed") {
        return result.reason === "progress-unavailable"
          ? blocked("progress-unavailable")
          : blocked("composition-unavailable");
      }

      ownedComposition = result;
      const screenPort = createHoidTrustedConversationScreenPort(
        result.composition,
        dependencies.sessionId,
      );
      if (!screenPort) {
        result.dispose();
        ownedComposition = null;
        return blocked("screen-port-unavailable");
      }

      if (state.disposed || controller.signal.aborted) {
        screenPort.dispose();
        result.dispose();
        ownedComposition = null;
        return state.snapshot;
      }

      state.screenPort = screenPort;
      state.disposeComposition = result.dispose;
      ownedComposition = null;
      return publish(Object.freeze({ status: "ready", screenPort }));
    } catch {
      ownedComposition?.dispose();
      if (state.disposed) return state.snapshot;
      return blocked("bootstrap-failed");
    } finally {
      if (state.controller === controller) state.controller = null;
    }
  };

  const api: HoidTrustedApplicationBootstrap = {
    getSnapshot(): HoidTrustedApplicationBootstrapSnapshot {
      return state.snapshot;
    },

    subscribe(listener: () => void): () => void {
      if (typeof listener !== "function" || state.disposed) return () => {};
      state.listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        state.listeners.delete(listener);
      };
    },

    initialize(): Promise<HoidTrustedApplicationBootstrapSnapshot> {
      if (state.disposed) return Promise.resolve(state.snapshot);
      if (state.initialization) return state.initialization;

      let controller: AbortController;
      try {
        controller = new AbortController();
      } catch {
        return Promise.resolve(blocked("bootstrap-failed"));
      }

      state.controller = controller;
      // Store the promise before notifying observers: a re-entrant initialize()
      // from a listener must join this attempt instead of starting another one.
      const pending = Promise.resolve().then(() => run(controller));
      state.initialization = pending;
      publish(Object.freeze({ status: "loading" }));
      return pending;
    },

    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;
      state.controller?.abort();
      state.controller = null;

      try {
        state.screenPort?.dispose();
      } catch {
        // Cleanup continues; the composition owns the final session sweep.
      }
      state.screenPort = null;

      try {
        state.disposeComposition?.();
      } catch {
        // The public state remains disposed even if a native adapter misbehaves.
      }
      state.disposeComposition = null;
      publish(Object.freeze({ status: "disposed" }));
      state.listeners.clear();
    },
  };

  return Object.freeze(api);
}
