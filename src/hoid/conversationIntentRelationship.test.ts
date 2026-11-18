import { describe, expect, it } from "vitest";
import { classifyHoidConversationIntent } from "./conversationIntent";

describe("relationship intent routing", () => {
  it("routes explicit two-entity relationship questions to the graph capability", () => {
    expect(classifyHoidConversationIntent("¿Qué relación hay entre Vin y Kelsier?")).toEqual({
      status: "ready",
      intent: "explain",
      mode: "relationship-explanation",
      signal: "relationship-cue",
    });
  });

  it("keeps recommendation cues ahead of relationship wording", () => {
    expect(classifyHoidConversationIntent("Recomiéndame un libro sobre relaciones entre personajes")).toMatchObject({
      status: "ready",
      intent: "recommend",
      mode: "catalogue-recommendation",
    });
  });

  it("does not route ordinary explanations to the graph capability", () => {
    expect(classifyHoidConversationIntent("¿Cómo funciona este sistema de magia?")).toMatchObject({
      status: "ready",
      mode: "explanation",
      signal: "default-explanation",
    });
  });
});
