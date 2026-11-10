import { describe, expect, it } from "vitest";
import { resolveCatalogSpoilerAccessPlan } from "./catalogSpoilerAccessPlan";

describe("catalog spoiler access plan world reuse", () => {
  const cases = [
    {
      worldId: "scadrial",
      workIds: ["el-imperio-final"],
      contentWorldId: "scadrial",
    },
    {
      worldId: "sel",
      workIds: ["elantris"],
      contentWorldId: "sel",
    },
    {
      worldId: "nalthis",
      workIds: ["el-aliento-de-los-dioses"],
      contentWorldId: "nalthis",
    },
    {
      worldId: "taldain",
      workIds: ["arena-blanca-vol-1"],
      contentWorldId: "taldain",
    },
  ] as const;

  it.each(cases)("resolves the same metadata-only contract for $worldId", ({ worldId, workIds, contentWorldId }) => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId,
      workIds: [...workIds],
      frontierStatus: "complete",
      safeCompletedPositions: 1,
      declaredPositions: 1,
      requests: [{ contentId: "catalog-metadata", contentWorldId, requiredPosition: 1 }],
    });

    expect(result).toEqual({
      status: "resolved",
      boundary: { worldId, workIds: [...workIds] },
      allowedContentIds: ["catalog-metadata"],
    });
  });

  it("does not authorize a request whose world differs from an otherwise valid catalog boundary", () => {
    const result = resolveCatalogSpoilerAccessPlan({
      worldId: "sel",
      workIds: ["elantris"],
      frontierStatus: "complete",
      safeCompletedPositions: 1,
      declaredPositions: 1,
      requests: [{ contentId: "catalog-metadata", contentWorldId: "nalthis", requiredPosition: 1 }],
    });

    expect(result).toEqual({ status: "blocked", boundary: null, allowedContentIds: [] });
  });
});
