import {
  resolveVisibility,
  validateContentModel,
} from "./cosmereContentModel";

const worlds = [{ id: "scadrial", name: "Scadrial" }];
const works = [{ id: "test-work", title: "Test work", sourceId: "private-index", worldId: "scadrial" }];
const units = [{ id: "test-work-unit-1", workId: "test-work", position: 1 }];

validateContentModel(worlds, works, units);

if (resolveVisibility(["test-work-unit-1"], { workId: "test-work", completedUnitIds: ["test-work-unit-1"] }) !== "visible") {
  throw new Error("Expected completed content to be visible");
}

if (resolveVisibility(["test-work-unit-1"], { workId: "test-work", completedUnitIds: [] }) !== "locked") {
  throw new Error("Expected incomplete content to remain locked");
}

let rejected = false;
try {
  validateContentModel(worlds, works, [
    { id: "duplicate", workId: "test-work", position: 1 },
    { id: "duplicate", workId: "test-work", position: 2 },
  ]);
} catch {
  rejected = true;
}
if (!rejected) throw new Error("Expected duplicate units to be rejected");
