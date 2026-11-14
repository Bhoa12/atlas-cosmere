import { verifyDraftAtomically } from "./draftIntegrity";

const context = { evidenceIds: ["safe-a", "safe-b"] } as const;

const accepted = verifyDraftAtomically(context, {
  claims: [{ text: "Explicación respaldada.", evidenceIds: ["safe-a"] }],
});
if (accepted.status !== "accepted") throw new Error("Expected authorized draft to pass");

const mixed = verifyDraftAtomically(context, {
  claims: [
    { text: "Parte segura.", evidenceIds: ["safe-a"] },
    { text: "Parte no autorizada.", evidenceIds: ["future-x"] },
  ],
});
if (mixed.status !== "rejected" || mixed.reason !== "invalid-claim") {
  throw new Error("Mixed draft must fail atomically");
}

const empty = verifyDraftAtomically(context, { claims: [] });
if (empty.status !== "rejected" || empty.reason !== "empty-draft") {
  throw new Error("Empty draft must fail closed");
}
