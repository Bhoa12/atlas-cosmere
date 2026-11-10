import { describe, expect, it } from "vitest";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { resolveCatalogCompositeSpoilerGate } from "./catalogCompositeSpoilerGate";

const scadrial: WorldCatalogEntry = {
  id: "scadrial",
  name: "Scadrial",
  works: [
    {
      id: "el-imperio-final",
      worldId: "scadrial",
      title: "El Imperio Final",
      sequence: 1,
      format: "novel",
      units: [{ id: "ef-1", workId: "el-imperio-final", order: 1, kind: "chapter", label: "1" }],
    },
    {
      id: "el-pozo-de-la-ascension",
      worldId: "scadrial",
      title: "El Pozo de la Ascensión",
      sequence: 2,
      format: "novel",
      units: [{ id: "pa-1", workId: "el-pozo-de-la-ascension", order: 1, kind: "chapter", label: "1" }],
    },
  ],
};

const sel: WorldCatalogEntry = {
  id: "sel",
  name: "Sel",
  works: [{
    id: "elantris",
    worldId: "sel",
    title: "Elantris",
    sequence: 1,
    format: "novel",
    units: [{ id: "el-1", workId: "elantris", order: 1, kind: "chapter", label: "1" }],
  }],
};

describe("resolveCatalogCompositeSpoilerGate", () => {
  it("unlocks only after catalog-declared requirements are reached", () => {
    const result = resolveCatalogCompositeSpoilerGate(
      [scadrial, sel],
      "scadrial",
      {
        id: "cross-work-meta",
        requirements: [
          { workId: "el-imperio-final", requiredPosition: 1 },
          { workId: "el-pozo-de-la-ascension", requiredPosition: 1 },
        ],
      },
      [
        { workId: "el-imperio-final", completedPositions: [1, 99] },
        { workId: "el-pozo-de-la-ascension", completedPositions: [1] },
      ],
    );

    expect(result).toEqual({
      status: "resolved",
      unlocked: true,
      constrainedProgress: [
        { workId: "el-imperio-final", completedPositions: [1] },
        { workId: "el-pozo-de-la-ascension", completedPositions: [1] },
      ],
    });
  });

  it("fails closed when a gate reaches outside the selected world", () => {
    const result = resolveCatalogCompositeSpoilerGate(
      [scadrial, sel],
      "scadrial",
      { id: "mixed-world", requirements: [{ workId: "elantris", requiredPosition: 1 }] },
      [{ workId: "elantris", completedPositions: [1] }],
    );

    expect(result).toEqual({ status: "blocked", unlocked: false, constrainedProgress: [] });
  });

  it("fails closed for a non-canonical world id", () => {
    const result = resolveCatalogCompositeSpoilerGate(
      [scadrial],
      " scadrial ",
      { id: "meta", requirements: [{ workId: "el-imperio-final", requiredPosition: 1 }] },
      [{ workId: "el-imperio-final", completedPositions: [1] }],
    );

    expect(result).toEqual({ status: "blocked", unlocked: false, constrainedProgress: [] });
  });
});
