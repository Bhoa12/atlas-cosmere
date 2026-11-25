import { getExpoHoidCursorProgressRuntime } from "./expoCursorProgressCoordinator";
import {
  createHoidTrustedApplicationDependencyLoader,
} from "./trustedApplicationPlatform";
import {
  createHoidTrustedApplicationBootstrap,
  type HoidTrustedApplicationBootstrap,
} from "./trustedApplicationBootstrap";

export type HoidExpoTrustedCompositionProvisioner = Readonly<{
  /**
   * Returns the real platform trust configuration:
   * signed package/registry sources, durable anti-rollback checkpoint,
   * trusted clock, pinned public root key, Ed25519 verifier and provider
   * transport. The application must not synthesize these values.
   */
  loadCompositionConfig(signal: AbortSignal): Promise<unknown>;
}>;

const PROVISIONER_KEYS = ["loadCompositionConfig"] as const;

function captureProvisioner(value: unknown): ((signal: AbortSignal) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== PROVISIONER_KEYS.length ||
      keys.some(key => typeof key !== "string" || !PROVISIONER_KEYS.includes(key as typeof PROVISIONER_KEYS[number]))
    ) return null;

    const descriptor = Object.getOwnPropertyDescriptor(value, "loadCompositionConfig");
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "function"
    ) return null;

    const method = descriptor.value as (signal: AbortSignal) => Promise<unknown>;
    return signal => Promise.resolve(method.call(value, signal));
  } catch {
    return null;
  }
}

/**
 * Expo application adapter for the trusted bootstrap.
 *
 * It reuses the exact SQLite cursor store and coordinator already owned by
 * CosmereContext. The native trust provisioner is mandatory; without it this
 * factory returns null and HoidScreen remains in its unconfigured state.
 */
export function createExpoHoidTrustedApplicationBootstrap(
  provisionerInput: unknown,
  sessionId: string,
  now?: () => string,
): HoidTrustedApplicationBootstrap | null {
  const loadCompositionConfig = captureProvisioner(provisionerInput);
  if (!loadCompositionConfig) return null;

  const dependencyLoader = createHoidTrustedApplicationDependencyLoader(
    Object.freeze({
      loadProgressRuntime: async (signal: AbortSignal) => {
        if (signal.aborted) {
          const error = new Error("Expo Hoid progress runtime loading was aborted");
          error.name = "AbortError";
          throw error;
        }

        const runtime = await getExpoHoidCursorProgressRuntime();
        if (signal.aborted) {
          const error = new Error("Expo Hoid progress runtime loading was aborted");
          error.name = "AbortError";
          throw error;
        }

        return Object.freeze({
          cursorStore: runtime.store,
          invalidationSource: runtime.coordinator,
        });
      },
      loadCompositionConfig,
    }),
    sessionId,
  );

  if (!dependencyLoader) return null;
  return createHoidTrustedApplicationBootstrap(dependencyLoader, now);
}
