import { runAuditedExplanation, type HoidClaimSelector } from "./auditedExplanation";
import type { ApprovedClaim } from "./claimFirewall";
import type { SafeEvidence } from "./providerRuntime";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hoid audited explanation selfcheck failed: ${message}`);
}

const progress = { bookId: "mistborn-era1-book1", chapter: 3 };
const evidence: SafeEvidence[] = [
  {
    id: "mistborn-summary-3",
    bookId: progress.bookId,
    chapter: 3,
    accessible: true,
    summary: "Resumen original autorizado para las pruebas.",
  },
  {
    id: "mistborn-summary-5",
    bookId: progress.bookId,
    chapter: 5,
    accessible: true,
    summary: "Resumen futuro que nunca debe llegar al selector.",
  },
];
const ledger: ApprovedClaim[] = [
  {
    id: "claim-safe-1",
    bookId: progress.bookId,
    chapter: 2,
    kind: "explanation",
    evidenceIds: ["mistborn-summary-3"],
    approvedText: "Explicación original previamente revisada.",
    status: "approved",
  },
  {
    id: "claim-future",
    bookId: progress.bookId,
    chapter: 4,
    kind: "fact",
    evidenceIds: ["mistborn-summary-5"],
    approvedText: "Afirmación futura que no debe exponerse.",
    status: "approved",
  },
  {
    id: "claim-foreign",
    bookId: "elantris",
    chapter: 1,
    kind: "fact",
    evidenceIds: ["mistborn-summary-3"],
    approvedText: "Afirmación de otra obra.",
    status: "approved",
  },
];

async function main(): Promise<void> {
  let seenCandidateIds: string[] = [];
  const selector: HoidClaimSelector = {
    async selectClaims(_context, candidates) {
      seenCandidateIds = candidates.map((candidate) => candidate.id);
      return { kind: "selection", claimIds: ["claim-safe-1"] };
    },
  };

  const valid = await runAuditedExplanation(
    selector,
    "Explica el concepto sin spoilers",
    progress,
    evidence,
    ledger,
  );
  assert(valid.kind === "answer", "una selección de afirmaciones revisadas debe producir respuesta");
  assert(valid.text.includes(ledger[0].approvedText), "el renderizador debe usar el texto revisado");
  assert(!valid.text.includes("futura"), "el renderizador no debe incluir texto futuro");
  assert(seenCandidateIds.length === 1 && seenCandidateIds[0] === "claim-safe-1",
    "el selector solo debe recibir afirmaciones del libro y capítulo autorizados");

  const proseInjection: HoidClaimSelector = {
    async selectClaims() {
      return {
        kind: "selection",
        claimIds: ["claim-safe-1"],
        text: "Prosa libre no revisada que podría contener spoilers.",
      };
    },
  };
  const injected = await runAuditedExplanation(
    proseInjection,
    "Explica",
    progress,
    evidence,
    ledger,
  );
  assert(injected.kind === "abstain", "la prosa libre del proveedor debe provocar abstención");

  const unknownClaim: HoidClaimSelector = {
    async selectClaims() {
      return { kind: "selection", claimIds: ["claim-future"] };
    },
  };
  const future = await runAuditedExplanation(
    unknownClaim,
    "Explica",
    progress,
    evidence,
    ledger,
  );
  assert(future.kind === "abstain", "el proveedor no debe poder seleccionar afirmaciones futuras");

  const throwing: HoidClaimSelector = {
    async selectClaims() {
      throw new Error("simulated provider failure");
    },
  };
  const failed = await runAuditedExplanation(
    throwing,
    "Explica",
    progress,
    evidence,
    ledger,
  );
  assert(failed.kind === "abstain" && failed.reason === "provider-failure",
    "los errores del selector deben provocar abstención");

  const invalidQuestion = await runAuditedExplanation(
    selector,
    "   ",
    progress,
    evidence,
    ledger,
  );
  assert(invalidQuestion.kind === "abstain" && invalidQuestion.reason === "invalid-request",
    "las preguntas vacías deben rechazarse");

  const invalidProgress = await runAuditedExplanation(
    selector,
    "Explica",
    { bookId: progress.bookId, chapter: 0 },
    evidence,
    ledger,
  );
  assert(invalidProgress.kind === "abstain" && invalidProgress.reason === "invalid-progress",
    "el progreso inválido debe rechazarse");

  const noLedger = await runAuditedExplanation(
    selector,
    "Explica",
    progress,
    evidence,
    [],
  );
  assert(noLedger.kind === "abstain", "sin afirmaciones revisadas no debe generarse respuesta");

  const mutatingSelector: HoidClaimSelector = {
    async selectClaims(_context, candidates) {
      (candidates as unknown as Array<{ id: string }>).push({ id: "injected" });
      return { kind: "selection", claimIds: ["claim-safe-1"] };
    },
  };
  const mutation = await runAuditedExplanation(
    mutatingSelector,
    "Explica",
    progress,
    evidence,
    ledger,
  );
  assert(mutation.kind === "abstain" && mutation.reason === "provider-failure",
    "la lista de afirmaciones ofrecida al proveedor debe ser inmutable");

  console.log("Hoid audited explanation selfcheck: 8 groups passed.");
}

void main();
