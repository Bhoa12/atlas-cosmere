import { createRequestAudit, summarizeAudit } from "./requestAudit";

const audit = createRequestAudit("request-42", [
  { stage: "context_selected", outcome: "accepted", evidenceIds: ["ev-1", "ev-1"] },
  { stage: "output_verified", outcome: "limited", evidenceIds: ["ev-1"], reasonCode: "unverified_claims_removed" },
]);

if (audit.events[0].evidenceIds.length !== 1) {
  throw new Error("duplicate evidence ids must be deduplicated");
}

const summary = summarizeAudit(audit);
if (summary.stages !== 2 || summary.abstained || !summary.limited) {
  throw new Error("audit summary must reflect decisions without narrative content");
}

let rejected = false;
try {
  createRequestAudit("request-43", [
    { stage: "context_selected", outcome: "rejected", evidenceIds: ["   "] },
  ]);
} catch (error) {
  rejected = error instanceof Error && error.message === "invalid_evidence_id";
}

if (!rejected) throw new Error("blank evidence identifiers must fail closed");
