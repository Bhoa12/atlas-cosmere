/**
 * Technical registry for future Cosmere world-to-work assignments.
 *
 * This file intentionally contains no editorial assignments. Relationships
 * between works and worlds must be supplied by separately verified metadata.
 */

export type WorldId = string;
export type WorkId = string;

export interface WorldWorkAssignment {
  worldId: WorldId;
  workId: WorkId;
}

const canonicalId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCanonicalTechnicalId(value: unknown): value is string {
  return typeof value === "string" && canonicalId.test(value);
}

/**
 * Validates only structural consistency. An empty list is valid because
 * absence of verified assignments must not be replaced with inference.
 */
export function validateWorldWorkAssignments(
  assignments: unknown,
  knownWorldIds: readonly WorldId[],
  knownWorkIds: readonly WorkId[],
): { valid: true; assignments: readonly WorldWorkAssignment[] } | { valid: false; reason: string } {
  if (!Array.isArray(assignments)) return { valid: false, reason: "assignments-not-array" };

  const worlds = new Set(knownWorldIds);
  const works = new Set(knownWorkIds);
  const seen = new Set<string>();

  for (const item of assignments) {
    if (!item || typeof item !== "object") return { valid: false, reason: "assignment-malformed" };
    const candidate = item as { worldId?: unknown; workId?: unknown };
    if (!isCanonicalTechnicalId(candidate.worldId) || !isCanonicalTechnicalId(candidate.workId)) {
      return { valid: false, reason: "assignment-id-invalid" };
    }
    if (!worlds.has(candidate.worldId)) return { valid: false, reason: "world-unknown" };
    if (!works.has(candidate.workId)) return { valid: false, reason: "work-unknown" };

    const key = candidate.worldId + ":" + candidate.workId;
    if (seen.has(key)) return { valid: false, reason: "assignment-duplicate" };
    seen.add(key);
  }

  return { valid: true, assignments: assignments as readonly WorldWorkAssignment[] };
}
