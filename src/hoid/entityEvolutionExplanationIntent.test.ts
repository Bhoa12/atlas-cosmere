import { describe, expect, it } from "vitest";
import { classifyHoidCharacterEvolutionIntent } from "./entityEvolutionExplanationIntent";

describe("Hoid character-evolution intent: missing-name boundary", () => {
  const missingNameQuestions = [
    "Evolución de",
    "Evolución de?",
    "¿Cómo ha evolucionado?",
    "¿Cómo ha evolucionado el personaje de?",
    "¿Cómo ha cambiado?",
    "¿Qué cambios conocemos de?",
    "Capacidades de?",
    "Relaciones de",
    "How has?",
    "Evolution of?",
    "Character development of?",
    "Changes in?",
    "Capabilities of?",
  ] as const;

  it.each(missingNameQuestions)("asks for an entity name instead of routing %s", question => {
    expect(classifyHoidCharacterEvolutionIntent(question)).toEqual({ status: "needs-name" });
  });

  it("still extracts exact names when punctuation follows the name", () => {
    expect(classifyHoidCharacterEvolutionIntent("¿Cómo ha evolucionado Personaje Alfa?")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
    });
    expect(classifyHoidCharacterEvolutionIntent("Capacidades de Personaje Alfa.")).toEqual({
      status: "ready",
      characterName: "Personaje Alfa",
      dimension: "capability",
    });
  });

  it("does not promote unrelated prose into an evolution intent", () => {
    expect(classifyHoidCharacterEvolutionIntent("Háblame de cómo ha evolucionado la historia")).toEqual({
      status: "not-evolution",
    });
  });

  it("rejects control characters before classifying", () => {
    expect(classifyHoidCharacterEvolutionIntent("¿Cómo ha evolucionado Personaje\u0000?")).toEqual({
      status: "invalid",
    });
  });
});
