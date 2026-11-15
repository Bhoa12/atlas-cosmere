import {
  auditSpoilerDescriptors,
  visibleSpoilerDescriptors,
} from "./cosmereExpansionRun100";

const units = [
  { id: "start", workId: "work", position: 1, sourceId: "catalog", accessible: true },
  { id: "private", workId: "work", position: 2, sourceId: "private", accessible: false },
];

describe("cosmere expansion run 100", () => {
  const descriptors = [
    {
      id: "safe",
      workId: "work",
      sourceId: "catalog",
      requiredUnitIds: ["start"],
      text: "Original metadata-backed descriptor.",
      supportedByAccessibleSource: true,
    },
    {
      id: "private-only",
      workId: "work",
      sourceId: "private",
      requiredUnitIds: ["private"],
      text: "Must remain unavailable.",
      supportedByAccessibleSource: false,
    },
  ];

  it("rejects descriptors whose requirements are not backed by accessible units", () => {
    expect(auditSpoilerDescriptors("work", units, descriptors).accepted.map(item => item.id))
      .toEqual(["safe"]);
  });

  it("fails closed until every requirement is completed", () => {
    expect(visibleSpoilerDescriptors("work", units, { workId: "work", completedUnitIds: [] }, descriptors))
      .toEqual([]);
    expect(visibleSpoilerDescriptors("work", units, { workId: "work", completedUnitIds: ["start"] }, descriptors).map(item => item.id))
      .toEqual(["safe"]);
  });

  it("does not expose content for progress belonging to another work", () => {
    expect(visibleSpoilerDescriptors("work", units, { workId: "other", completedUnitIds: ["start"] }, descriptors))
      .toEqual([]);
  });
});
