import { verifyClaims } from "./providerContract";
import { filterVisibleClaims } from "./spoilerFilter";

// Lightweight executable examples that can be migrated to the project's test
// runner without changing the production contracts.
const result = verifyClaims(
  [
    { text: "A respaldada", evidenceIds: ["e1"] },
    { text: "B no autorizada", evidenceIds: ["future"] },
    { text: "C sin evidencia", evidenceIds: [] },
  ],
  ["e1"],
);

if (result.accepted.length !== 1 || result.rejected.length !== 2) {
  throw new Error("Claim verification must fail closed.");
}

const filtered = filterVisibleClaims(result.accepted, result.rejected.length);
if (filtered.status !== "limited" || filtered.claims.length !== 1) {
  throw new Error("Mixed drafts must expose only verified claims.");
}
