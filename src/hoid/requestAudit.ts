/**
 * Minimal, spoiler-safe audit trail for Hoid IA requests.
 *
 * The audit record stores decisions and opaque identifiers, never source text,
 * excerpts, generated narrative claims, or rejected spoiler content.
 */

export type AuditStage =
  | "catalog_validated"
  | "provenance_checked"
  | "context_selected"
  | "knowledge_bounded"
  | "provider_completed"
  | "output_verified"
  | "response_decided";

export type AuditEvent = Readonly<{
  stage: AuditStage;
  outcome: "accepted" | "rejected" | "limited" | "abstained";
  evidenceIds: readonly string[];
  reasonCode?: string;
}>;

export type RequestAudit = Readonly<{
  requestId: string;
  events: readonly AuditEvent[];
}>;

function validId(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Creates an immutable audit record. Invalid request or evidence identifiers
 * fail closed by throwing before a partially valid trace can be emitted.
 */
export function createRequestAudit(
  requestId: string,
  events: readonly AuditEvent[],
): RequestAudit {
  if (!validId(requestId)) throw new Error("invalid_request_id");

  const safeEvents = events.map((event) => {
    const ids = [...new Set(event.evidenceIds.map((id) => id.trim()))];
    if (ids.some((id) => !validId(id))) throw new Error("invalid_evidence_id");

    return Object.freeze({
      stage: event.stage,
      outcome: event.outcome,
      evidenceIds: Object.freeze(ids),
      ...(event.reasonCode?.trim()
        ? { reasonCode: event.reasonCode.trim() }
        : {}),
    });
  });

  return Object.freeze({
    requestId: requestId.trim(),
    events: Object.freeze(safeEvents),
  });
}

/**
 * Produces a summary suitable for observability without exposing narrative
 * content. Consumers must not infer source accessibility from catalog presence.
 */
export function summarizeAudit(audit: RequestAudit): Readonly<{
  stages: number;
  abstained: boolean;
  limited: boolean;
}> {
  return Object.freeze({
    stages: audit.events.length,
    abstained: audit.events.some((event) => event.outcome === "abstained"),
    limited: audit.events.some((event) => event.outcome === "limited"),
  });
}
