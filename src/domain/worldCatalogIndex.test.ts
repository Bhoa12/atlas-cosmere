import { describe, expect, it } from "vitest";
import { findWorkIdsForWorld, hasValidWorldCatalogIndex } from "./worldCatalogIndex";

describe("world catalog index", () => {
  const links = [
    { workId: "work-a", worldId: "world-1" },
    { workId: "work-b", worldId: "world-1" },
    { workId: "work-c", worldId: "world-2" },
  ];

  it("accepts unique structural links", () => {
    expect(hasValidWorldCatalogIndex(links)).toBe(true);
    expect(findWorkIdsForWorld(links, "world-1")).toEqual(["work-a", "work-b"]);
  });

  it("fails closed for empty or duplicate links", () => {
    expect(hasValidWorldCatalogIndex([])).toBe(false);
    expect(hasValidWorldCatalogIndex([{ workId: "a", worldId: "x" }, { workId: "a", worldId: "x" }])).toBe(false);
    expect(findWorkIdsForWorld([{ workId: "a", worldId: "x" }, { workId: "a", worldId: "x" }], "x")).toBeNull();
  });

  it("rejects malformed identifiers and unknown worlds", () => {
    expect(hasValidWorldCatalogIndex([{ workId: "", worldId: "x" }])).toBe(false);
    expect(findWorkIdsForWorld(links, "missing")).toBeNull();
  });
});
