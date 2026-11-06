import { recommendUnstartedSources } from "./recommendations";

describe("recommendation isolation", () => {
  it("returns fresh recommendation snapshots that callers can safely mutate", () => {
    const first = recommendUnstartedSources([], 1);
    const originalTitle = first[0].title;

    first[0].title = "mutated";
    const second = recommendUnstartedSources([], 1);

    expect(second[0].title).toBe(originalTitle);
    expect(second[0].title).not.toBe("mutated");
  });

  it("does not let recommendation results expose bibliography objects", () => {
    const first = recommendUnstartedSources([], 1);
    const second = recommendUnstartedSources([], 1);

    expect(first[0]).not.toBe(second[0]);
  });
});
