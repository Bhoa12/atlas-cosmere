import type { CompositeSpoilerGate } from "./compositeSpoilerGates";

export type SpoilerGateValidationIssue =
  | { type: "duplicate_gate_id"; gateId: string }
  | { type: "empty_gate"; gateId: string }
  | { type: "unknown_work"; gateId: string; workId: string }
  | { type: "duplicate_requirement"; gateId: string; workId: string; requiredPosition: number };

/**
 * Validates only structural spoiler metadata. It deliberately does not infer
 * narrative dependencies or create missing reading checkpoints.
 */
export function validateCompositeSpoilerGates(
  gates: readonly CompositeSpoilerGate[],
  knownWorkIds: readonly string[],
): readonly SpoilerGateValidationIssue[] {
  const issues: SpoilerGateValidationIssue[] = [];
  const gateIds = new Set<string>();
  const known = new Set(knownWorkIds);
  for (const gate of gates) {
    if (gateIds.has(gate.id)) issues.push({ type: "duplicate_gate_id", gateId: gate.id });
    gateIds.add(gate.id);
    if (gate.requirements.length === 0) {
      issues.push({ type: "empty_gate", gateId: gate.id });
      continue;
    }
    const requirements = new Set<string>();
    for (const requirement of gate.requirements) {
      if (!known.has(requirement.workId)) {
        issues.push({ type: "unknown_work", gateId: gate.id, workId: requirement.workId });
      }
      const key = `${requirement.workId}:${requirement.requiredPosition}`;
      if (requirements.has(key)) {
        issues.push({ type: "duplicate_requirement", gateId: gate.id, workId: requirement.workId, requiredPosition: requirement.requiredPosition });
      }
      requirements.add(key);
    }
  }
  return issues;
}
