import { describe, expect, it } from "vitest";
import { classifyHoidConversationIntent } from "./conversationIntent";

describe("classifyHoidConversationIntent", () => {
  it("routes explicit reading recommendations to the metadata-only catalogue path", () => {
    expect(classifyHoidConversationIntent("¿Qué libro debería leer después?")).toEqual({
      status: "ready",
      intent: "recommend",
      mode: "catalogue-recommendation",
      signal: "recommendation-cue",
    });
  });

  it("normalizes accents and punctuation deterministically", () => {
    expect(classifyHoidConversationIntent("¡Recomiéndame una próxima lectura!")).toMatchObject({
      status: "ready",
      intent: "recommend",
      mode: "catalogue-recommendation",
      signal: "recommendation-cue",
    });
  });

  it("recognizes a direct recommendation verb", () => {
    expect(classifyHoidConversationIntent("Me recomiendas otra obra")).toMatchObject({
      status: "ready",
      intent: "recommend",
      mode: "catalogue-recommendation",
    });
  });

  it("routes an explicit reread request to the local progress-bound resolver", () => {
    expect(classifyHoidConversationIntent("Quiero releer El Imperio Final")).toEqual({
      status: "ready",
      intent: "recommend",
      mode: "reread-request",
      signal: "reread-cue",
    });
  });

  it("routes explicit new-work discovery to the signed curated-path capability", () => {
    expect(classifyHoidConversationIntent("Recomiéndame una obra nueva")).toEqual({
      status: "ready",
      intent: "recommend",
      mode: "curated-discovery",
      signal: "discovery-cue",
    });
  });

  it("gives explicit reread intent precedence over generic recommendation cues", () => {
    expect(classifyHoidConversationIntent("Recomiéndame algo para releer")).toMatchObject({
      status: "ready",
      mode: "reread-request",
      signal: "reread-cue",
    });
  });

  it("routes reading-position questions to metadata-only progress context", () => {
    expect(classifyHoidConversationIntent("¿Hasta dónde he leído?")).toEqual({
      status: "ready",
      intent: "context",
      mode: "reading-progress",
      signal: "progress-position-cue",
    });
  });

  it("recognizes a request to locate the current chapter", () => {
    expect(classifyHoidConversationIntent("¿En qué capítulo estoy?")).toMatchObject({
      status: "ready",
      intent: "context",
      mode: "reading-progress",
    });
  });

  it("recognizes a request to locate the last reading position", () => {
    expect(classifyHoidConversationIntent("¿Dónde me quedé?")).toMatchObject({
      status: "ready",
      intent: "context",
      mode: "reading-progress",
    });
  });

  it("routes plot recaps to the editorial evidence runtime, not metadata-only context", () => {
    expect(classifyHoidConversationIntent("Hazme un resumen de lo leído")).toEqual({
      status: "ready",
      intent: "context",
      mode: "narrative-context",
      signal: "narrative-recap-cue",
    });
  });

  it("gives recommendations precedence when recommendation and context cues are mixed", () => {
    expect(classifyHoidConversationIntent("Recuerda lo que he leído y recomiéndame un libro")).toMatchObject({
      status: "ready",
      intent: "recommend",
      mode: "catalogue-recommendation",
    });
  });

  it("uses the explanation path for ordinary knowledge questions", () => {
    expect(classifyHoidConversationIntent("¿Cómo funciona este sistema de magia?")).toEqual({
      status: "ready",
      intent: "explain",
      mode: "explanation",
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

  it("returns the same route for the same normalized input", () => {
    const first = classifyHoidConversationIntent("¿Qué libro leo después?");
    const second = classifyHoidConversationIntent("¿QUÉ LIBRO LEO DESPUÉS?");
    expect(first).toEqual(second);
  });
});
