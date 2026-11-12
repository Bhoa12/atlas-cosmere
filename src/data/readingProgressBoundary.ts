export type ReadingUnitId = string;

export interface ReadingProgress {
  workId: string;
  completedUnitIds: readonly ReadingUnitId[];
}

export interface ReadingGate {
  id: string;
  workId: string;
  requiredUnitIds: readonly ReadingUnitId[];
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function canReveal(gate: ReadingGate, progress: ReadingProgress): boolean {
  if (!ID.test(gate.id) || !ID.test(gate.workId) || !ID.test(progress.workId)) return false;
  if (gate.workId !== progress.workId) return false;
  const completed = new Set(progress.completedUnitIds);
  if (completed.size !== progress.completedUnitIds.length) return false;
  if (![...completed].every(id => ID.test(id))) return false;
  return gate.requiredUnitIds.every(id => ID.test(id) && completed.has(id));
}
