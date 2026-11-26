import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  validateHoidCuratedReadingPathRecommendationPlan,
  type HoidCuratedReadingPathPlanValidation,
} from "./curatedReadingPathCatalogue";

/**
 * UI-safe representation of an already revalidated curated-path recommendation.
 * It intentionally contains no chapter, locator, progress, signature or digest data.
 */
export type HoidCuratedPathRecommendationDisplayItem = Readonly<{
  key: string;
  pathTitle: string;
  workId: string;
  workTitle: string;
  whyNow: string;
  selection: "manual-reader-selection-required";
  rationaleAuthority: "signed-editorial-catalogue";
}>;

export type HoidCuratedPathRecommendationDisplayProjection =
  | Readonly<{
      status: "ready";
      items: readonly HoidCuratedPathRecommendationDisplayItem[];
    }>
  | Readonly<{
      status: "withheld";
      reason: "invalid-input" | "plan-revalidation-failed" | "unsafe-display-data";
    }>;

const WORKS = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work]));
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_ITEMS = 5;
const INPUT_KEYS = Object.freeze([
  "plan",
  "catalogue",
  "progressSnapshot",
  "attestations",
  "repositoryFullName",
  "registry",
  "rootKey",
  "verifier",
  "now",
  "minimumRegistryRevision",
  "evidencePackages",
  "evidenceContext",
]);

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
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
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      record[key] = descriptor.value;
    }
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    return record;
  } catch {
    return null;
  }
}

function safeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

/**
 * Revalidate the complete signed route, signed rationale evidence, trust registry
 * and live progress before producing display data. This is deliberately an
 * orchestration boundary, not a projection of an arbitrary caller-supplied plan.
 *
 * The returned rationale is copied only from the currently verified catalogue.
 * Starting a new work remains an explicit reader action; this function never
 * returns a chapter target or a navigation handoff.
 */
export async function projectHoidCuratedPathRecommendationsForDisplay(
  input: unknown,
): Promise<HoidCuratedPathRecommendationDisplayProjection> {
  const raw = exactRecord(input, INPUT_KEYS);
  if (!raw) {
    return Object.freeze({ status: "withheld", reason: "invalid-input" });
  }

  let validation: HoidCuratedReadingPathPlanValidation;
  try {
    validation = await validateHoidCuratedReadingPathRecommendationPlan(raw);
  } catch {
    return Object.freeze({ status: "withheld", reason: "plan-revalidation-failed" });
  }
  if (validation.status !== "valid") {
    return Object.freeze({ status: "withheld", reason: "plan-revalidation-failed" });
  }

  const recommendations = validation.plan.recommendations;
  if (recommendations.length < 1 || recommendations.length > MAX_ITEMS) {
    return Object.freeze({ status: "withheld", reason: "unsafe-display-data" });
  }

  const items: HoidCuratedPathRecommendationDisplayItem[] = [];
  const seen = new Set<string>();
  for (const recommendation of recommendations) {
    const work = WORKS.get(recommendation.workId);
    const key = recommendation.pathId + "." + recommendation.stepId;
    if (
      !ID_PATTERN.test(recommendation.pathId) ||
      !ID_PATTERN.test(recommendation.stepId) ||
      !work ||
      work.title !== recommendation.workTitle ||
      !safeText(recommendation.pathTitle, 120) ||
      !safeText(recommendation.rationale, 600) ||
      recommendation.navigation !== "manual-reader-selection-required" ||
      seen.has(key)
    ) {
      return Object.freeze({ status: "withheld", reason: "unsafe-display-data" });
    }
    seen.add(key);
    items.push(Object.freeze({
      key,
      pathTitle: recommendation.pathTitle,
      workId: work.id,
      workTitle: work.title,
      whyNow: recommendation.rationale,
      selection: "manual-reader-selection-required",
      rationaleAuthority: "signed-editorial-catalogue",
    }));
  }

  return Object.freeze({
    status: "ready",
    items: Object.freeze(items),
  });
}
