import {
  buildProviderContext,
  runProvider,
  type HoidProvider,
  type ProviderContext,
  type SafeEvidence,
} from "./providerRuntime";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hoid provider runtime selfcheck failed: ${message}`);
}

const progress = { bookId: "mistborn-era1-book1", chapter: 3 };
const allowed: SafeEvidence = {
  id: "mistborn-1-chapter-2",
  bookId: progress.bookId,
  chapter: 2,
  accessible: true,
  summary: "  Resumen original de prueba.  ",
};
const evidence: SafeEvidence[] = [
  allowed,
  {
    id: "mistborn-1-chapter-4",
    bookId: progress.bookId,
    chapter: 4,
    accessible: true,
    summary: "No debe entrar en el contexto.",
  },
  {
    id: "elantris-chapter-1",
    bookId: "elantris",
    chapter: 1,
    accessible: true,
    summary: "Pertenece a otra obra.",
  },
  {
    id: "mistborn-1-unavailable",
    bookId: progress.bookId,
    chapter: 1,
    accessible: false,
    summary: "No está disponible.",
  },
];

async function main(): Promise<void> {
  const context = buildProviderContext("  Explica el contexto  ", "explain", progress, evidence);
  assert(context !== null, "debe construirse contexto con evidencia autorizada");
  assert(context.evidence.length === 1, "solo debe pasar la evidencia del libro y capítulo permitidos");
  assert(context.question === "Explica el contexto", "la pregunta debe normalizarse");
  assert(context.evidence[0].summary === "Resumen original de prueba.", "el resumen debe normalizarse");

  assert(
    buildProviderContext("Pregunta", "explain", progress, [evidence[1]]) === null,
    "la evidencia futura no debe habilitar contexto",
  );
  assert(
    buildProviderContext("Pregunta", "explain", progress, [allowed, { ...allowed, chapter: 4 }]) === null,
    "los identificadores duplicados deben invalidar el contexto",
  );
  assert(
    buildProviderContext("x".repeat(4_001), "explain", progress, [allowed]) === null,
    "las preguntas excesivas deben rechazarse",
  );
  assert(
    buildProviderContext("Pregunta", "explain", { bookId: "mistborn-era1-book1", chapter: 0 }, [allowed]) === null,
    "el progreso inválido no debe construir contexto",
  );

  const validProvider: HoidProvider = {
    async generate() {
      return { kind: "answer", text: "  Respuesta respaldada.  ", evidenceIds: [allowed.id] };
    },
  };
  const validResult = await runProvider(validProvider, "Explica", "explain", progress, evidence);
  assert(validResult.kind === "answer", "una respuesta con procedencia autorizada debe pasar");
  assert(validResult.text === "Respuesta respaldada.", "la salida debe normalizarse");

  const unknownCitationProvider: HoidProvider = {
    async generate() {
      return { kind: "answer", text: "Respuesta", evidenceIds: ["future-evidence"] };
    },
  };
  const unknownCitation = await runProvider(unknownCitationProvider, "Explica", "explain", progress, evidence);
  assert(unknownCitation.kind === "abstain" && unknownCitation.reason === "provider-failure",
    "una cita no autorizada debe provocar abstención");

  const malformedProvider: HoidProvider = {
    async generate() {
      return { kind: "abstain", reason: "made-up-reason" };
    },
  };
  const malformed = await runProvider(malformedProvider, "Explica", "explain", progress, evidence);
  assert(malformed.kind === "abstain" && malformed.reason === "provider-failure",
    "un contrato de abstención malformado debe rechazarse");

  const mutationProvider: HoidProvider = {
    async generate(received: ProviderContext) {
      (received.evidence as SafeEvidence[]).push({
        id: "injected-future",
        bookId: progress.bookId,
        chapter: 99,
        accessible: true,
        summary: "No debe poder inyectarse.",
      });
      return { kind: "answer", text: "Respuesta", evidenceIds: ["injected-future"] };
    },
  };
  const mutation = await runProvider(mutationProvider, "Explica", "explain", progress, evidence);
  assert(mutation.kind === "abstain" && mutation.reason === "provider-failure",
    "el proveedor no debe poder mutar el contexto ni ampliar la lista de citas");

  const throwingProvider: HoidProvider = {
    async generate() {
      throw new Error("simulated provider failure");
    },
  };
  const thrown = await runProvider(throwingProvider, "Explica", "explain", progress, evidence);
  assert(thrown.kind === "abstain" && thrown.reason === "provider-failure",
    "las excepciones del proveedor deben convertirse en abstención");

  const invalidProgress = await runProvider(validProvider, "Explica", "explain",
    { bookId: "mistborn-era1-book1", chapter: -1 }, evidence);
  assert(invalidProgress.kind === "abstain" && invalidProgress.reason === "invalid-progress",
    "el progreso inválido debe identificarse antes de llamar al proveedor");

  const noEvidence = await runProvider(validProvider, "Explica", "explain", progress, [evidence[1]]);
  assert(noEvidence.kind === "abstain" && noEvidence.reason === "no-authorized-evidence",
    "la ausencia de evidencia autorizada debe terminar en abstención");

  console.log("Hoid provider runtime selfcheck: 12 groups passed.");
}

void main();
