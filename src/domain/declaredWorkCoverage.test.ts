import { resolveDeclaredWorkCoverage } from "./declaredWorkCoverage";

const catalog = [
  { id: "s1", title: "Source 1", sourceCollectionId: "private", access: "cataloged" as const },
  { id: "s2", title: "Source 2", sourceCollectionId: "private", access: "cataloged" as const },
];

describe("resolveDeclaredWorkCoverage", () => {
  it("separates explicitly covered and pending declared works", () => {
    expect(resolveDeclaredWorkCoverage(
      ["work-b", "work-a"],
      catalog,
      [{ sourceId: "s1", workId: "work-a" }],
    )).toEqual({
      status: "valid",
      coveredWorkIds: ["work-a"],
      pendingWorkIds: ["work-b"],
    });
  });

  it("does not infer coverage from a declared work name", () => {
    expect(resolveDeclaredWorkCoverage(
      ["work-a"],
      catalog,
      [],
    ).pendingWorkIds).toEqual(["work-a"]);
  });

  it("fails closed for unknown binding sources or duplicate declared works", () => {
    expect(resolveDeclaredWorkCoverage(
      ["work-a"],
      catalog,
      [{ sourceId: "missing", workId: "work-a" }],
    ).status).toBe("blocked");
    expect(resolveDeclaredWorkCoverage(
      ["work-a", "work-a"],
      catalog,
      [],
    ).status).toBe("blocked");
  });
});
