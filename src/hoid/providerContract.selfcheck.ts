import {
  executeProviderSafely,
  type HoidProvider,
} from "./providerContract";

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const validProvider: HoidProvider = {
  async answer() {
    return { text: "Respuesta respaldada.", evidenceIds: ["e1"] };
  },
};

const futureProvider: HoidProvider = {
  async answer() {
    return { text: "Respuesta contaminada.", evidenceIds: ["future"] };
  },
};

async function run(): Promise<void> {
  const evidence = [{ id: "e1", summary: "Resumen original autorizado." }];

  const valid = await executeProviderSafely(validProvider, {
    question: "¿Qué sé hasta aquí?",
    evidence,
  });
  expect(valid.kind === "answer", "Debe aceptar evidencia autorizada.");

  const contaminated = await executeProviderSafely(futureProvider, {
    question: "¿Qué sé hasta aquí?",
    evidence,
  });
  expect(
    contaminated.kind === "abstain" && contaminated.reason === "INVALID_DRAFT",
    "Debe rechazar evidencia ajena al contexto autorizado.",
  );

  const empty = await executeProviderSafely(validProvider, {
    question: "¿Qué sé hasta aquí?",
    evidence: [],
  });
  expect(
    empty.kind === "abstain" && empty.reason === "NO_AUTHORIZED_EVIDENCE",
    "Sin evidencia no debe invocarse conocimiento narrativo.",
  );
}

void run();
