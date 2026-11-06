import { recommendUnstartedSources } from "./recommendations";

describe("recommendation progress handling", () => {
  it("treats completion as started even without a chapter", () => {
    const baseline = recommendUnstartedSources([], 1)[0];
    const recommendations = recommendUnstartedSources(
      [{ bookId: baseline.sourceId, completed: true }],
      1,
    );

    expect(recommendations[0].sourceId).not.toBe(baseline.sourceId);
  });

  it("does not let unknown reading entries affect recommendations", () => {
    const baseline = recommendUnstartedSources([], 2);
    const recommendations = recommendUnstartedSources(
      [{ bookId: "unknown-source", chapter: 999 }],
      2,
    );

    expect(recommendations).toEqual(baseline);
  });

  it("returns an empty result for invalid limits", () => {
    expect(recommendUnstartedSources([], Number.NaN)).toEqual([]);
    expect(recommendUnstartedSources([], -1)).toEqual([]);
  });
});
