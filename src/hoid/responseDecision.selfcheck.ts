import { createKnowledgeBoundary } from "./knowledgeBoundary";
import { decideProviderResponse, type ResponseDecision } from "./responseDecision";
import type { HoidProvider } from "./providerContract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runResponseDecisionSelfCheck(): Promise<void> {
  const boundary = createKnowledgeBoundary([{ id: "safe", workId: "book", chapter: 1 }]);

  const safeProvider: HoidProvider = {
    name: "safe",
    async answer() {
      return { answer: "Respuesta respaldada.", claims: [{ text: "Hecho.", evidenceIds: ["safe"] }] };
    },
  };
  const unsafeProvider: HoidProvider = {
    name: "unsafe",
    async answer() {
      return { answer: "Respuesta potencialmente contaminada.", claims: [{ text: "Hecho futuro.", evidenceIds: ["future"] }] };
    },
  };

  const safe = await decideProviderResponse(safeProvider, boundary, { text: "Pregunta" });
  assert(safe.kind === "answer", "A fully verified response must be returned");

  const unsafe = await decideProviderResponse(unsafeProvider, boundary, { text: "Pregunta" });
  assert(unsafe.kind === "abstain" && unsafe.reason === "unverified_claim",
    "Any rejected narrative claim must withhold the complete answer");

  const emptyProvider: HoidProvider = {
    name: "empty",
    async answer() { return { answer: "   ", claims: [] }; },
  };
  const empty: ResponseDecision = await decideProviderResponse(emptyProvider, boundary, { text: "Pregunta" });
  assert(empty.kind === "abstain" && empty.reason === "empty_answer",
    "Empty answers must fail closed");
}
