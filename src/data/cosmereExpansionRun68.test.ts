import { describe, expect, it } from "vitest";
import { revealContent, validateCatalog } from "./cosmereExpansionRun68";

describe("cosmere expansion run68", () => {
  const sources = [{ id: "index", label: "Índice", access: "verified-index" as const }];
  const worlds = [{ id: "scadrial", label: "Scadrial" }];
  const works = [{ id: "work", title: "Título", sourceId: "index" }];
  const units = [{ id: "u1", workId: "work", position: 1, label: "Unidad", sourceId: "index" }];

  it("accepts metadata-only catalog entries without editorial summaries", () => {
    expect(validateCatalog(sources, worlds, works, units, [{
      id: "c", workId: "work", sourceId: "index", status: "metadata-only", gateUnitIds: ["u1"],
    }])).toEqual({ valid: true, issues: [] });
  });

  it("rejects a summary when the source is not explicitly accessible", () => {
    const result = validateCatalog(sources, worlds, works, units, [{
      id: "c", workId: "work", sourceId: "index", status: "backed-summary", summary: "Texto original", gateUnitIds: ["u1"],
    }]);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ code: "unbacked-summary", id: "c" });
  });

  it("fails closed when validation is not clean", () => {
    const item = { id: "c", workId: "work", sourceId: "index", status: "backed-summary" as const, summary: "Resumen", gateUnitIds: ["u1"] };
    expect(revealContent(item, ["u1"], { valid: false, issues: [] })).toBeNull();
  });

  it("does not reveal backed content until every gate unit is completed", () => {
    const accessible = [{ id: "source", label: "Accesible", access: "accessible" as const }];
    const item = { id: "c", workId: "work", sourceId: "source", status: "backed-summary" as const, summary: "Resumen original", gateUnitIds: ["u1"] };
    const validation = validateCatalog(accessible, worlds, works.map(w => ({ ...w, sourceId: "source" })), units.map(u => ({ ...u, sourceId: "source" })), [item]);
    expect(revealContent(item, [], validation)).toBeNull();
    expect(revealContent(item, ["u1"], validation)).toEqual(item);
  });
});
