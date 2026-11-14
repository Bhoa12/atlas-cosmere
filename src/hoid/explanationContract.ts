/**
 * Hoid IA: contrato de explicaciones seguras.
 *
 * Una explicación narrativa solo puede salir si cada unidad explicativa
 * está respaldada por evidencia ya autorizada para el progreso del lector.
 * No inspecciona EPUBs ni convierte el catálogo en conocimiento narrativo.
 */

export type ExplanationMode = "definition" | "recap" | "relationship";

export interface ExplanationUnit {
  id: string;
  text: string;
  evidenceIds: readonly string[];
}

export interface ExplanationDraft {
  mode: ExplanationMode;
  units: readonly ExplanationUnit[];
}

export type ExplanationVerification =
  | { ok: true; text: string }
  | { ok: false; reason: "empty-draft" | "invalid-unit" | "missing-evidence" | "unauthorized-evidence" };

/**
 * Verifica el borrador de forma atómica: una sola unidad insegura invalida
 * toda la explicación para evitar conservar conclusiones redactadas con
 * conocimiento futuro.
 */
export function verifyExplanation(
  draft: ExplanationDraft,
  authorizedEvidenceIds: ReadonlySet<string>,
): ExplanationVerification {
  if (!draft.units.length) return { ok: false, reason: "empty-draft" };

  const text: string[] = [];
  for (const unit of draft.units) {
    if (!unit.id.trim() || !unit.text.trim()) {
      return { ok: false, reason: "invalid-unit" };
    }
    if (!unit.evidenceIds.length) {
      return { ok: false, reason: "missing-evidence" };
    }
    if (unit.evidenceIds.some((id) => !id.trim() || !authorizedEvidenceIds.has(id))) {
      return { ok: false, reason: "unauthorized-evidence" };
    }
    text.push(unit.text.trim());
  }

  return { ok: true, text: text.join("\n\n") };
}
