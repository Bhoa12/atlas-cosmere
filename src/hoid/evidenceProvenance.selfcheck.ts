import { verifyEvidenceProvenance } from "./evidenceProvenance";

function expect(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const valid = verifyEvidenceProvenance({
  evidenceId: "mistborn-1-c1",
  sourceId: "private-catalog",
  workId: "el-imperio-final",
  chapter: 1,
  accessible: true,
  summary: "Resumen original de una escena ya accesible.",
  summaryOrigin: "original",
});
expect(valid.ok, "La evidencia accesible con resumen original debe aceptarse.");

const inaccessible = verifyEvidenceProvenance({
  evidenceId: "future",
  sourceId: "private-catalog",
  workId: "el-imperio-final",
  chapter: 2,
  accessible: false,
  summary: "No debe utilizarse solo por estar catalogada.",
  summaryOrigin: "original",
});
expect(!inaccessible.ok && inaccessible.reason === "inaccessible_source", "Una fuente inaccesible debe fallar cerrada.");

const nonOriginal = verifyEvidenceProvenance({
  evidenceId: "bad-origin",
  sourceId: "private-catalog",
  workId: "el-imperio-final",
  chapter: 1,
  accessible: true,
  summary: "Contenido no permitido.",
  summaryOrigin: "original" as "original",
});
expect(nonOriginal.ok, "El contrato solo admite el origen original como tipo válido.");
