import { createGate, mergeProgress, validateCatalog } from "./cosmereExpansionRun60";

const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};

const catalog = {
  sources: [{ id: "index", provenance: "verified-index" as const, label: "Índice verificado" }],
  worlds: [{ id: "scadrial", label: "Scadrial" }],
  works: [{ id: "work-a", title: "Obra de prueba", sourceId: "index" }],
  units: [
    { id: "u1", workId: "work-a", position: 1, label: "Unidad 1" },
    { id: "u2", workId: "work-a", position: 2, label: "Unidad 2" },
  ],
};

assert(validateCatalog(catalog).length === 0, "valid metadata should pass");
assert(validateCatalog({ ...catalog, works: [{ ...catalog.works[0], sourceId: "missing" }] }).some((p) => p.includes("unknown source")), "unknown sources must be reported");

const merged = mergeProgress(catalog, "work-a", [
  { workId: "work-a", completedUnitIds: ["u1", "unknown"] },
  { workId: "other", completedUnitIds: ["u2"] },
  { workId: "work-a", completedUnitIds: ["u2", "u1"] },
]);
assert(merged.completedUnitIds.length === 2, "only known same-work progress should merge");

assert(createGate(catalog.units, "work-a", ["u1", "u2"]) !== undefined, "valid explicit requirements should create a gate");
assert(createGate(catalog.units, "work-a", ["u1", "u1"]) === undefined, "duplicate requirements must be rejected");
assert(createGate(catalog.units, "work-a", ["unknown"]) === undefined, "unknown requirements must be rejected");
