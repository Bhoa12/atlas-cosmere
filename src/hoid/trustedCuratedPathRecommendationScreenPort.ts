import {
  projectHoidCuratedPathRecommendationsForDisplay,
  type HoidCuratedPathRecommendationDisplayProjection,
} from "./curatedPathRecommendationDisplayProjection";
import {
  awaitHoidOperationWithSignal,
  isHoidOperationCancelled,
} from "./abortableOperation";
import {
  loadHoidTrustedHostBootstrap,
  verifyHoidTrustedHostRevisionStore,
  type HoidTrustedHostBootstrapPort,
} from "./trustedHostBootstrap";
import type { HoidTrustRegistryRevisionStorePort } from "./trustRegistryRevisionStore";

export type HoidTrustedCuratedPathRecommendationScreenResult =
  | HoidCuratedPathRecommendationDisplayProjection
  | Readonly<{
      status: "withheld";
      reason:
        | "cancelled"
        | "port-disposed"
        | "source-unavailable"
        | "trust-anchor-unavailable"
        | "invalid-validation-context";
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
   * Host-owned loader for route material only. It must read the current route
   * catalogue, approvals, trust registry, signed evidence packages and the
   * authoritative per-work progress on every call. It must not supply the
   * repository, root key, clock or minimum registry revision.
   */
  loadValidationInput(signal?: AbortSignal): unknown | Promise<unknown>;
  /** Pinned out-of-band root-key configuration owned by the native host. */
  trustedHostBootstrapPort: HoidTrustedHostBootstrapPort;
  /** Durable anti-rollback revision store for the pinned trust domain. */
  revisionStore: HoidTrustRegistryRevisionStorePort;
  repositoryFullName: string;
  /** Host clock used to enforce bootstrap expiry and signature validity. */
  clock: Readonly<{ now(): unknown }>;
}>;

const TRUSTED_CURATED_PATH_SCREEN_PORTS = new WeakSet<object>();
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const VALIDATION_MATERIAL_KEYS = Object.freeze([
  "plan",
  "catalogue",
  "progressSnapshot",
  "attestations",
  "registry",
  "verifier",
  "evidencePackages",
  "evidenceContext",
]);

type UnknownMethod = (...args: unknown[]) => unknown;

function withheld(
  reason: Extract<HoidTrustedCuratedPathRecommendationScreenResult, { status: "withheld" }>["reason"],
): HoidTrustedCuratedPathRecommendationScreenResult {
  return Object.freeze({ status: "withheld", reason });
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

function resolveMethod(value: unknown, name: string): UnknownMethod | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as UnknownMethod).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function validationMaterial(
  value: unknown,
  repositoryFullName: string,
): Record<string, unknown> | null {
  const raw = exactRecord(value, VALIDATION_MATERIAL_KEYS);
  if (!raw) return null;
  const evidenceContext = raw.evidenceContext;
  if (
    evidenceContext === null ||
    typeof evidenceContext !== "object" ||
    Array.isArray(evidenceContext)
  ) return null;
  let repositoryDescriptor: PropertyDescriptor | undefined;
  try {
    repositoryDescriptor = Object.getOwnPropertyDescriptor(evidenceContext, "repositoryFullName");
  } catch {
    return null;
  }
  if (
    !repositoryDescriptor ||
    !Object.prototype.hasOwnProperty.call(repositoryDescriptor, "value") ||
    repositoryDescriptor.value !== repositoryFullName
  ) return null;
  return raw;
}

