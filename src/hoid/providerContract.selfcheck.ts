import { verifyProviderDraft } from "./providerContract";

const context = Object.freeze({ evidenceIds: Object.freeze(["safe-1"]) });
const verified = verifyProviderDraft(context, {
  claims: [
    { text: "Supported claim", evidenceIds: ["safe-1"] },
    { text: "Future claim", evidenceIds: ["future-9"] },
    { text: "Unsourced claim", evidenceIds: [] },
  ],
});

if (verified.length !== 1) throw new Error("Provider boundary accepted unauthorized claims");
if (verified[0].text !== "Supported claim") throw new Error("Provider boundary lost authorized claim");
if (!Object.isFrozen(verified)) throw new Error("Verified output must be immutable");
