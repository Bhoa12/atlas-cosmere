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

  it("does not evaluate ignored reader-only accessors while building the provider request", async () => {
    let chapterGetterCalled = false;
    let xhtmlGetterCalled = false;
    const provider: HoidProvider = {
      answer: vi.fn(async () => "Respuesta segura"),
    };
    const request = {
      question: "Pregunta segura",
      reading: [],
    } as HoidAnswerRequest & Record<string, unknown>;
    Object.defineProperties(request, {
      openedChapter: {
        enumerable: true,
        get() {
          chapterGetterCalled = true;
          throw new Error("reader state must remain opaque");
        },
      },
      rawXhtml: {
        enumerable: true,
        get() {
          xhtmlGetterCalled = true;
          throw new Error("raw XHTML must remain opaque");
        },
      },
    });

    const result = await new HoidPipeline(provider, []).answer(request);

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
    expect(chapterGetterCalled).toBe(false);
    expect(xhtmlGetterCalled).toBe(false);
  });

  it("rejects accessor-backed question and reading fields without invoking them", async () => {
    let questionGetterCalled = false;
    let readingGetterCalled = false;
    const provider: HoidProvider = {
      answer: vi.fn(async () => "No debe ejecutarse"),
    };
    const request = {} as HoidAnswerRequest;
    Object.defineProperties(request, {
      question: {
        enumerable: true,
        get() {
          questionGetterCalled = true;
          return "Pregunta segura";
        },
      },
      reading: {
        enumerable: true,
        get() {
          readingGetterCalled = true;
          return [];
        },
      },
    });

    const result = await new HoidPipeline(provider, []).answer(request);

    expect(result).toMatchObject({ blocked: true, reason: "input-invalid" });
    expect(provider.answer).not.toHaveBeenCalled();
    expect(questionGetterCalled).toBe(false);
    expect(readingGetterCalled).toBe(false);
  });

  it("contains a proxy descriptor failure at the request boundary", async () => {
    const provider: HoidProvider = {
      answer: vi.fn(async () => "No debe ejecutarse"),
    };
    const hostile = new Proxy({
      question: "Pregunta segura",
      reading: [],
    }, {
      getOwnPropertyDescriptor() {
        throw new Error("synthetic descriptor failure");
      },
    });

    const result = await new HoidPipeline(provider, []).answer(hostile as unknown as HoidAnswerRequest);

    expect(result).toMatchObject({ blocked: true, reason: "input-invalid" });
    expect(provider.answer).not.toHaveBeenCalled();
  });
});
