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
  it("fails closed when the declared frontier extent exceeds the catalog boundary", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "scadrial",
      workIds: ["el-imperio-final"],
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 2,
      requests: [{ contentId: "meta", contentWorldId: "scadrial", requiredPosition: 1 }],
    });
    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });

  it("fails closed when the declared frontier extent is shorter than the catalog boundary", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "taldain",
      workIds: ["arena-blanca-vol-1", "arena-blanca-vol-2", "arena-blanca-vol-3"],
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 2,
      requests: [{ contentId: "meta", contentWorldId: "taldain", requiredPosition: 1 }],
    });
    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });

  it("fails closed instead of throwing when requests are malformed at runtime", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "scadrial",
      workIds: ["el-imperio-final"],
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 1,
      requests: null as unknown as [],
    });
    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });

  it("fails closed instead of throwing when the work collection is malformed at runtime", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "scadrial",
      workIds: null as unknown as [],
      frontierStatus: "in-progress",
      safeCompletedPositions: 1,
      declaredPositions: 1,
      requests: [{ contentId: "meta", contentWorldId: "scadrial", requiredPosition: 1 }],
    });
    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });
});
