import { runSafetyPipeline, type NarrativeProvider } from "./safetyPipeline";

const request = {
  question: " ¿Qué significa este concepto? ",
  workId: "mistborn-final-empire",
  maxChapter: 3,
  evidence: [{ id: "e1", chapter: 3, summary: "Resumen original autorizado." }],
};

const safe: NarrativeProvider = { answer: async () => ({ text: "Explicación segura.", evidenceIds: ["e1"] }) };
const contaminated: NarrativeProvider = { answer: async () => ({ text: "Spoiler potencial.", evidenceIds: ["future"] }) };

export async function selfCheckSafetyPipeline(): Promise<void> {
  const accepted = await runSafetyPipeline(request, safe);
  if (accepted.kind !== "answer") throw new Error("Expected authorized answer");

  const rejected = await runSafetyPipeline(request, contaminated);
  if (rejected.kind !== "abstain" || rejected.reason !== "unverified-draft") {
    throw new Error("Expected fail-closed rejection");
  }

  const empty = await runSafetyPipeline({ ...request, evidence: [] }, safe);
  if (empty.kind !== "abstain" || empty.reason !== "no-evidence") throw new Error("Expected abstention without evidence");
}
