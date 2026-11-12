import { resolveContentAccess } from "./contentAccessBoundary";

const content = {
  id: "sample-content",
  workId: "sample-work",
  requiredUnitIds: ["sample-work-unit-1"],
};

if (
  resolveContentAccess(content, {
    workId: "sample-work",
    completedUnitIds: ["sample-work-unit-1"],
  }) !== "visible"
) {
  throw new Error("Expected matching completed progress to unlock content");
}

if (
  resolveContentAccess(content, {
    workId: "other-work",
    completedUnitIds: ["sample-work-unit-1"],
  }) !== "locked"
) {
  throw new Error("Expected progress from another work to remain locked");
}

if (
  resolveContentAccess(
    { ...content, requiredUnitIds: ["sample-work-unit-1", "sample-work-unit-1"] },
    { workId: "sample-work", completedUnitIds: ["sample-work-unit-1"] },
  ) !== "locked"
) {
  throw new Error("Expected duplicate requirements to fail closed");
}
