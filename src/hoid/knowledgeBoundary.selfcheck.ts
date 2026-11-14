import {
  createKnowledgeBoundary,
  verifyEvidenceReferences,
} from "./knowledgeBoundary";

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const boundary = createKnowledgeBoundary([
  { id: "mistborn-1-c3-a", workId: "mistborn-1", chapter: 3 },
  { id: "mistborn-1-c3-a", workId: "mistborn-1", chapter: 3 },
  { id: "stormlight-1-c2-a", workId: "stormlight-1", chapter: 2 },
]);

expect(boundary.evidenceIds.length === 2, "duplicate evidence must collapse");
expect(boundary.allows("mistborn-1-c3-a"), "authorized evidence must be allowed");
expect(!boundary.allows("future-c99"), "unknown evidence must be denied");

const refs = verifyEvidenceReferences(boundary, [
  "future-c99",
  "stormlight-1-c2-a",
  "stormlight-1-c2-a",
]);
expect(refs.length === 1 && refs[0] === "stormlight-1-c2-a",
  "only unique authorized references may survive");

let invalidRejected = false;
try {
  createKnowledgeBoundary([{ id: "x", workId: "book", chapter: 0 }]);
} catch {
  invalidRejected = true;
}
expect(invalidRejected, "invalid chapter must fail closed");

const snapshot = boundary.evidenceIds as string[];
let mutationBlocked = false;
try {
  snapshot.push("future-c99");
} catch {
  mutationBlocked = true;
}
expect(mutationBlocked || !boundary.allows("future-c99"),
  "snapshot mutation must not mint new authorization");

export const knowledgeBoundarySelfcheck = "ok";
