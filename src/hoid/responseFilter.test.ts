import type { KnowledgeItem } from "./contracts";
import {
  DEFAULT_MAX_PROVIDER_EVIDENCE_ID_LENGTH,
  DEFAULT_MAX_TOTAL_PROVIDER_CLAIM_TEXT_LENGTH,
  filterResponseByAuthorizedKnowledge,
} from "./responseFilter";

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

  const oversizedClaims = Array.from({ length: 129 }, () => ({
    text: "Oversized synthetic claim.",
    evidenceIds: ["known"],
  }));
  if (filterResponseByAuthorizedKnowledge({ claims: oversizedClaims }, authorized).claims.length !== 0) {
    throw new Error("Oversized provider claim payloads must fail closed.");
  }

  const oversizedEvidence = Array.from({ length: 33 }, () => "known");
  if (filterResponseByAuthorizedKnowledge({
    claims: [{ text: "Evidence-heavy synthetic claim.", evidenceIds: oversizedEvidence }],
  }, authorized).claims.length !== 0) {
    throw new Error("Oversized evidence lists must fail closed.");
  }

  const oversizedEvidenceId = "known".padEnd(DEFAULT_MAX_PROVIDER_EVIDENCE_ID_LENGTH + 1, "x");
  if (filterResponseByAuthorizedKnowledge({
    claims: [{ text: "Oversized identifier claim.", evidenceIds: [oversizedEvidenceId] }],
  }, authorized).claims.length !== 0) {
    throw new Error("Oversized evidence identifiers must not cross the response boundary.");
  }

  const aggregateOverflow = [
    { text: "a".repeat(DEFAULT_MAX_TOTAL_PROVIDER_CLAIM_TEXT_LENGTH), evidenceIds: ["known"] },
    { text: "b", evidenceIds: ["known"] },
  ];
  if (filterResponseByAuthorizedKnowledge({ claims: aggregateOverflow }, authorized).claims.length !== 0) {
    throw new Error("Aggregate provider claim text limits must fail closed.");
  }

  const repeatedEvidence = ["also-known", "known", "known"];
  const filtered = filterResponseByAuthorizedKnowledge({
    answer: "Conversational framing.",
    claims: [
      { text: "Supported synthetic claim.", evidenceIds: ["known"] },
      { text: "Unsupported claim.", evidenceIds: ["unknown"] },
      { text: "Mixed evidence.", evidenceIds: ["known", "unknown"] },
      { text: "Repeated synthetic claim.", evidenceIds: ["known", "also-known"] },
      { text: "Repeated synthetic claim.", evidenceIds: repeatedEvidence },
    ],
  }, authorized);

  if (filtered.answer !== "") {
    throw new Error("Free-form provider prose must not bypass evidence validation.");
  }
  if (filtered.claims.length !== 2) {
    throw new Error("Only distinct claims fully supported by authorized knowledge may pass.");
  }
  if (filtered.claims[0].evidenceIds[0] !== "known") {
    throw new Error("Authorized evidence identifiers must be preserved.");
  }
  if (filtered.claims[1].text !== "Repeated synthetic claim.") {
    throw new Error("A repeated claim must retain one canonical occurrence.");
  }
  if (filtered.claims[1].evidenceIds.join(",") !== "also-known,known") {
    throw new Error("Equivalent evidence must leave the boundary in canonical order.");
  }
  if (repeatedEvidence.join(",") !== "also-known,known,known") {
    throw new Error("Filtering provider output must not mutate the provider-owned evidence array.");
  }
}
