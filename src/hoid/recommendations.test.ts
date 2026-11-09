import { recommendUnstartedSources, recommendUnstartedSourcesFromUnknown } from "./recommendations";

describe("recommendUnstartedSources", () => {
  it("returns metadata-only recommendations for verified sources not yet started", () => {
    const recommendations = recommendUnstartedSources(
      [{ bookId: "tfe", chapter: 1 }],
      2,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every(item => item.reason === "unread-source")).toBe(true);
    expect(recommendations.some(item => item.sourceId === "tfe")).toBe(false);
  });

  it("does not let unknown progress suppress verified recommendations", () => {
    const recommendations = recommendUnstartedSources(
      [{ bookId: "unknown-source", chapter: 999 }],
      1,
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].sourceId).toBe("tfe");
  });

  it("fails closed for invalid limits or malformed reading state", () => {
    expect(recommendUnstartedSources([], Number.NaN)).toEqual([]);
    expect(recommendUnstartedSources([], -1)).toEqual([]);
    expect(recommendUnstartedSourcesFromUnknown({ bookId: "tfe" })).toEqual([]);
  });
});
