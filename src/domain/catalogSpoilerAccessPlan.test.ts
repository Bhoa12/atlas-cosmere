import { describe, expect, it } from "vitest";
import { resolveCatalogSpoilerAccessPlan } from "./catalogSpoilerAccessPlan";

describe("resolveCatalogSpoilerAccessPlan", () => {
  it("composes a verified Scadrial boundary with an in-progress spoiler frontier", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "scadrial",
      workIds: ["el-imperio-final", "el-pozo-de-la-ascension"],
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 2,
      requests: [
        { contentId: "meta-1", contentWorldId: "scadrial", requiredPosition: 1 },
        { contentId: "meta-2", contentWorldId: "scadrial", requiredPosition: 2 },
      ],
    });
    expect(result).toEqual({
      status: "resolved",
      boundary: { worldId: "scadrial", workIds: ["el-imperio-final", "el-pozo-de-la-ascension"] },
      allowedContentIds: ["meta-1"],
    });
  });

  it("fails closed when the work boundary mixes worlds", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "sel",
      workIds: ["elantris", "el-aliento-de-los-dioses"],
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 2,
      requests: [{ contentId: "meta", contentWorldId: "sel", requiredPosition: 1 }],
    });
    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });

  it("fails closed when the spoiler frontier is inconsistent", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "nalthis",
      workIds: ["el-aliento-de-los-dioses"],
      frontierStatus: "complete",
      safeCompletedPositions: 0,
      declaredPositions: 1,
      requests: [{ contentId: "meta", contentWorldId: "nalthis", requiredPosition: 1 }],
    });
    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });
});
