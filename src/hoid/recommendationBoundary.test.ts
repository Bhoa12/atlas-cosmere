import {
  recommendUnstartedSourcesFromUnknown,
} from "./recommendations";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";

describe("runtime-safe recommendations", () => {
  it("fails closed when reading is not an array", () => {
    expect(recommendUnstartedSourcesFromUnknown(null)).toEqual([]);
  });

  it("fails closed on duplicate positions instead of merging progress", () => {
    const sourceId = HOID_SOURCE_BIBLIOGRAPHY[0].id;

    expect(
      recommendUnstartedSourcesFromUnknown([
        { bookId: sourceId, chapter: 1 },
        { bookId: sourceId, completed: true },
      ]),
    ).toEqual([]);
  });

  it("uses canonical valid progress for metadata-only recommendations", () => {
    const sourceId = HOID_SOURCE_BIBLIOGRAPHY[0].id;
    const recommendations = recommendUnstartedSourcesFromUnknown([
      { bookId: sourceId, chapter: 1 },
      { bookId: "unknown-book", chapter: 99 },
    ], 3);

    expect(recommendations).toHaveLength(3);
    expect(recommendations.some(item => item.sourceId === sourceId)).toBe(false);
  });
});
