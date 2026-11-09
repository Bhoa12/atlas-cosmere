export interface WorldExpansionAction {
  worldId: string;
  action: "expand-structure" | "await-catalog" | "blocked";
}

export interface WorldExpansionApproval {
  worldId: string;
  approved: boolean;
}

export interface WorldExpansionExecutionGate {
  worldId: string;
  executable: boolean;
  reason: "approved" | "awaiting-catalog" | "blocked" | "missing-approval";
}

/**
 * Applies an explicit execution approval boundary to an already-created
 * structural expansion plan. This function carries no source text, editorial
 * facts, summaries, or spoiler-bearing content.
 */
export function resolveWorldExpansionExecutionGate(
  actions: readonly WorldExpansionAction[],
  approvals: readonly WorldExpansionApproval[],
): readonly WorldExpansionExecutionGate[] {
  const invalid =
    new Set(actions.map(({ worldId }) => worldId)).size !== actions.length ||
    new Set(approvals.map(({ worldId }) => worldId)).size !== approvals.length ||
    actions.some(({ worldId, action }) => !worldId.trim() || !["expand-structure", "await-catalog", "blocked"].includes(action)) ||
    approvals.some(({ worldId, approved }) => !worldId.trim() || typeof approved !== "boolean") ||
    approvals.some(({ worldId }) => !actions.some((action) => action.worldId === worldId));

  if (invalid) {
    return actions.map(({ worldId }) => ({ worldId, executable: false, reason: "blocked" as const }));
  }

  return actions.map(({ worldId, action }) => {
    if (action === "blocked") return { worldId, executable: false, reason: "blocked" as const };
    if (action === "await-catalog") return { worldId, executable: false, reason: "awaiting-catalog" as const };

    const approval = approvals.find((entry) => entry.worldId === worldId);
    if (!approval || !approval.approved) return { worldId, executable: false, reason: "missing-approval" as const };
    return { worldId, executable: true, reason: "approved" as const };
  });
}
