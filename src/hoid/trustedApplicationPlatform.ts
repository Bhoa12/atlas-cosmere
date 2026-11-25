import type { HoidCursorProgressInvalidationSource } from "./cursorBackedUnitProgressStore";
import type {
  HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import type {
  HoidTrustedApplicationDependencies,
  HoidTrustedApplicationDependencyLoader,
} from "./trustedApplicationBootstrap";

export type HoidTrustedApplicationProgressRuntime = Readonly<{
  cursorStore: HoidCursorProgressStore;
  invalidationSource: HoidCursorProgressInvalidationSource;
}>;

export type HoidTrustedApplicationPlatformPorts = Readonly<{
  /** Opens or returns the application's existing durable progress runtime. */
  loadProgressRuntime(signal: AbortSignal): Promise<unknown>;
  /** Loads native trust, signed editorial sources and the provider transport. */
  loadCompositionConfig(signal: AbortSignal): Promise<unknown>;
}>;

const PLATFORM_PORT_KEYS = ["loadProgressRuntime", "loadCompositionConfig"] as const;
const PROGRESS_RUNTIME_KEYS = ["cursorStore", "invalidationSource"] as const;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;

type DataMethod = (...args: unknown[]) => unknown;

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

    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(output, key))) return null;
    return output;
  } catch {
    return null;
  }
}

/** Capture a data method without evaluating accessors on a platform object. */
function captureDataMethod(value: unknown, name: string): DataMethod | null {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
    let current: object | null = value as object;
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        const method = descriptor.value as DataMethod;
        return (...args: unknown[]) => method.apply(value, args);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function captureFunction(value: unknown, receiver: unknown): DataMethod | null {
  if (typeof value !== "function") return null;
  return (...args: unknown[]) => value.apply(receiver, args);
}

function abortIfRequested(signal: AbortSignal): void {
  if (!signal || signal.aborted !== true) return;
  const error = new Error("Hoid platform dependency loading was aborted");
  error.name = "AbortError";
  throw error;
}

function canonicalProgressRuntime(value: unknown): HoidTrustedApplicationProgressRuntime | null {
  const record = exactDataRecord(value, PROGRESS_RUNTIME_KEYS, PROGRESS_RUNTIME_KEYS);
  if (!record) return null;

  const cursorStore = record.cursorStore;
  const invalidationSource = record.invalidationSource;
  const load = captureDataMethod(cursorStore, "load");
  const read = captureDataMethod(cursorStore, "read");
  const compareAndSwap = captureDataMethod(cursorStore, "compareAndSwap");
  const subscribe = captureDataMethod(invalidationSource, "subscribe");
  if (!load || !read || !compareAndSwap || !subscribe) return null;

  // Freeze wrappers around the methods captured at validation time. A later
  // property replacement on a native adapter cannot silently swap the port.
  const stableCursorStore: HoidCursorProgressStore = Object.freeze({
    load: async (): Promise<HoidCursorStoreLoadResult> =>
      await Promise.resolve(load()) as HoidCursorStoreLoadResult,
    read: async (): Promise<unknown> => await Promise.resolve(read()),
    compareAndSwap: async (
      expectedRevision: number,
      next: HoidCursorProgressSnapshot,
    ): Promise<boolean> => {
      const result = await Promise.resolve(compareAndSwap(expectedRevision, next));
      return result === true;
    },
  });
  const stableInvalidationSource: HoidCursorProgressInvalidationSource = Object.freeze({
    subscribe(listener: () => void): () => void {
      if (typeof listener !== "function") return () => {};
      const unsubscribe = subscribe(listener);
      if (typeof unsubscribe !== "function") {
        throw new TypeError("Hoid progress invalidation adapter returned no unsubscribe function");
      }
      return unsubscribe as () => void;
    },
  });

  return Object.freeze({
    cursorStore: stableCursorStore,
    invalidationSource: stableInvalidationSource,
  });
}

/**
 * Builds the dependency loader consumed by the trusted application bootstrap.
 *
 * Progress is loaded and structurally validated before native trust/provider
 * configuration is requested. This prevents a provider from being initialized
 * when the authoritative reader cursor is unavailable. All platform objects
 * are narrowed to captured, frozen ports before they cross into Hoid core.
 */
export function createHoidTrustedApplicationDependencyLoader(
  platformPortsInput: unknown,
  sessionIdInput: unknown,
): HoidTrustedApplicationDependencyLoader | null {
  const ports = exactDataRecord(
    platformPortsInput,
    PLATFORM_PORT_KEYS,
    PLATFORM_PORT_KEYS,
  );
  if (
    !ports ||
    typeof sessionIdInput !== "string" ||
    !SESSION_ID_PATTERN.test(sessionIdInput)
  ) return null;

  const loadProgressRuntime = captureFunction(ports.loadProgressRuntime, ports);
  const loadCompositionConfig = captureFunction(ports.loadCompositionConfig, ports);
  if (!loadProgressRuntime || !loadCompositionConfig) return null;

  return async (signal: AbortSignal): Promise<HoidTrustedApplicationDependencies> => {
    abortIfRequested(signal);

    const rawProgressRuntime = await Promise.resolve(loadProgressRuntime(signal));
    abortIfRequested(signal);

    const progressRuntime = canonicalProgressRuntime(rawProgressRuntime);
    if (!progressRuntime) {
      throw new TypeError("Hoid native progress runtime is incomplete or malformed");
    }

    const compositionConfig = await Promise.resolve(loadCompositionConfig(signal));
    abortIfRequested(signal);

    return Object.freeze({
      compositionConfig,
      cursorStore: progressRuntime.cursorStore,
      invalidationSource: progressRuntime.invalidationSource,
      sessionId: sessionIdInput,
    });
  };
}
