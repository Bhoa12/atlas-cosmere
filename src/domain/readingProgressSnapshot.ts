import { ReadingUnitProgressInput, hasConsistentReadingUnitProgress } from "./readingUnitProgress";

export type ReadingProgressStatus = "blocked" | "not-started" | "in-progress" | "complete";

export interface ReadingProgressSnapshot {
  status: ReadingProgressStatus;
  completedUnits: number;
  declaredUnits: number;
  nextUnitId: string | null;
}

/**
 * Produces a UI-safe snapshot from declared reading units only.
 * Invalid or ambiguous progress fails closed and exposes no next unit.
 */
export function resolveReadingProgressSnapshot(
  input: ReadingUnitProgressInput,
): ReadingProgressSnapshot {
  if (!hasConsistentReadingUnitProgress(input)) {
    return { status: "blocked", completedUnits: 0, declaredUnits: 0, nextUnitId: null };
  }

  const ordered = [...input.units].sort((a, b) => a.order - b.order);
  const completed = new Set(input.completedUnitIds);
  const completedUnits = completed.size;

  if (completedUnits === 0) {
    return { status: "not-started", completedUnits, declaredUnits: ordered.length, nextUnitId: ordered[0]?.id ?? null };
  }

  if (completedUnits === ordered.length) {
    return { status: "complete", completedUnits, declaredUnits: ordered.length, nextUnitId: null };
  }

  return {
    status: "in-progress",
    completedUnits,
    declaredUnits: ordered.length,
    nextUnitId: ordered[completedUnits]?.id ?? null,
  };
}
