import type { KnowledgeItem } from "./contracts";
import { filterResponseByAuthorizedKnowledge } from "./responseFilter";

/**
 * Framework-neutral invariant checks for the final response boundary.
 * A future test runner can invoke this function directly.
 */
export function responseFilterInvariants(): void {
  const authorized: KnowledgeItem[] = [{
    id: "known",
    aliases: ["Known"],
    kind: "concept",
    unlock: { bookId: "book", chapter: 1 },
    summary: "Synthetic test metadata.",
  }];

  const filtered = filterResponseByAuthorizedKnowledge({
    answer: "Conversational framing.",
    claims: [
      { text: "Supported synthetic claim.", evidenceIds: ["known"] },
      { text: "Unsupported claim.", evidenceIds: ["unknown"] },
      { text: "Mixed evidence.", evidenceIds: ["known", "unknown"] },
    ],
  }, authorized);

  if (filtered.claims.length !== 1) {
    throw new Error("Only claims fully supported by authorized knowledge may pass.");
  }
  if (filtered.claims[0].evidenceIds[0] !== "known") {
    throw new Error("Authorized evidence identifiers must be preserved.");
  }
}
