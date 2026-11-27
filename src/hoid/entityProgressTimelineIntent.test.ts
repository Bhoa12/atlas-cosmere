import { describe, expect, it } from "vitest";
import { classifyHoidEntityProgressTimelineIntent } from "./entityProgressTimelineIntent";

describe("Hoid entity progress timeline intent", () => {
  it.each([
    ["¿Cuál es la evolución de Vin?", "Vin"],
    ["Cronología de Kaladin", "Kaladin"],
    ["Trayectoria del Puente Cuatro", "Puente Cuatro"],
    ["¿Cómo ha cambiado Shallan?", "Shallan"],
    ["¿Cómo evoluciona Dalinar?", "Dalinar"],
    ["¿Cómo ha evolucionado Jasnah?", "Jasnah"],
    ["What is the timeline of Navani?", "Navani"],
    ["Evolution of a synthetic character", "a synthetic character"],
    ["Character arc of a synthetic character", "a synthetic character"],
  ])("extracts an exact entity name from %s", (question, entityName) => {
    expect(classifyHoidEntityProgressTimelineIntent(question)).toEqual({
      status: "ready",
      entityName,
    });
  });

  it("asks for the entity name when the timeline cue is incomplete", () => {
    expect(classifyHoidEntityProgressTimelineIntent("¿Cuál es la evolución de?"))
      .toEqual({ status: "needs-name" });
  });

  it("does not classify ordinary questions as timeline requests", () => {
    expect(classifyHoidEntityProgressTimelineIntent("¿Quién es Vin?"))
      .toEqual({ status: "not-timeline" });
  });

  it("rejects control characters and oversized names", () => {
    expect(classifyHoidEntityProgressTimelineIntent("Evolución de Vin\n"))
      .toEqual({ status: "invalid" });
    expect(classifyHoidEntityProgressTimelineIntent("Evolución de " + "x".repeat(300)))
      .toEqual({ status: "invalid" });
  });
});
