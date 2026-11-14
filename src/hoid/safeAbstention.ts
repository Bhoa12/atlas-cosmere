export type HoidRefusalReason = "unsafe_context" | "insufficient_evidence";

export interface HoidAbstention {
  readonly mode: "abstain";
  readonly reason: HoidRefusalReason;
  readonly message: string;
}

/**
 * Creates a spoiler-neutral abstention. The message intentionally avoids
 * naming future chapters, evidence identifiers, or rejected facts.
 */
export function createSafeAbstention(
  reason: HoidRefusalReason = "insufficient_evidence",
): HoidAbstention {
  const message =
    reason === "unsafe_context"
      ? "No puedo responder con seguridad usando el contexto disponible."
      : "No tengo suficiente información verificada para responder sin riesgo de spoilers.";

  return Object.freeze({ mode: "abstain" as const, reason, message });
}

export function isSpoilerNeutralAbstention(value: HoidAbstention): boolean {
  return (
    value.mode === "abstain" &&
    value.message.trim().length > 0 &&
    !/cap[ií]tulo\s*\d+/i.test(value.message) &&
    !/evidence[-_:/]/i.test(value.message)
  );
}
