export type SourceId = string;

export interface SafeAbstention {
  readonly kind: "abstain";
  readonly message: string;
  readonly reason:
    | "no_authorized_evidence"
    | "scope_not_authorized"
    | "verification_failed";
}

export interface GroundedAnswer {
  readonly kind: "answer";
  readonly text: string;
  readonly evidenceIds: readonly SourceId[];
}

export type HoidResult = SafeAbstention | GroundedAnswer;

/**
 * Closed-failure boundary: callers must not synthesize a narrative answer when
 * evidence or verification is unavailable.
 */
export function abstain(
  reason: SafeAbstention["reason"],
  message = "No dispongo de evidencia autorizada suficiente para responder sin riesgo de spoilers."
): SafeAbstention {
  return { kind: "abstain", reason, message };
}

export function answer(
  text: string,
  evidenceIds: readonly SourceId[]
): GroundedAnswer | SafeAbstention {
  if (!text.trim() || evidenceIds.length === 0) {
    return abstain("verification_failed");
  }
  return { kind: "answer", text: text.trim(), evidenceIds: [...evidenceIds] };
}
