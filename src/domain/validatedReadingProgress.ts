import { ReadingUnitManifestEntry } from "./readingUnitManifest";

export interface ReadingProgressRecord {
  unitId: string;
  completed: boolean;
}

export interface ValidatedReadingProgressSnapshot {
  status: "valid" | "blocked";
  completedUnitIds: readonly string[];
  pendingUnitIds: readonly string[];
}

/** Validates explicit progress against a validated manifest without inferring completion. */
export function resolveValidatedReadingProgress(
  manifest: readonly ReadingUnitManifestEntry[],
  manifestValid: boolean,
  progress: readonly ReadingProgressRecord[],
): ValidatedReadingProgressSnapshot {
  if (!manifestValid) return { status: "blocked", completedUnitIds: [], pendingUnitIds: [] };

  const known = new Set<string>();
  for (const unit of manifest) {
    if (!unit || !unit.unitId.trim() || known.has(unit.unitId)) {
      return { status: "blocked", completedUnitIds: [], pendingUnitIds: [] };
    }
    known.add(unit.unitId);
  }

  const seen = new Set<string>();
  const completed = new Set<string>();
  for (const item of progress) {
    if (!item || !item.unitId.trim() || !known.has(item.unitId) || seen.has(item.unitId) || typeof item.completed !== "boolean") {
      return { status: "blocked", completedUnitIds: [], pendingUnitIds: [] };
    }
    seen.add(item.unitId);
    if (item.completed) completed.add(item.unitId);
  }

  const ordered = manifest.map((unit) => unit.unitId);
  return {
    status: "valid",
    completedUnitIds: ordered.filter((id) => completed.has(id)),
    pendingUnitIds: ordered.filter((id) => !completed.has(id)),
  };
}
