import { resolveSpoilerAuthorization } from "./spoilerAuthorization";

const works = ["work-a"];
const units = [
  { id: "a-0", workId: "work-a", position: 0 },
  { id: "a-1", workId: "work-a", position: 1 },
];

describe("resolveSpoilerAuthorization", () => {
  it("authorizes only when every explicit prerequisite is completed", () => {
    expect(resolveSpoilerAuthorization(works, units, [
      { unitId: "a-0", completed: true },
      { unitId: "a-1", completed: true },
    ], { contentId: "content-x", requiredUnitIds: ["a-0", "a-1"] })).toEqual({ status: "authorized" });
  });

  it("withholds when an explicit prerequisite is incomplete", () => {
    expect(resolveSpoilerAuthorization(works, units, [
      { unitId: "a-0", completed: true },
    ], { contentId: "content-x", requiredUnitIds: ["a-0", "a-1"] })).toEqual({ status: "withheld" });
  });

  it("fails closed for unknown, duplicate, or invalid prerequisites", () => {
    expect(resolveSpoilerAuthorization(works, units, [], {
      contentId: "content-x", requiredUnitIds: ["missing"],
    }).status).toBe("blocked");
    expect(resolveSpoilerAuthorization(works, units, [], {
      contentId: "content-x", requiredUnitIds: ["a-0", "a-0"],
    }).status).toBe("blocked");
    expect(resolveSpoilerAuthorization(works, units, [], {
      contentId: "", requiredUnitIds: [],
    }).status).toBe("blocked");
  });
});
