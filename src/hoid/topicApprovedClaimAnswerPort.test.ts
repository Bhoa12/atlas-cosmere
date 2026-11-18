import { describe, expect, it, vi } from "vitest";
import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
  type HoidClaimSelectionRequest,
} from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";
import { getHoidReadingManifest } from "./readingManifest";
import { presentHoidEvidenceAnswer } from "./answerPresentation";
import { createHoidApprovedClaimAnswerPort } from "./topicApprovedClaimAnswerPort";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = result.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic locator unavailable");
  return unit.locatorId;
}

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Synthetic Alpha"],
    kind: "concept",
    firstSafeAppearance: { bookId: "twok", chapter: 2 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 2 },
    provenance: "verified",
    summary: "Original synthetic editorial summary for test coverage.",
  },
  {
    id: "e-beta",
    aliases: ["Synthetic Beta"],
    kind: "phenomenon",
    firstSafeAppearance: { bookId: "wor", chapter: 3 },
    evidenceSource: { bookId: "wor", chapter: 3, locatorId: locator("wor", 3) },
    evidenceUnlock: { bookId: "wor", chapter: 3 },
    provenance: "verified",
    summary: "Second original synthetic editorial summary for test coverage.",
  },
];

const review: HoidApprovedClaim["review"] = {
  status: "approved",
  origin: "original-editorial",
  reviewerId: "synthetic-editor",
  reviewedAt: "2026-11-18T18:00:00.000Z",
};

const claims: HoidApprovedClaim[] = [
  {
    id: "claim-topic",
    text: "An original synthetic recommendation reason backed by one approved source.",
    intent: "recommend",
    evidenceIds: ["e-alpha"],
    review,
  },
  {
    id: "claim-cross-book",
    text: "An original synthetic recommendation reason requiring both source works.",
    intent: "recommend",
    evidenceIds: ["e-alpha", "e-beta"],
    review,
  },
  {
    id: "claim-explain",
    text: "An explanation claim must not be rendered through the recommendation port.",
    intent: "explain",
    evidenceIds: ["e-alpha"],
    review,
  },
];

function createPort(selector = vi.fn(async (_request: HoidClaimSelectionRequest) => [])) {
  const runtime = createHoidEvidenceRuntime({
    knowledge,
    claims,
    selector: { selectClaims: selector },
  });
  if (!runtime) throw new Error("Synthetic evidence runtime unavailable");
  const port = createHoidApprovedClaimAnswerPort(runtime);
  if (!port) throw new Error("Local approved-claim port unavailable");
  return { port, selector };
}

describe("Hoid local approved-claim answer port", () => {
  it("renders exact approved recommendation text and per-claim evidence without invoking a selector", () => {
    const { port, selector } = createPort();
    const result = port(["claim-topic"], [{ bookId: "twok", chapter: 2 }]);

    expect(result).toHaveLength(1);
    expect(result[0].claimId).toBe("claim-topic");
    expect(result[0].answer).toMatchObject({
      status: "authorized",
      text: claims[0].text,
      claimIds: ["claim-topic"],
      evidenceIds: ["e-alpha"],
      layout: "plain",
      segments: [{
        claimId: "claim-topic",
        text: claims[0].text,
        evidenceIds: ["e-alpha"],
      }],
    });
    expect(result[0].answer.sources).toEqual([{
      evidenceId: "e-alpha",
      sourceBookId: "twok",
      sourceChapter: 2,
      locatorId: locator("twok", 2),
      unlockBookId: "twok",
      unlockChapter: 2,
    }]);
    const presented = presentHoidEvidenceAnswer(result[0].answer, [{ bookId: "twok", chapter: 2 }]);
    expect(presented.status).toBe("ready");
    if (presented.status === "ready") {
      expect(presented.segments).toHaveLength(1);
      expect(presented.segments?.[0].claimId).toBe("claim-topic");
      expect(presented.segments?.[0].citations[0].evidenceId).toBe("e-alpha");
    }
    expect(selector).not.toHaveBeenCalled();
  });

  it("withholds a claim until its source work reaches the claim's own unlock chapter", () => {
    const { port } = createPort();
    expect(port(["claim-topic"], [{ bookId: "twok", chapter: 1 }])).toEqual([]);
    expect(port(["claim-topic"], [{ bookId: "twok", chapter: 2 }])).toHaveLength(1);
  });

  it("requires every cross-book evidence item to be unlocked independently", () => {
    const { port } = createPort();
    expect(port(
      ["claim-cross-book"],
      [
        { bookId: "twok", chapter: 2 },
        { bookId: "wor", chapter: 2 },
      ],
    )).toEqual([]);

    const authorized = port(
      ["claim-cross-book"],
      [
        { bookId: "twok", chapter: 2 },
        { bookId: "wor", chapter: 3 },
      ],
    );
    expect(authorized).toHaveLength(1);
    expect(authorized[0].answer.evidenceIds).toEqual(["e-alpha", "e-beta"]);
    expect(authorized[0].answer.sources.map(source => source.sourceBookId)).toEqual(["twok", "wor"]);
  });

  it("does not render claims with an intent other than recommend", () => {
    const { port } = createPort();
    expect(port(["claim-explain"], [{ bookId: "twok", chapter: 2 }])).toEqual([]);
  });

  it("rejects duplicate, sparse and malformed claim ID batches", () => {
    const { port } = createPort();
    const progress = [{ bookId: "twok", chapter: 2 }];
    expect(port(["claim-topic", "claim-topic"], progress)).toEqual([]);
    expect(port(["claim topic"], progress)).toEqual([]);
    const sparse = new Array(1) as unknown as readonly string[];
    expect(port(sparse, progress)).toEqual([]);
  });

  it("returns no port when the editorial runtime is unavailable", () => {
    expect(createHoidApprovedClaimAnswerPort(null)).toBeUndefined();
  });
});
