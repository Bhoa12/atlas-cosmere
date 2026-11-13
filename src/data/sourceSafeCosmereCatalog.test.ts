import {
  evaluateSpoilerGate,
  normalizeProgress,
  sourceSafeCatalog,
  validateCatalog,
} from "./sourceSafeCosmereCatalog";

const units = [
  { id: "u1", workId: "w1", position: 1, label: "Unidad 1" },
  { id: "u2", workId: "w1", position: 2, label: "Unidad 2" },
];

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

export function runSourceSafeCosmereCatalogTests() {
  assert(validateCatalog(
    [{ id: "s1", label: "Fuente", kind: "verified-index" }],
    [{ id: "world", label: "Mundo", priority: 1 }],
    [{ id: "w1", title: "Obra", sourceId: "s1" }],
    units,
  ).length === 0, "El catálogo sintético debería ser válido");

  const normalized = normalizeProgress(
    { workId: "w1", completedUnitIds: ["u1", "u1", "unknown"] },
    units,
  );
  assert(normalized.completedUnitIds.length === 1 && normalized.completedUnitIds[0] === "u1",
    "El progreso debe eliminar duplicados y unidades desconocidas");

  const incomplete = evaluateSpoilerGate(
    { workId: "w1", requiredUnitIds: ["u1", "u2"] },
    normalized,
    units,
  );
  assert(!incomplete.allowed && incomplete.reason === "incomplete",
    "La puerta debe permanecer cerrada con lectura incompleta");

  const complete = evaluateSpoilerGate(
    { workId: "w1", requiredUnitIds: ["u1", "u2"] },
    { workId: "w1", completedUnitIds: ["u1", "u2"] },
    units,
  );
  assert(complete.allowed, "La puerta debe abrirse al completar todos los requisitos");

  const invalidGate = evaluateSpoilerGate(
    { workId: "w1", requiredUnitIds: ["u1", "u1"] },
    { workId: "w1", completedUnitIds: ["u1"] },
    units,
  );
  assert(!invalidGate.allowed && invalidGate.reason === "invalid-gate",
    "Los requisitos duplicados deben bloquear el contenido");

  assert(sourceSafeCatalog.works.every((work) => !("worldId" in work)),
    "El catálogo semilla no debe inferir mundos a partir de títulos");
}
