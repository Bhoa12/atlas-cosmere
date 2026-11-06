import type { WorldProgressCoverage } from "./worldProgressCoverage";

export type WorldProgressStatus =
  | "blocked"
  | "not-started"
  | "in-progress"
  | "complete";

/**
 * Produces a UI-safe status without inventing progress for ambiguous or
 * structurally empty worlds. Ambiguous catalog coordinates always win.
 */
export function resolveWorldProgressStatus(
  coverage: WorldProgressCoverage,
): WorldProgressStatus {
  if (coverage.ambiguousWorkIds.length > 0 || coverage.declaredPositions === 0) {
    return "blocked";
  }

  if (coverage.completedPositions === 0) {
    return "not-started";
  }

  if (coverage.completedPositions >= coverage.declaredPositions && coverage.next === null) {
    return "complete";
  }

  return "in-progress";
}
