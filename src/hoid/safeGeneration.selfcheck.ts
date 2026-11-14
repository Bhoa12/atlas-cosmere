import { generateSafely } from "./safeGeneration";
import type { HoidProvider, ProviderRequest } from "./providerContract";

const seen: ProviderRequest[] = [];
const provider: HoidProvider = { async generate(request) {
  seen.push(request);
  return { claims: [
    { text: "Safe", evidenceIds: ["safe-1"] },
    { text: "Injected future knowledge", evidenceIds: ["future-2"] },
  ] };
}};

const result = await generateSafely(provider, {
  question: "Explain safely", progress: { book: 3 },
  evidence: [
    { id: "safe-1", workId: "book", chapter: 3 },
    { id: "future-2", workId: "book", chapter: 4 },
  ],
});

if (seen.length !== 1 || seen[0].context.evidenceIds.join(",") !== "safe-1") throw new Error("Provider received unauthorized evidence");
if (result.status !== "authorized" || result.claims.length !== 1) throw new Error("Unsafe provider claim was not filtered");

let called = false;
const abstainingProvider: HoidProvider = { async generate() { called = true; return { claims: [] }; } };
const abstained = await generateSafely(abstainingProvider, {
  question: "Future only", progress: { book: 1 },
  evidence: [{ id: "future", workId: "book", chapter: 2 }],
});
if (called || abstained.status !== "abstain" || abstained.claims.length !== 0) throw new Error("Missing safe context must abstain without provider call");