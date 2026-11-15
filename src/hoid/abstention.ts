export type AbstentionReason =
  | "invalid-request"
  | "missing-progress"
  | "no-authorized-evidence"
  | "provider-failure"
  | "unverifiable-response";

export interface HoidAbstention {
  kind: "abstain";
  reason: AbstentionReason;
  message: string;
}

export interface HoidSuccess<T> {
  kind: "answer";
  value: T;
}

export type HoidResult<T> = HoidSuccess<T> | HoidAbstention;

export function abstain(reason: AbstentionReason): HoidAbstention {
  const messageByReason: Record<AbstentionReason, string> = {
    "invalid-request": "No puedo procesar esta consulta con seguridad.",
    "missing-progress": "Necesito un progreso de lectura válido para delimitar el contexto.",
    "no-authorized-evidence": "No dispongo de evidencia autorizada para responder sin riesgo de spoilers.",
    "provider-failure": "No se pudo generar una respuesta verificable.",
    "unverifiable-response": "La respuesta generada no pudo verificarse contra el contexto autorizado."
  };
  return { kind: "abstain", reason, message: messageByReason[reason] };
}
