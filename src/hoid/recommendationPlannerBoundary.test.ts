import { describe, expect, it } from "vitest";
import { planSafeCatalogRecommendations } from "./recommendationBoundary";

const catalog = [
  { id: "mistborn-1", title: "El Imperio Final" },
  { id: "elantris", title: "Elantris" },
] as const;

describe("planSafeCatalogRecommendations", () => {
  it("returns only catalog-backed metadata and never invents narrative reasons", () => {
    expect(planSafeCatalogRecommendations(
      ["mistborn-1", "unknown", "mistborn-1", "elantris"],
      catalog,
      { "mistborn-1": 12 },
    )).toEqual([
      { bookId: "mistborn-1", title: "El Imperio Final", reason: "recorded-reading-continuity" },
      { bookId: "elantris", title: "Elantris", reason: "catalog-availability" },
    ]);
  });

  it("fails closed for oversized or malformed candidate batches", () => {
    expect(planSafeCatalogRecommendations(Array.from({ length: 65 }, (_, index) => "book-" + index), catalog, {})).toEqual([]);
    expect(planSafeCatalogRecommendations("mistborn-1", catalog, {})).toEqual([]);
    expect(planSafeCatalogRecommendations(["mistborn-1"], catalog, {}, 0)).toEqual([]);
  });

  it("preserves catalog ambiguity protections", () => {
    const ambiguous = [
      { id: "elantris", title: "Elantris" },
      { id: "elantris", title: "Otro título" },
    ];

    expect(planSafeCatalogRecommendations(["elantris"], ambiguous, {})).toEqual([]);
  });
});
