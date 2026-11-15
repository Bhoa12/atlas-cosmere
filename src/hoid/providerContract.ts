/**
 * Hoid IA — proveedor desacoplado y ejecución segura.
 *
 * Esta frontera impide que un proveedor convierta una ausencia de contexto
 * autorizado en conocimiento narrativo. El proveedor solo recibe evidencia
 * previamente admitida y su salida debe declarar qué evidencia utilizó.
 */

export type ProviderEvidence = {
  id: string;
  summary: string;
};

export type ProviderRequest = {
  question: string;
  evidence: readonly ProviderEvidence[];
};

export type ProviderDraft = {
  text: string;
  evidenceIds: readonly string[];
};

export interface HoidProvider {
  answer(request: ProviderRequest): Promise<ProviderDraft>;
}

export type ProviderExecution =
  | { kind: "answer"; text: string; evidenceIds: readonly string[] }
  | { kind: "abstain"; reason: "NO_AUTHORIZED_EVIDENCE" | "INVALID_DRAFT" };

export async function executeProviderSafely(
  provider: HoidProvider,
  request: ProviderRequest,
): Promise<ProviderExecution> {
  if (!request.question.trim() || request.evidence.length === 0) {
    return { kind: "abstain", reason: "NO_AUTHORIZED_EVIDENCE" };
  }

  const allowed = new Set(request.evidence.map((item) => item.id));
  const draft = await provider.answer({
    question: request.question.trim(),
    evidence: request.evidence.map((item) => ({ ...item })),
  });

  if (
    !draft.text.trim() ||
    draft.evidenceIds.length === 0 ||
    draft.evidenceIds.some((id) => !allowed.has(id))
  ) {
    return { kind: "abstain", reason: "INVALID_DRAFT" };
  }

  return {
    kind: "answer",
    text: draft.text.trim(),
    evidenceIds: [...new Set(draft.evidenceIds)],
  };
}
