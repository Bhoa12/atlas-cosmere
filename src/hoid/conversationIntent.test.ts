import { describe, expect, it } from "vitest";
import { classifyHoidConversationIntent } from "./conversationIntent";

describe("classifyHoidConversationIntent", () => {
  it("routes explicit reading recommendations to the metadata-only recommendation path", () => {
    expect(classifyHoidConversationIntent("¿Qué libro debería leer después?")).toEqual({
      status: "ready",
      intent: "recommend",
      signal: "recommendation-cue",
    });
  });

  it("normalizes accents and punctuation deterministically", () => {
    expect(classifyHoidConversationIntent("¡Recomiéndame una próxima lectura!")).toMatchObject({
      status: "ready",
      intent: "recommend",
      signal: "recommendation-cue",
    });
  });

  it("recognizes a direct recommendation verb", () => {
    expect(classifyHoidConversationIntent("Me recomiendas otra obra")).toMatchObject({
      status: "ready",
      intent: "recommend",
    });
  });

  it("routes progress and recap questions to the context path", () => {
    expect(classifyHoidConversationIntent("¿Hasta dónde he leído?")).toEqual({
      status: "ready",
      intent: "context",
      signal: "reading-context-cue",
    });
  });

  it("recognizes a request to locate the current reading position", () => {
    expect(classifyHoidConversationIntent("¿Dónde me quedé?")).toMatchObject({
      status: "ready",
      intent: "context",
    });
  });

  it("recognizes a recap request", () => {
    expect(classifyHoidConversationIntent("Hazme un resumen de lo leído")).toMatchObject({
      status: "ready",
      intent: "context",
    });
  });

  it("gives recommendation requests precedence when cues are mixed", () => {
    expect(classifyHoidConversationIntent("Recuerda lo que he leído y recomiéndame un libro")).toMatchObject({
      status: "ready",
      intent: "recommend",
    });
  });

  it("uses the explanation path for ordinary knowledge questions", () => {
    expect(classifyHoidConversationIntent("¿Cómo funciona este sistema de magia?")).toEqual({
      status: "ready",
      intent: "explain",
      signal: "default-explanation",
    });
  });

  it("does not expose or retain the original question in the plan", () => {
    const result = classifyHoidConversationIntent("¿Quién es este personaje?");
    expect(result).not.toHaveProperty("question");
    expect(JSON.stringify(result)).not.toContain("personaje");
  });

  it("rejects non-string and blank input", () => {
    expect(classifyHoidConversationIntent(null)).toEqual({
      status: "unavailable",
      reason: "invalid-question",
    });
    expect(classifyHoidConversationIntent("   ")).toEqual({
      status: "unavailable",
      reason: "invalid-question",
    });
  });

  it("rejects non-canonical whitespace rather than silently changing the request", () => {
    expect(classifyHoidConversationIntent(" ¿Quién es?")).toEqual({
      status: "unavailable",
      reason: "invalid-question",
    });
  });

  it("rejects control and Unicode format characters", () => {
    expect(classifyHoidConversationIntent("¿Quién\u0000 es?")).toEqual({
      status: "unavailable",
      reason: "invalid-question",
    });
    expect(classifyHoidConversationIntent("¿Quién\u200B es?")).toEqual({
      status: "unavailable",
      reason: "invalid-question",
    });
  });

  it("rejects oversized questions", () => {
    expect(classifyHoidConversationIntent("a".repeat(4_001))).toEqual({
      status: "unavailable",
      reason: "invalid-question",
    });
  });

  it("returns the same intent for the same normalized input", () => {
    const first = classifyHoidConversationIntent("¿Qué libro leo después?");
    const second = classifyHoidConversationIntent("¿QUÉ LIBRO LEO DESPUÉS?");
    expect(first).toEqual(second);
  });
});
