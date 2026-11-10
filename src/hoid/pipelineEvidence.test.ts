import { describe, expect, it, vi } from "vitest";
import { HoidPipeline } from "./pipeline";
import type { HoidKnowledgeEntry } from "./catalog";

const knowledge: HoidKnowledgeEntry[] = [{
  id: "safe-fact",
  aliases: ["safe"],
  kind: "concept",
  firstSafeAppearance: { bookId: "book", chapter: 1 },
  summary: "Synthetic safe knowledge.",
}];

describe("HoidPipeline evidence provider boundary", () => {
  const request = {
    question: "safe",
    reading: [{ bookId: "book", chapter: 1 }],
  };

  it("keeps only claims fully backed by authorized context", async () => {
    const provider = {
      answer: vi.fn(async () => "legacy route must not run"),
      answerWithEvidence: vi.fn(async () => [
        { text: "Supported claim.", evidenceIds: ["safe-fact"] },
        { text: "Unknown evidence.", evidenceIds: ["unknown"] },
        { text: "Mixed evidence.", evidenceIds: ["safe-fact", "unknown"] },
      ]),
    };

    const result = await new HoidPipeline(provider, knowledge).answer(request);

    expect(result.blocked).toBe(false);
    expect(result.text).toBe("Supported claim.");
    expect(provider.answer).not.toHaveBeenCalled();
    expect(provider.answerWithEvidence).toHaveBeenCalledTimes(1);
  });

  it("fails closed when no evidence-backed claim survives", async () => {
    const provider = {
      answer: vi.fn(async () => "legacy route must not run"),
      answerWithEvidence: vi.fn(async () => [
        { text: "Unsupported claim.", evidenceIds: ["unknown"] },
      ]),
    };

    const result = await new HoidPipeline(provider, knowledge).answer(request);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
    expect(provider.answer).not.toHaveBeenCalled();
  });
});
