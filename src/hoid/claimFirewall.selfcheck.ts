import { renderApprovedClaims, type ApprovedClaim } from "./claimFirewall";
import type { SafeEvidence } from "./providerRuntime";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Hoid claim firewall selfcheck failed: ${message}`);
}

const progress = { bookId: "mistborn-era1-book1", chapter: 4 };
const evidence: SafeEvidence[] = [
  {
    id: "mistborn-chapter-3",
    bookId: progress.bookId,
    chapter: 3,
    accessible: true,
    summary: "Resumen original autorizado de prueba.",
  },
];
const ledger: ApprovedClaim[] = [
  {
    id: "claim-basic-context",
    bookId: progress.bookId,
    chapter: 2,
    kind: "explanation",
    evidenceIds: ["mistborn-chapter-3"],
    approvedText: "Afirmación original revisada para esta prueba.",
    status: "approved",
  },
];

function main(): void {
  const safe = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-basic-context"] },
    "explain",
    progress,
    evidence,
    ledger,
  );
  assert(safe.kind === "answer", "una selección revisada y respaldada debe renderizarse");
  assert(safe.text.includes(ledger[0].approvedText), "el texto debe proceder del registro revisado");
  assert(safe.evidenceIds[0] === evidence[0].id, "la procedencia debe conservarse");

  const injectedProse = renderApprovedClaims(
    {
      kind: "selection",
      claimIds: ["claim-basic-context"],
      text: "Prosa libre del proveedor con posible spoiler.",
    },
    "explain",
    progress,
    evidence,
    ledger,
  );
  assert(injectedProse.kind === "abstain" && injectedProse.reason === "invalid-selection",
    "la prosa libre del proveedor debe rechazarse");

  const futureClaim = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-future"] },
    "explain",
    progress,
    evidence,
    [...ledger, {
      ...ledger[0],
      id: "claim-future",
      chapter: 5,
      approvedText: "Afirmación futura.",
    }],
  );
  assert(futureClaim.kind === "abstain", "una afirmación posterior al progreso debe bloquearse");

  const foreignClaim = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-foreign"] },
    "explain",
    progress,
    evidence,
    [...ledger, {
      ...ledger[0],
      id: "claim-foreign",
      bookId: "elantris",
      approvedText: "Afirmación de otra obra.",
    }],
  );
  assert(foreignClaim.kind === "abstain", "una afirmación de otra obra debe bloquearse");

  const missingEvidence = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-without-evidence"] },
    "explain",
    progress,
    evidence,
    [...ledger, {
      ...ledger[0],
      id: "claim-without-evidence",
      evidenceIds: ["not-authorized"],
    }],
  );
  assert(missingEvidence.kind === "abstain", "una afirmación sin evidencia autorizada debe bloquearse");

  const duplicateClaim = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-basic-context"] },
    "explain",
    progress,
    evidence,
    [...ledger, ledger[0]],
  );
  assert(duplicateClaim.kind === "abstain", "un identificador ambiguo en el registro debe bloquearse");

  const futureEvidence = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-basic-context"] },
    "explain",
    progress,
    [{
      ...evidence[0],
      chapter: 5,
      id: "future-evidence",
    }],
    [{
      ...ledger[0],
      evidenceIds: ["future-evidence"],
    }],
  );
  assert(futureEvidence.kind === "abstain", "la evidencia futura debe bloquearse antes del renderizado");

  const invalidProgress = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-basic-context"] },
    "explain",
    { bookId: progress.bookId, chapter: 0 },
    evidence,
    ledger,
  );
  assert(invalidProgress.kind === "abstain" && invalidProgress.reason === "invalid-progress",
    "el progreso inválido debe provocar abstención");

  const unsupportedIntent = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-basic-context"] },
    "recommend",
    progress,
    evidence,
    ledger,
  );
  assert(unsupportedIntent.kind === "abstain" && unsupportedIntent.reason === "unsupported-intent",
    "las recomendaciones no deben pasar por el renderizador narrativo");

  const emptyEvidence = renderApprovedClaims(
    { kind: "selection", claimIds: ["claim-basic-context"] },
    "explain",
    progress,
    [],
    ledger,
  );
  assert(emptyEvidence.kind === "abstain", "sin evidencia autorizada no debe existir respuesta");

  console.log("Hoid claim firewall selfcheck: 10 groups passed.");
}

main();
