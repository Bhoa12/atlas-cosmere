import { SpoilerCheckpointDecision } from "./spoilerCheckpointGate";

export type SpoilerContentMode = "always-safe" | "checkpoint-gated";

export interface SpoilerContentPolicy {
  contentId: string;
  mode: SpoilerContentMode;
}

export interface SpoilerAccessDecision {
  contentId: string;
  allowed: boolean;
}

export interface SpoilerAccessPolicyResult {
  status: "valid" | "blocked";
  decisions: readonly SpoilerAccessDecision[];
}

/**
 * Applies an explicit disclosure policy to checkpoint results.
 *
 * "always-safe" content is allowed without a reading checkpoint. "checkpoint-gated"
 * content must have exactly one explicit checkpoint decision. Unknown, duplicate or
 * unconsumed checkpoint decisions block the entire batch rather than silently
 * widening disclosure.
 */
export function resolveSpoilerAccessPolicy(
  policies: readonly SpoilerContentPolicy[],
  checkpoints: readonly SpoilerCheckpointDecision[],
): SpoilerAccessPolicyResult {
  const policyIds = new Set<string>();
  const checkpointById = new Map<string, SpoilerCheckpointDecision>();

  for (const checkpoint of checkpoints) {
    if (!checkpoint.contentId || checkpointById.has(checkpoint.contentId)) {
      return { status: "blocked", decisions: [] };
    }
    checkpointById.set(checkpoint.contentId, checkpoint);
  }

  const decisions: SpoilerAccessDecision[] = [];
  for (const policy of policies) {
    if (
      !policy.contentId ||
      policyIds.has(policy.contentId) ||
      (policy.mode !== "always-safe" && policy.mode !== "checkpoint-gated")
    ) {
      return { status: "blocked", decisions: [] };
    }
    policyIds.add(policy.contentId);

    if (policy.mode === "always-safe") {
      if (checkpointById.has(policy.contentId)) return { status: "blocked", decisions: [] };
      decisions.push({ contentId: policy.contentId, allowed: true });
      continue;
    }

    const checkpoint = checkpointById.get(policy.contentId);
    if (!checkpoint) return { status: "blocked", decisions: [] };
    decisions.push({ contentId: policy.contentId, allowed: checkpoint.allowed });
  }

  for (const checkpointId of checkpointById.keys()) {
    if (!policyIds.has(checkpointId)) return { status: "blocked", decisions: [] };
  }

  return { status: "valid", decisions };
}
