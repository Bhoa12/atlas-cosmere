export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
}

/**
 * Builds a deterministic reading plan from explicit unit metadata only.
 * It never derives chapters or narrative structure from a title.
 */
export function readingPlan(workId: string, units: ReadingUnit[]): ReadingUnit[] {
  const seenPositions = new Set<number>();
  const plan = units
    .filter(unit => unit.workId === workId)
    .filter(unit => Boolean(unit.id) && Number.isInteger(unit.position) && unit.position > 0)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

  for (const unit of plan) {
    if (seenPositions.has(unit.position)) return [];
    seenPositions.add(unit.position);
  }
  return plan;
}

export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: string[];
}

export interface ProgressAudit {
  accepted: string[];
  ignored: string[];
}

/**
 * Audits progress against the explicit reading plan.
 * Unknown IDs and IDs from another work cannot influence spoiler gates.
 */
export function auditProgress(
  workId: string,
  snapshots: ProgressSnapshot[],
  units: ReadingUnit[],
): ProgressAudit {
  const plan = readingPlan(workId, units);
  if (!plan.length && units.some(unit => unit.workId === workId)) {
    return { accepted: [], ignored: snapshots.flatMap(snapshot => snapshot.completedUnitIds) };
  }

  const validIds = new Set(plan.map(unit => unit.id));
  const completed = new Set<string>();
  const ignored = new Set<string>();

  for (const snapshot of snapshots) {
    for (const id of snapshot.completedUnitIds) {
      if (snapshot.workId !== workId || !validIds.has(id)) ignored.add(id);
      else completed.add(id);
    }
  }

  return {
    accepted: plan.filter(unit => completed.has(unit.id)).map(unit => unit.id),
    ignored: [...ignored].sort(),
  };
}

export type GateDecision =
  | { state: "unlocked"; pendingUnitIds: [] }
  | { state: "blocked"; pendingUnitIds: string[] };

/**
 * A spoiler gate is evaluated only against a valid, explicit reading plan.
 * Empty or ambiguous plans fail closed.
 */
export function evaluateGate(
  workId: string,
  requiredUnitIds: string[],
  snapshots: ProgressSnapshot[],
  units: ReadingUnit[],
): GateDecision {
  const plan = readingPlan(workId, units);
  const validIds = new Set(plan.map(unit => unit.id));
  const unique = new Set(requiredUnitIds);

  if (!requiredUnitIds.length || unique.size !== requiredUnitIds.length ||
      requiredUnitIds.some(id => !validIds.has(id))) {
    return { state: "blocked", pendingUnitIds: [...unique].sort() };
  }

  const audit = auditProgress(workId, snapshots, units);
  const accepted = new Set(audit.accepted);
  const pending = requiredUnitIds.filter(id => !accepted.has(id));
  return pending.length
    ? { state: "blocked", pendingUnitIds: pending }
    : { state: "unlocked", pendingUnitIds: [] };
}

export const catalogSourcePolicy = {
  verifiedIndex: "Titles and other explicitly verified metadata may seed the catalog.",
  declaredPrivate: "Private sources remain metadata-only until their relevant material is accessible.",
  editorialContent: "No summary should be stored unless backed by accessible material and written originally.",
} as const;
