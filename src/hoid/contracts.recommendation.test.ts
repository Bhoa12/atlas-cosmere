import { describe, expect, it } from "vitest";
import { safeCatalogRecommendation } from "./contracts";

describe("safeCatalogRecommendation", () => {
  it("fails closed when catalog metadata is ambiguous for the requested id", () => {
    const result = safeCatalogRecommendation(
      "mistborn-final-empire",
      [
        { id: "mistborn-final-empire", title: "El Imperio Final" },
        { id: "mistborn-final-empire", title: "Conflicting title" },
      ],
      { "mistborn-final-empire": 10 },
    );

    expect(result).toBeNull();
  });

  it("keeps a unique catalog recommendation independent from unrelated entries", () => {
    const result = safeCatalogRecommendation(
      "mistborn-final-empire",
      [
        { id: "mistborn-final-empire", title: "El Imperio Final" },
        { id: "elantris", title: "Elantris" },
      ],
      {},
    );

    expect(result).toEqual({
      bookId: "mistborn-final-empire",
      title: "El Imperio Final",
      reason: "catalog-availability",
    });
  });
});
