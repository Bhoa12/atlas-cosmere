import { describe, expect, it } from "vitest";
import { classifyHoidEntityDossierIntent } from "./entityDossierIntent";

describe("classifyHoidEntityDossierIntent", () => {
  it.each([
    ["¿Quién es Vin?", "Vin"],
    ["¿Quién fue Kelsier?", "Kelsier"],
    ["Háblame de Kaladin", "Kaladin"],
    ["Cuéntame de Shallan", "Shallan"],
    ["¿Qué sabemos de El Hombre Iluminado?", "El Hombre Iluminado"],
    ["Dime algo sobre la Investidura.", "la Investidura"],
    ["Perfil de Puente Cuatro", "Puente Cuatro"],
    ["Ficha de la torre", "la torre"],
    ["Expediente de Hoid", "Hoid"],
    ["Describe a Jasnah", "Jasnah"],
    ["Who is Hoid?", "Hoid"],
    ["Tell me about Roshar", "Roshar"],
    ["What do we know about the Knights Radiant?", "the Knights Radiant"],
    ["¿Qué significa AonDor?", "AonDor"],
  ])("extracts an exact local lookup key from %s", (question, entityName) => {
    expect(classifyHoidEntityDossierIntent(question)).toEqual({
      status: "ready",
      entityName,
    });
  });

  it("requests the missing name instead of routing a partial dossier query elsewhere", () => {
    expect(classifyHoidEntityDossierIntent("¿Quién es?")).toEqual({ status: "needs-name" });
    expect(classifyHoidEntityDossierIntent("Háblame de")).toEqual({ status: "needs-name" });
    expect(classifyHoidEntityDossierIntent("¿Qué sabemos de?")).toEqual({ status: "needs-name" });
  });

  it("does not classify ordinary explanations as dossier requests", () => {
    expect(classifyHoidEntityDossierIntent("¿Cómo funciona este sistema de magia?"))
      .toEqual({ status: "not-dossier" });
    expect(classifyHoidEntityDossierIntent("Compara a Vin y Kaladin"))
      .toEqual({ status: "not-dossier" });
  });

  it("preserves the user's exact entity spelling after removing terminal punctuation", () => {
    expect(classifyHoidEntityDossierIntent("¿Quién es Sazed?!")).toEqual({
      status: "ready",
      entityName: "Sazed",
    });
  });

  it("rejects non-canonical, control-bearing and oversized input", () => {
    expect(classifyHoidEntityDossierIntent(" ¿Quién es Vin?")).toEqual({ status: "invalid" });
    expect(classifyHoidEntityDossierIntent("¿Quién es V\u0000in?")).toEqual({ status: "invalid" });
    expect(classifyHoidEntityDossierIntent("¿Quién es V\u200Bin?")).toEqual({ status: "invalid" });
    expect(classifyHoidEntityDossierIntent("¿Quién es " + "x".repeat(300) + "?"))
      .toEqual({ status: "invalid" });
    expect(classifyHoidEntityDossierIntent("x".repeat(4_001))).toEqual({ status: "invalid" });
  });
});
