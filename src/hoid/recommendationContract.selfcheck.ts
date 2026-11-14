import { createKnowledgeBoundary } from "./knowledgeBoundary";
import { verifyRecommendations } from "./recommendationContract";

export function recommendationContractSelfCheck(): void {
  const boundary = createKnowledgeBoundary([{ id:"a", workId:"book", chapter:1 }]);
  const result = verifyRecommendations(boundary, [
    { kind:"structural", text:"Continúa a tu ritmo." },
    { kind:"narrative", text:"Comentario respaldado.", evidenceIds:["a"] },
    { kind:"narrative", text:"No debe pasar.", evidenceIds:["future"] },
  ]);
  if (result.accepted.length !== 2 || result.rejected !== 1) {
    throw new Error("Recommendation contract self-check failed");
  }
}
