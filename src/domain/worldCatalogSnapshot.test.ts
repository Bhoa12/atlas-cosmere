import { resolveWorldCatalogSnapshot } from "./worldCatalogSnapshot";

describe("resolveWorldCatalogSnapshot", () => {
  const links = [
    { workId: "work-a", worldId: "world-a" },
    { workId: "work-b", worldId: "world-a" },
    { workId: "work-c", worldId: "world-b" },
  ];
  const sources = [
    { id: "work-a", title: "A", sourceCollectionId: "private", access: "cataloged" as const },
    { id: "work-b", title: "B", sourceCollectionId: "private", access: "verified-structure" as const },
    { id: "work-c", title: "C", sourceCollectionId: "private", access: "cataloged" as const },
  ];

  it("returns only the declared works for one world", () => {
    expect(resolveWorldCatalogSnapshot(links, sources, "world-a")).toEqual({
      status: "cataloged",
      worldId: "world-a",
      works: [
        { workId: "work-a", sourceAccess: "cataloged" },
        { workId: "work-b", sourceAccess: "verified-structure" },
      ],
    });
  });

  it("fails closed when the world has no declared links", () => {
    expect(resolveWorldCatalogSnapshot(links, sources, "unknown")).toEqual({
      status: "blocked", worldId: null, works: [],
    });
  });

  it("fails closed when a linked work lacks source evidence", () => {
    expect(resolveWorldCatalogSnapshot(
      [{ workId: "missing", worldId: "world-a" }],
      sources,
      "world-a",
    )).toEqual({ status: "blocked", worldId: null, works: [] });
  });

  it("does not expose invalid source catalogs", () => {
    expect(resolveWorldCatalogSnapshot(links, [], "world-a").status).toBe("blocked");
  });
});
