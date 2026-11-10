import { describe, expect, it } from "vitest";
import { resolveCatalogReadingBoundary } from "./catalogReadingBoundary";

describe("resolveCatalogReadingBoundary", () => {
  it("accepts verified works from the requested world", () => {
    expect(resolveCatalogReadingBoundary("scadrial", [
      "el-imperio-final",
      "el-metal-perdido",
    ])).toEqual({
      worldId: "scadrial",
      workIds: ["el-imperio-final", "el-metal-perdido"],
    });
  });

  it("rejects a work that belongs to another world", () => {
    expect(resolveCatalogReadingBoundary("sel", [
      "elantris",
      "el-aliento-de-los-dioses",
    ])).toBeNull();
  });

  it("rejects duplicate or ambiguous identifiers instead of repairing them", () => {
    expect(resolveCatalogReadingBoundary("taldain", [
      "arena-blanca-vol-1",
      "arena-blanca-vol-1",
    ])).toBeNull();

    expect(resolveCatalogReadingBoundary(" sel", ["elantris"])).toBeNull();
  });

  it("does not assign unassigned catalog works to a world", () => {
    expect(resolveCatalogReadingBoundary("scadrial", [
      "trenza-del-mar-esmeralda",
    ])).toBeNull();
  });
});
