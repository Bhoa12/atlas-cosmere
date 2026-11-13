import { authorizeResponseEvidence, responseStatus } from "./responsePolicy";

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Hoid response policy self-check failed: ${message}`);
}

const progress = { "mistborn-1": 3 };
const evidence = [
  { id: "safe", workId: "mistborn-1", chapter: 3 },
  { id: "future", workId: "mistborn-1", chapter: 4 },
  { id: "unknown", workId: "unknown-work", chapter: 1 },
  { id: "safe", workId: "mistborn-1", chapter: 2 },
  { id: "invalid", workId: "mistborn-1", chapter: 0 },
];

const authorized = authorizeResponseEvidence({
  mode: "explain",
  progress,
  evidence,
});

expect(authorized.length === 1, "only one evidence item should survive");
expect(authorized[0].id === "safe", "future, unknown, invalid and duplicate evidence must be denied");
expect(
  responseStatus({
    mode: "explain",
    progress: { "mistborn-1": 1 },
    evidence: [{ id: "future-only", workId: "mistborn-1", chapter: 2 }],
  }) === "abstain",
  "a response with no authorized evidence must abstain",
);

console.info("Hoid response policy self-check passed.");
