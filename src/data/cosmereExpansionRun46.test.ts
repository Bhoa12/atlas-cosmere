import { validateCatalogue, canReveal } from "./cosmereExpansionRun46";

const sources = [{ id: "private-index", provenance: "verified-index" as const }];
const worlds = [{ id: "scadrial", label: "Scadrial" }];
const works = [{ id: "work-1", title: "Synthetic Work", sourceId: "private-index" }];
const units = [{ id: "unit-1", workId: "work-1", position: 1, label: "Unit 1" }];

if (validateCatalogue(sources, worlds, works, units).length !== 0) throw new Error("valid catalogue rejected");
if (!canReveal({ workId: "work-1", requiredUnitIds: ["unit-1"] }, { workId: "work-1", completedUnitIds: ["unit-1"] }, units)) throw new Error("completed requirement should unlock");
if (canReveal({ workId: "work-1", requiredUnitIds: ["unit-1", "unit-1"] }, { workId: "work-1", completedUnitIds: ["unit-1"] }, units)) throw new Error("duplicate requirements must fail closed");