import { describe, expect, it, vi } from "vitest";
import { HoidPipeline, type ContextualHoidProvider } from "./pipeline";
import { HoidAnswerRequest, HoidProvider } from "./types";

describe("Hoid provider boundary", () => {
  it("never forwards caller-supplied knowledgeContext to a provider", async () => {
    const provider: HoidProvider = {
      answer: vi.fn(async (request) => {
        expect(request.knowledgeContext).toBeUndefined();
        return "Respuesta segura";
      }),
    };

    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta segura",
      reading: [],
      knowledgeContext: [{
        id: "untrusted",
        kind: "event",
        source: { bookId: "unknown", chapter: 999 },
        summary: "Contenido que no ha sido autorizado por el catálogo.",
      }],
    });

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });

  it("never forwards local EPUB chapter text, blocks, or source handles to a provider", async () => {
    const privateMarker = "SYNTHETIC_PRIVATE_EPUB_TEXT_MUST_STAY_LOCAL";
    let received: HoidAnswerRequest | undefined;
    const provider: HoidProvider = {
      answer: vi.fn(async (request) => {
        received = request;
        return "Respuesta segura";
      }),
    };
    const request = {
      question: "Pregunta segura",
      reading: [],
      openedChapter: {
        workId: "the-final-empire",
        editionId: "synthetic-edition",
        chapterNumber: 7,
        blocks: [{ kind: "paragraph", text: privateMarker }],
      },
      readerContent: { blocks: [{ text: privateMarker }] },
      rawXhtml: "<p>" + privateMarker + "</p>",
      sourceHandle: { uri: "file:///private/synthetic-book.epub" },
      packageCandidate: { opaque: "synthetic-local-handle" },
    } as unknown as HoidAnswerRequest;

    const result = await new HoidPipeline(provider, []).answer(request);

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
    expect(received).toBeDefined();
    expect(Object.keys(received as object).sort()).toEqual(["question", "reading"]);
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(received?.reading)).toBe(true);
    expect(JSON.stringify(received)).not.toContain(privateMarker);
    expect(JSON.stringify(received)).not.toContain("file:///private");
    expect(JSON.stringify(received)).not.toContain("synthetic-local-handle");
  });

  it("keeps local EPUB fields out of contextual provider requests too", async () => {
    const privateMarker = "CONTEXTUAL_PRIVATE_EPUB_TEXT_MUST_STAY_LOCAL";
    let received: HoidAnswerRequest | undefined;
    let receivedContext: readonly unknown[] | undefined;
    const provider: ContextualHoidProvider = {
      answer: vi.fn(async () => "Respuesta segura"),
      answerWithContext: vi.fn(async (request, context) => {
        received = request;
        receivedContext = context;
        return "Respuesta segura";
      }),
    };
    const request = {
      question: "Pregunta segura",
      reading: [],
      openedChapter: { blocks: [{ text: privateMarker }] },
      rawXhtml: "<p>" + privateMarker + "</p>",
      sourceHandle: { uri: "file:///private/contextual.epub" },
    } as unknown as HoidAnswerRequest;

    const result = await new HoidPipeline(provider, []).answer(request);

    expect(result.blocked).toBe(false);
    expect(provider.answerWithContext).toHaveBeenCalledTimes(1);
    expect(received).toBeDefined();
    expect(Object.keys(received as object).sort()).toEqual(["question", "reading"]);
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(received?.reading)).toBe(true);
    expect(Object.isFrozen(receivedContext)).toBe(true);
    expect(JSON.stringify(received)).not.toContain(privateMarker);
    expect(JSON.stringify(received)).not.toContain("file:///private");
    expect(JSON.stringify(receivedContext)).not.toContain(privateMarker);
  });
});
