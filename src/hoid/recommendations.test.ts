import { recommendUnstartedSources } from "./recommendations";

describe("recommendUnstartedSources", () => {
  it("returns metadata-only recommendations for sources not yet started", () => {
    const recommendations = recommendUnstartedSources(
      [{ bookId: "mistborn-final-empire", chapter: 1 }],
      2,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every(item => item.reason === "unread-source")).toBe(true);
    expect(recommendations.some(item => item.sourceId === "mistborn-final-empire")).toBe(false);
  });

  it("fails closed for invalid limits", () => {
    expect(recommendUnstartedSources([], Number.NaN)).toEqual([]);
    expect(recommendUnstartedSources([], -1)).toEqual([]);
  });
});
