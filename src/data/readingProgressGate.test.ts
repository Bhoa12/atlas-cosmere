import { canReveal, validateReadingUnits } from "./readingProgressGate";

const units = [
  { id: "u-1", workId: "work-a", position: 1, label: "Unidad 1" },
  { id: "u-2", workId: "work-a", position: 2, label: "Unidad 2" },
];

if (!canReveal({ workId: "work-a", requiredUnitIds: ["u-1"] }, units, { workId: "work-a", completedUnitIds: ["u-1"] })) throw new Error("should reveal");
if (canReveal({ workId: "work-a", requiredUnitIds: ["u-1", "u-1"] }, units, { workId: "work-a", completedUnitIds: ["u-1"] })) throw new Error("duplicate requirements must lock");
if (validateReadingUnits([{ id: "u-1", workId: "work-a", position: 1, label: "A" }, { id: "u-2", workId: "work-a", position: 1, label: "B" }]).length === 0) throw new Error("duplicate positions must fail");
