import { canReveal, normalizeProgress, worksForWorld, AtlasCatalog } from "./cosmereExpansionRun59";

const catalog: AtlasCatalog = {
  worlds: [{ id: "scadrial", label: "Scadrial", workIds: ["work-a"] }],
  works: [{ id: "work-a", title: "Obra de prueba", sourceId: "index", worldId: "scadrial" }],
  units: [
    { id: "u1", workId: "work-a", position: 1, label: "Unidad 1" },
    { id: "u2", workId: "work-a", position: 2, label: "Unidad 2" },
  ],
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

assert(worksForWorld(catalog, "scadrial").length === 1, "explicit navigation should resolve");
assert(normalizeProgress(catalog, { workId: "work-a", completedUnitIds: ["u1", "unknown", "u1"] }).completedUnitIds.length === 1, "unknown and duplicate progress should be removed");
assert(!canReveal(catalog, { workId: "work-a", completedUnitIds: ["u1", "unknown"] }, { workId: "work-a", requiredUnitIds: ["u1", "u2"] }), "incomplete progress must stay locked");
assert(canReveal(catalog, { workId: "work-a", completedUnitIds: ["u1", "u2", "unknown"] }, { workId: "work-a", requiredUnitIds: ["u1", "u2"] }), "all known requirements should unlock");
assert(worksForWorld({ ...catalog, works: [{ ...catalog.works[0], worldId: "sel" }] }, "scadrial").length === 0, "conflicting metadata must not infer a relationship");
