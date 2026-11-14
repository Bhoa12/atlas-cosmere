import {
  createKnowledgeBoundary,
  type AuthorizedEvidence,
} from "./knowledgeBoundary";
import {
  createProviderRequest,
  verifyProviderResponse,
} from "./providerContract";

const evidence: AuthorizedEvidence[] = [{
  id: "safe-1", workId: "work-a", chapter: 2,
}];

const boundary = createKnowledgeBoundary(evidence);
const request = createProviderRequest(boundary, { text: "Explain safely" });

if (request.allowedEvidenceIds.length !== 1 ||
    request.allowedEvidenceIds[0] !== "safe-1") {
  throw new Error("Provider request did not preserve the request boundary");
}

const verified = verifyProviderResponse(boundary, {
  answer: "A concise answer.",
  claims: [
    { text: "Supported claim", evidenceIds: ["safe-1"] },
    { text: "Future-dependent claim", evidenceIds: ["future-9"] },
    { text: "Mixed claim", evidenceIds: ["safe-1", "future-9"] },
  ],
});

if (verified.acceptedClaims.length !== 1) {
  throw new Error("Unauthorized provider claims were not rejected");
}
if (verified.rejectedClaims !== 2) {
  throw new Error("Rejected provider claim count is incorrect");
}

let emptyPromptRejected = false;
try {
  createProviderRequest(boundary, { text: "   " });
} catch {
  emptyPromptRejected = true;
}
if (!emptyPromptRejected) throw new Error("Empty prompts must fail closed");