function exactConfig(value: unknown): Readonly<{
  loadValidationInput: (signal?: AbortSignal) => unknown | Promise<unknown>;
  trustedHostBootstrapPort: HoidTrustedHostBootstrapPort;
  revisionStore: HoidTrustRegistryRevisionStorePort;
  repositoryFullName: string;
  now: () => unknown;
}> | null {
  const raw = exactRecord(value, [
    "loadValidationInput",
    "trustedHostBootstrapPort",
    "revisionStore",
    "repositoryFullName",
    "clock",
  ]);
  if (
    !raw ||
    typeof raw.loadValidationInput !== "function" ||
    raw.trustedHostBootstrapPort === null ||
    typeof raw.trustedHostBootstrapPort !== "object" ||
    raw.revisionStore === null ||
    typeof raw.revisionStore !== "object" ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName)
  ) return null;
  const now = resolveMethod(raw.clock, "now");
  if (!now) return null;
  return Object.freeze({
    loadValidationInput: (raw.loadValidationInput as (signal?: AbortSignal) => unknown | Promise<unknown>)
      .bind(value),
    trustedHostBootstrapPort: raw.trustedHostBootstrapPort as HoidTrustedHostBootstrapPort,
    revisionStore: raw.revisionStore as HoidTrustRegistryRevisionStorePort,
    repositoryFullName: raw.repositoryFullName,
    now: () => now(),
  });
}

/**
 * Creates the only screen capability accepted for curated-path recommendations.
 *
 * Each presentation reloads the pinned host configuration, checks the durable
 * anti-rollback registry revision, reloads current route material and reruns
 * the complete signed route/evidence/progress projection. The loader cannot
 * choose the repository, root key, clock or minimum registry revision.
 *
 * The host must provision readPinnedConfiguration from secure native storage
 * and a revision store with durable anti-rollback semantics. The private port
 * brand is a composition guard, not a replacement for those host guarantees.
 */
export function createHoidTrustedCuratedPathRecommendationScreenPort(
  configInput: unknown,
): HoidTrustedCuratedPathRecommendationScreenPort | null {
  const config = exactConfig(configInput);
  if (!config) return null;

  let disposed = false;
  let generation = 0;
  const port: HoidTrustedCuratedPathRecommendationScreenPort = Object.freeze({
    async present(signal?: AbortSignal): Promise<HoidTrustedCuratedPathRecommendationScreenResult> {
      if (disposed) return withheld("port-disposed");
      if (signal?.aborted) return withheld("cancelled");
      const currentGeneration = ++generation;

      let nowInput: unknown;
      try {
        nowInput = config.now();
      } catch {
        return withheld("trust-anchor-unavailable");
      }
      if (typeof nowInput !== "string") return withheld("trust-anchor-unavailable");

      let hostBootstrap: Awaited<ReturnType<typeof loadHoidTrustedHostBootstrap>>;
      try {
        hostBootstrap = await loadHoidTrustedHostBootstrap(
          config.trustedHostBootstrapPort,
          config.repositoryFullName,
          nowInput,
        );
      } catch {
        return withheld("trust-anchor-unavailable");
      }
      if (hostBootstrap.status !== "ready") return withheld("trust-anchor-unavailable");

      let revisionCheck: Awaited<ReturnType<typeof verifyHoidTrustedHostRevisionStore>>;
      try {
        revisionCheck = await verifyHoidTrustedHostRevisionStore(
          hostBootstrap.configuration,
          config.revisionStore,
          config.repositoryFullName,
          nowInput,
        );
      } catch {
        return withheld("trust-anchor-unavailable");
      }
      if (revisionCheck.status !== "ready") return withheld("trust-anchor-unavailable");
      if (disposed) return withheld("port-disposed");
      if (signal?.aborted || currentGeneration !== generation) return withheld("cancelled");

      let rawMaterial: unknown;
      try {
        rawMaterial = await awaitHoidOperationWithSignal(
          () => config.loadValidationInput(signal),
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

      const material = validationMaterial(rawMaterial, config.repositoryFullName);
      if (!material) return withheld("invalid-validation-context");

      const trustedInput = Object.freeze({
        ...material,
        repositoryFullName: config.repositoryFullName,
        rootKey: hostBootstrap.configuration.rootKey,
        now: nowInput,
        minimumRegistryRevision: Math.max(
          hostBootstrap.configuration.minimumRegistryRevision,
          revisionCheck.persistedMinimumRevision,
        ),
      });

      let projection: HoidCuratedPathRecommendationDisplayProjection;
      try {
        projection = await projectHoidCuratedPathRecommendationsForDisplay(trustedInput);
      } catch {
        return withheld("plan-revalidation-failed");
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
