import { describe, expect, it } from "vitest";
import { validateSpoilerGateCatalogCoverage } from "./spoilerGateCatalogCoverage";

const worlds = [{
  id: "world",
  name: "World",
  works: [{
    id: "work",
    worldId: "world",
    title: "Work",
    sequence: 1,
    format: "novel",
    units: [
      { id: "u1", workId: "work", order: 1, kind: "chapter", label: "1" },
      { id: "u2", workId: "work", order: 2, kind: "chapter", label: "2" },
    ],
  }],
}];

describe("validateSpoilerGateCatalogCoverage", () => {
  it("accepts requirements that reference declared work coordinates", () => {
    expect(validateSpoilerGateCatalogCoverage(worlds, [{
      id: "gate",
      requirements: [{ workId: "work", requiredPosition: 2 }],
    }])).toEqual([]);
  });

  it("reports unknown works without inventing a replacement", () => {
    expect(validateSpoilerGateCatalogCoverage(worlds, [{
      id: "gate",
      requirements: [{ workId: "missing", requiredPosition: 1 }],
    }])).toEqual([{
      code: "unknown_work",
      gateId: "gate",
      workId: "missing",
    }]);
  });

  it("reports positions absent from declared reading metadata", () => {
    expect(validateSpoilerGateCatalogCoverage(worlds, [{
      id: "gate",
      requirements: [{ workId: "work", requiredPosition: 3 }],
    }])).toEqual([{
      code: "undeclared_position",
      gateId: "gate",
      workId: "work",
      requiredPosition: 3,
    }]);
  });
});
