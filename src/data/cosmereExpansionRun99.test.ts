import { auditReadingRoadmap, roadmapProgress } from "./cosmereExpansionRun99";

const units = [
  { id: "u2", workId: "work", position: 2, sourceId: "source", accessible: true },
  { id: "u1", workId: "work", position: 1, sourceId: "source", accessible: true },
  { id: "private", workId: "work", position: 3, sourceId: "source", accessible: false },
];

describe("cosmere expansion run 99", () => {
  it("accepts only explicit accessible units and preserves their order", () => {
    expect(auditReadingRoadmap("work", units).accepted.map(unit => unit.id)).toEqual(["u1", "u2"]);
  });

  it("keeps progress isolated by work", () => {
    expect(roadmapProgress("work", units, { workId: "other", completedUnitIds: ["u1"] })).toEqual([]);
  });

  it("never returns inaccessible or unknown units as completed", () => {
    expect(roadmapProgress("work", units, { workId: "work", completedUnitIds: ["u2", "private", "missing"] }).map(unit => unit.id)).toEqual(["u2"]);
  });
});
