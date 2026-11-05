import { recommendUnstartedSources } from "../src/hoid/recommendations";

describe("Hoid metadata-only recommendations", () => {
  it("does not recommend a known source once reading has started", () => {
    const recommendations = recommendUnstartedSources([
      { bookId: "tfe", chapter: 1 },
    ], 24);

    expect(recommendations.some(item => item.sourceId === "tfe")).toBe(false);
  });

  it("ignores progress entries for sources outside the verified bibliography", () => {
    const baseline = recommendUnstartedSources([], 3);
    const withUnknownProgress = recommendUnstartedSources([
      { bookId: "unknown-work", chapter: 999, completed: true },
    ], 3);

    expect(withUnknownProgress).toEqual(baseline);
  });

  it("fails safely for invalid recommendation limits", () => {
    expect(recommendUnstartedSources([], Number.NaN)).toEqual([]);
    expect(recommendUnstartedSources([], Number.POSITIVE_INFINITY)).toEqual([]);
    expect(recommendUnstartedSources([], -1)).toEqual([]);
  });

  it("uses only bibliography metadata in each recommendation", () => {
    const recommendation = recommendUnstartedSources([], 1)[0];

    expect(recommendation).toEqual({
      sourceId: expect.any(String),
      title: expect.any(String),
      reason: "unread-source",
    });
    expect(Object.keys(recommendation).sort()).toEqual([
      "reason",
      "sourceId",
      "title",
    ]);
  });
});
