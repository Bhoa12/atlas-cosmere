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
  }, {
    id: "also-known",
    aliases: ["Also known"],
    kind: "concept",
    unlock: { bookId: "book", chapter: 1 },
    summary: "Additional synthetic test metadata.",
  }];

  const filtered = filterResponseByAuthorizedKnowledge({
    answer: "Conversational framing.",
    claims: [
      { text: "Supported synthetic claim.", evidenceIds: ["known"] },
      { text: "Unsupported claim.", evidenceIds: ["unknown"] },
      { text: "Mixed evidence.", evidenceIds: ["known", "unknown"] },
      { text: "Repeated synthetic claim.", evidenceIds: ["known", "also-known"] },
      { text: "Repeated synthetic claim.", evidenceIds: ["also-known", "known", "known"] },
    ],
  }, authorized);

  if (filtered.claims.length !== 2) {
    throw new Error("Only distinct claims fully supported by authorized knowledge may pass.");
  }
  if (filtered.claims[0].evidenceIds[0] !== "known") {
    throw new Error("Authorized evidence identifiers must be preserved.");
  }
  if (filtered.claims[1].text !== "Repeated synthetic claim.") {
    throw new Error("A repeated claim must retain one canonical occurrence.");
  }\n  if (filtered.claims[1].evidenceIds.join(",") !== "also-known,known") {\n    throw new Error("Equivalent evidence must leave the boundary in canonical order.");\n  }\n}
