import { resolveReadingProgressState } from "./readingProgressState";

const works = ["work-a", "work-b"];
const units = [
  { id: "a-0", workId: "work-a", position: 0 },
  { id: "a-1", workId: "work-a", position: 1 },
  { id: "b-0", workId: "work-b", position: 0 },
];

describe("resolveReadingProgressState", () => {
  it("returns completed units in validated registry order", () => {
    expect(resolveReadingProgressState(works, units, [
      { unitId: "b-0", completed: true },
      { unitId: "a-1", completed: true },
    ])).toEqual({ status: "valid", completedUnitIds: ["a-1", "b-0"] });
  });
  it("fails closed for unknown or duplicate progress", () => {
    expect(resolveReadingProgressState(works, units, [{ unitId: "missing", completed: true }]).status).toBe("blocked");
    expect(resolveReadingProgressState(works, units, [
      { unitId: "a-0", completed: true }, { unitId: "a-0", completed: false },
    ]).status).toBe("blocked");
  });
});
