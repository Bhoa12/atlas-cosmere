import { resolveContentVisibility, validateCatalogue } from "./cosmereContentModel";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const worlds = [{ id: "scadrial", name: "Scadrial" }];
const works = [{ id: "work-a", title: "Synthetic work", sourceId: "source-a" }];
const units = [{ id: "unit-1", workId: "work-a", order: 1, label: "Unit 1" }];

assert(validateCatalogue(worlds, works, units).length === 0, "valid synthetic catalogue should pass");
assert(resolveContentVisibility({ workId: "work-a", requiredUnitIds: ["unit-1"] }, { workId: "work-a", completedUnitIds: ["unit-1"] }) === "visible", "completed requirement should be visible");
assert(resolveContentVisibility({ workId: "work-a", requiredUnitIds: ["unit-1"] }, { workId: "work-b", completedUnitIds: ["unit-1"] }) === "locked", "different work progress must remain locked");
assert(validateCatalogue(worlds, works, [
  { id: "unit-1", workId: "work-a", order: 1, label: "Unit 1" },
  { id: "unit-2", workId: "work-a", order: 1, label: "Unit 2" },
]).some((error) => error.includes("duplicated")), "duplicate unit order should fail closed");
