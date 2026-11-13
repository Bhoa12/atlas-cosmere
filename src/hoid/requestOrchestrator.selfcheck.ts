import { authorizeEvidence, finalizeDraft, freezeReadingProgress } from "./requestOrchestrator";

export function runHoidOrchestratorSelfCheck(): void {
  const progress = freezeReadingProgress([{ workId: "book-a", chapter: 3 }]);
  const evidence = authorizeEvidence(progress, [
    { id: "safe", workId: "book-a", maxChapter: 3 },
    { id: "future", workId: "book-a", maxChapter: 4 },
  ]);

  if (evidence.length !== 1 || evidence[0].id !== "safe") {
    throw new Error("Future evidence was not excluded");
  }

  const result = finalizeDraft(
    { evidenceIds: evidence.map((item) => item.id) },
    { claims: [
      { text: "Información respaldada.", evidenceIds: ["safe"] },
      { text: "Información no autorizada.", evidenceIds: ["future"] },
      { text: "Sin evidencia.", evidenceIds: [] },
    ] },
  );

  if (result.status !== "limited" || result.acceptedClaims.length !== 1 || result.rejectedClaimCount !== 2) {
    throw new Error("Unsafe claims were not filtered");
  }

  let conflictRejected = false;
  try {
    freezeReadingProgress([
      { workId: "book-a", chapter: 2 },
      { workId: "book-a", chapter: 3 },
    ]);
  } catch {
    conflictRejected = true;
  }

  if (!conflictRejected) {
    throw new Error("Conflicting progress did not fail closed");
  }
}
