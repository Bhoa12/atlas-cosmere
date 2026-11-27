import { describe, expect, it } from "vitest";
import { classifyHoidEntityRelationshipIntent } from "./entityRelationshipIntent";

describe("Hoid entity relationship intent", () => {
  it("extracts two exact Spanish entity names", () => {
    expect(classifyHoidEntityRelationshipIntent(
      "¿Qué relación hay entre Entidad Alfa y Entidad Beta?",
    )).toEqual({
      status: "ready",
      leftEntityName: "Entidad Alfa",
      rightEntityName: "Entidad Beta",
    });
  });

  it("supports the Spanish relational verb form", () => {
    expect(classifyHoidEntityRelationshipIntent(
      "Cómo se relacionan Vin e Kaladin",
    )).toEqual({
      status: "ready",
      leftEntityName: "Vin",
      rightEntityName: "Kaladin",
    });
  });

  it("supports explicit English relationship questions", () => {
    expect(classifyHoidEntityRelationshipIntent(
      "What is the relationship between Alpha and Beta?",
    )).toEqual({
      status: "ready",
      leftEntityName: "Alpha",
      rightEntityName: "Beta",
    });
    expect(classifyHoidEntityRelationshipIntent(
      "How are Alpha and Beta connected?",
    )).toEqual({
      status: "ready",
      leftEntityName: "Alpha",
      rightEntityName: "Beta",
    });
  });

  it("requests both names when a recognized relationship prompt is incomplete", () => {
    expect(classifyHoidEntityRelationshipIntent("¿Qué relación hay entre?"))
      .toEqual({ status: "needs-names" });
    expect(classifyHoidEntityRelationshipIntent("Relación entre Entidad Alfa"))
      .toEqual({ status: "needs-names" });
  });

  it("rejects repeated conjunctions rather than guessing a split", () => {
    expect(classifyHoidEntityRelationshipIntent(
      "Relación entre Alfa y Beta y Gamma",
    )).toEqual({ status: "invalid" });
  });

  it("rejects a self-comparison after Unicode normalization and case folding", () => {
    expect(classifyHoidEntityRelationshipIntent(
      "Relación entre Ａlfa y Alfa",
    )).toEqual({ status: "invalid" });
  });

  it("supports the broader Spanish relationship cues with or without diacritics", () => {
    expect(classifyHoidEntityRelationshipIntent("Que conexion hay entre Alfa y Beta"))
      .toEqual({ status: "ready", leftEntityName: "Alfa", rightEntityName: "Beta" });
    expect(classifyHoidEntityRelationshipIntent("Qué relación tiene Alfa con Beta"))
      .toEqual({ status: "ready", leftEntityName: "Alfa", rightEntityName: "Beta" });
    expect(classifyHoidEntityRelationshipIntent("Qué une a Alfa y Beta"))
      .toEqual({ status: "ready", leftEntityName: "Alfa", rightEntityName: "Beta" });
    expect(classifyHoidEntityRelationshipIntent("Como estan relacionados Alfa y Beta"))
      .toEqual({ status: "ready", leftEntityName: "Alfa", rightEntityName: "Beta" });
    expect(classifyHoidEntityRelationshipIntent("Qué tienen en común Alfa y Beta"))
      .toEqual({ status: "ready", leftEntityName: "Alfa", rightEntityName: "Beta" });
  });

  it("supports the English related form", () => {
    expect(classifyHoidEntityRelationshipIntent("How are Alpha and Beta related?"))
      .toEqual({ status: "ready", leftEntityName: "Alpha", rightEntityName: "Beta" });
  });

  it("does not classify ordinary entity or narrative questions as relationships", () => {
    expect(classifyHoidEntityRelationshipIntent("¿Quién es Vin?"))
      .toEqual({ status: "not-relationship" });
    expect(classifyHoidEntityRelationshipIntent("¿Cómo funciona la Investidura?"))
      .toEqual({ status: "not-relationship" });
  });

  it("rejects control characters and overlong questions", () => {
    expect(classifyHoidEntityRelationshipIntent("Relación entre Alfa y Be\u0000ta"))
      .toEqual({ status: "invalid" });
    expect(classifyHoidEntityRelationshipIntent("x".repeat(4_001)))
      .toEqual({ status: "invalid" });
  });
});
