import { canReveal, validateCatalogue } from "./cosmereExpansionRun49";

const sources = [{ id: "s", label: "S", kind: "verified-index" as const }];
const worlds = [{ id: "w", label: "W" }];
const works = [{ id: "book", title: "Book", sourceId: "s" }];
const units = [{ id: "u1", workId: "book", position: 1, label: "Unidad 1" }];

if (validateCatalogue(sources, worlds, works, units).length !== 0) throw new Error("valid catalogue rejected");
if (!canReveal({ workId: "book", unitIds: ["u1"] }, { workId: "book", completedUnitIds: ["u1"] }, units)) throw new Error("completed requirement locked");
if (canReveal({ workId: "book", unitIds: ["u1", "u1"] }, { workId: "book", completedUnitIds: ["u1"] }, units)) throw new Error("duplicate requirement revealed");
if (canReveal({ workId: "book", unitIds: ["missing"] }, { workId: "book", completedUnitIds: ["missing"] }, units)) throw new Error("unknown unit revealed");
