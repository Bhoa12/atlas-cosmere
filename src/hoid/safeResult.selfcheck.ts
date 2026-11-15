import { abstain, answer } from "./safeResult";

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const empty = answer("   ", ["ev-1"]);
expect(empty.kind === "abstain", "Empty narrative must fail closed");

const missingEvidence = answer("Una respuesta", []);
expect(missingEvidence.kind === "abstain", "Ungrounded narrative must fail closed");

const grounded = answer("Resumen original respaldado.", ["ev-1"]);
expect(grounded.kind === "answer", "Grounded answer should be accepted");
if (grounded.kind === "answer") {
  expect(grounded.evidenceIds.length === 1, "Evidence must be preserved");
}

const blocked = abstain("no_authorized_evidence");
expect(blocked.kind === "abstain", "Explicit abstention must remain structured");
