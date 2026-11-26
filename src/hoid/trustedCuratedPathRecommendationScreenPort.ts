import {
  projectHoidCuratedPathRecommendationsForDisplay,
  type HoidCuratedPathRecommendationDisplayProjection,
} from "./curatedPathRecommendationDisplayProjection";
import {
  awaitHoidOperationWithSignal,
  isHoidOperationCancelled,
} from "./abortableOperation";

export type HoidTrustedCuratedPathRecommendationScreenResult =
  | HoidCuratedPathRecommendationDisplayProjection
  | Readonly<{
      status: "withheld";
      reason: "cancelled" | "port-disposed" | "source-unavailable";
    }>;

export type HoidTrustedCuratedPathRecommendationScreenPort = Readonly<{
  /**
   * Loads a fresh, complete validation context from the host and revalidates it.
   * The UI cannot supply a plan, progress snapshot, signatures or evidence.
   */
  present(signal?: AbortSignal): Promise<HoidTrustedCuratedPathRecommendationScreenResult>;
  dispose(): void;
}>;

export type HoidTrustedCuratedPathRecommendationScreenPortConfig = Readonly<{
  /**
   * Host-owned loader. It must read the current catalogue, signed approvals,
   * trust registry, evidence packages and authoritative per-work progress on
   * every call. The returned value is treated as unknown and fully revalidated.
   */
  loadValidationInput(signal?: AbortSignal): unknown | Promise<unknown>;
}>;

const TRUSTED_CURATED_PATH_SCREEN_PORTS = new WeakSet<object>();

function withheld(
  reason: Extract<HoidTrustedCuratedPathRecommendationScreenResult, { status: "withheld" }>["reason"],
): HoidTrustedCuratedPathRecommendationScreenResult {
  return Object.freeze({ status: "withheld", reason });
}

function resolveLoader(value: unknown): ((signal?: AbortSignal) => unknown | Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 1 || keys[0] !== "loadValidationInput") return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "loadValidationInput");
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "function"
    ) return null;
    return (descriptor.value as (signal?: AbortSignal) => unknown | Promise<unknown>).bind(value);
  } catch {
    return null;
  }
}

/**
 * Creates the only screen capability accepted for curated-path recommendations.
 *
 * No result is cached. Every presentation reloads the host context and reruns
 * route quorum, signed claim/evidence, trust-registry and live progress checks.
 * The host must pin its route-review root key out of band before constructing
 * this adapter. A caller-supplied structurally compatible object is not trusted.
 */
export function createHoidTrustedCuratedPathRecommendationScreenPort(
  configInput: unknown,
): HoidTrustedCuratedPathRecommendationScreenPort | null {
  const loadValidationInput = resolveLoader(configInput);
  if (!loadValidationInput) return null;

  let disposed = false;
  let generation = 0;
  const port: HoidTrustedCuratedPathRecommendationScreenPort = Object.freeze({
    async present(signal?: AbortSignal): Promise<HoidTrustedCuratedPathRecommendationScreenResult> {
      if (disposed) return withheld("port-disposed");
      if (signal?.aborted) return withheld("cancelled");
      const currentGeneration = ++generation;

      let validationInput: unknown;
      try {
        validationInput = await awaitHoidOperationWithSignal(
          () => loadValidationInput(signal),
          signal,
        );
      } catch (error) {
        if (disposed) return withheld("port-disposed");
        if (isHoidOperationCancelled(error) || signal?.aborted || currentGeneration !== generation) {
          return withheld("cancelled");
        }
        return withheld("source-unavailable");
      }

      if (disposed) return withheld("port-disposed");
      if (signal?.aborted || currentGeneration !== generation) return withheld("cancelled");

      let projection: HoidCuratedPathRecommendationDisplayProjection;
      try {
        projection = await projectHoidCuratedPathRecommendationsForDisplay(validationInput);
      } catch {
        return disposed
          ? withheld("port-disposed")
          : withheld("plan-revalidation-failed");
      }
      if (disposed) return withheld("port-disposed");
      if (signal?.aborted || currentGeneration !== generation) return withheld("cancelled");
      return projection;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation += 1;
    },
  });
  TRUSTED_CURATED_PATH_SCREEN_PORTS.add(port as object);
  return port;
}

export function isHoidTrustedCuratedPathRecommendationScreenPort(
  value: unknown,
): value is HoidTrustedCuratedPathRecommendationScreenPort {
  return value !== null &&
    typeof value === "object" &&
    TRUSTED_CURATED_PATH_SCREEN_PORTS.has(value as object);
}
