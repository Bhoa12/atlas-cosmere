import { describe, expect, it, vi } from "vitest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import {
  createHoidConversationGateway,
  type HoidConversationGatewayConfig,
} from "./conversationGateway";
import { createHoidReadingCursor } from "./readingManifest";
import { createHoidCursorEvidenceRuntime } from "./cursorEvidenceRuntime";
import { createHoidEditorialRuntime } from "./editorialRegistry";

const UPDATED_AT = "2026-11-17T14:00:00.000Z";

function snapshot(chapter: number, revision = 1) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor sintético no disponible");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "twok", cursor: cursor.cursor }],
    updatedAt: revision === 0 ? null : UPDATED_AT,
  };
}

const answer: HoidEvidenceAnswer = Object.freeze({
  status: "abstain",
  reason: "no-authorized-evidence",
  text: "No hay afirmaciones editoriales autorizadas para esta consulta.",
  claimIds: Object.freeze([]),
  evidenceIds: Object.freeze([]),
  sources: Object.freeze([]),
});

const tfeRecommendation = Object.freeze({
  sourceId: "tfe",
  title: "El Imperio Final",
  reason: "unread-source",
});
const elantrisRecommendation = Object.freeze({
  sourceId: "elantris",
  title: "Elantris",
  reason: "unread-source",
});

function setup(initial = snapshot(3)) {
  let current: unknown = initial;
  const runtime = { answer: vi.fn(async () => answer) };
  const config: HoidConversationGatewayConfig = {
    runtime,
    getCurrentProgress: () => current,
  };
  const gateway = createHoidConversationGateway(config);
  if (!gateway) throw new Error("No se pudo crear el gateway sintético");
  return {
    gateway,
    runtime,
    setCurrent(value: unknown) { current = value; },
  };
}

describe("HoidConversationGateway", () => {
  it("returns the strict runtime answer while the authoritative progress is unchanged", async () => {
    const current = snapshot(3);
    const { gateway } = setup(current);
    const result = await gateway.answer({ question: "¿Qué se ha autorizado?", progress: current });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.answer).toBe(answer);
    expect(result.progressRevision).toBe(1);
    expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not invoke the runtime when the request snapshot is already stale", async () => {
    const { gateway, runtime } = setup(snapshot(4));
    const result = await gateway.answer({ question: "Pregunta sintética", progress: snapshot(3) });

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("discards the entire answer if progress changes while the runtime is pending", async () => {
    let finish: ((value: HoidEvidenceAnswer) => void) | undefined;
    const initial = snapshot(3);
    const runtime = {
      answer: vi.fn(() => new Promise<HoidEvidenceAnswer>(resolve => { finish = resolve; })),
    };
    let current: unknown = initial;
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({ question: "Pregunta sintética", progress: initial });
    current = snapshot(4);
    finish?.(answer);

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(result).not.toHaveProperty("answer");
    expect(result).not.toHaveProperty("text");
  });

  it("detects a changed position even if a caller reuses the same revision", async () => {
    const initial = snapshot(3, 7);
    const { gateway, setCurrent } = setup(initial);
    setCurrent(snapshot(4, 7));

    const result = await gateway.answer({ question: "Pregunta sintética", progress: initial });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("detects a revision change even if the visible cursor is unchanged", async () => {
    const initial = snapshot(3, 7);
    const { gateway, setCurrent } = setup(initial);
    setCurrent(snapshot(3, 8));

    const result = await gateway.answer({ question: "Pregunta sintética", progress: initial });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("rejects malformed requests and extra properties", async () => {
    const { gateway, runtime } = setup();
    expect(await gateway.answer({ question: "Pregunta", progress: snapshot(3), extra: true }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("rejects accessor-backed requests without invoking the accessor", async () => {
    const { gateway, runtime } = setup();
    let invoked = false;
    const request = { progress: snapshot(3) } as Record<string, unknown>;
    Object.defineProperty(request, "question", {
      enumerable: true,
      get() { invoked = true; return "Pregunta"; },
    });

    expect(await gateway.answer(request)).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(invoked).toBe(false);
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("rejects an invalid v2 snapshot before invoking the runtime", async () => {
    const { gateway, runtime } = setup();
    const invalid = { schemaVersion: 1, revision: 0, positions: [], updatedAt: null };
    expect(await gateway.answer({ question: "Pregunta", progress: invalid }))
      .toEqual({ status: "unavailable", reason: "invalid-progress" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("contains runtime failures without exposing provider details", async () => {
    const current = snapshot(3);
    const gateway = createHoidConversationGateway({
      runtime: { answer: vi.fn(async () => { throw new Error("synthetic provider detail"); }) },
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({ question: "Pregunta", progress: current });
    expect(result).toEqual({ status: "unavailable", reason: "runtime-failed" });
    expect(JSON.stringify(result)).not.toContain("synthetic provider detail");
  });

  it("fails closed when the current progress cannot be read", async () => {
    const gateway = createHoidConversationGateway({
      runtime: { answer: vi.fn(async () => answer) },
      getCurrentProgress: () => { throw new Error("synthetic storage error"); },
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({ question: "Pregunta", progress: snapshot(3) });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects a blank or control-character question", async () => {
    const { gateway, runtime } = setup();
    expect(await gateway.answer({ question: "  ", progress: snapshot(3) }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(await gateway.answer({ question: "Pregunta\u0000", progress: snapshot(3) }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("returns only catalogue-backed, unstarted recommendations", async () => {
    const current = snapshot(3);
    const runtime = {
      answer: vi.fn(async () => answer),
      recommend: vi.fn(async () => ({
        status: "ready" as const,
        items: [tfeRecommendation, elantrisRecommendation],
      })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.recommend({ progress: current, limit: 2 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items).toEqual([tfeRecommendation, elantrisRecommendation]);
    expect(result.progressRevision).toBe(1);
    expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(runtime.recommend).toHaveBeenCalledWith(current, 2);
  });

  it("does not invoke the recommender when the request snapshot is stale", async () => {
    const current = snapshot(4);
    const runtime = {
      answer: vi.fn(async () => answer),
      recommend: vi.fn(async () => ({ status: "ready" as const, items: [tfeRecommendation] })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.recommend({ progress: snapshot(3), limit: 1 });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(runtime.recommend).not.toHaveBeenCalled();
  });

  it("discards recommendations if progress changes while the recommender is pending", async () => {
    let finish: ((value: unknown) => void) | undefined;
    const initial = snapshot(3);
    let current: unknown = initial;
    const runtime = {
      answer: vi.fn(async () => answer),
      recommend: vi.fn(() => new Promise(resolve => { finish = resolve; })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.recommend({ progress: initial, limit: 1 });
    current = snapshot(4);
    finish?.({ status: "ready", items: [tfeRecommendation] });

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(result).not.toHaveProperty("items");
  });

  it("rejects started, unknown, duplicate and title-mismatched recommendation entries", async () => {
    const current = snapshot(3);
    const invalidBatches = [
      [{ sourceId: "twok", title: "El Camino de los Reyes", reason: "unread-source" }],
      [{ sourceId: "unknown", title: "Obra desconocida", reason: "unread-source" }],
      [{ sourceId: "tfe", title: "Título manipulado", reason: "unread-source" }],
      [tfeRecommendation, tfeRecommendation],
    ];

    for (const items of invalidBatches) {
      const gateway = createHoidConversationGateway({
        runtime: {
          answer: vi.fn(async () => answer),
          recommend: vi.fn(async () => ({ status: "ready" as const, items })),
        },
        getCurrentProgress: () => current,
      });
      if (!gateway) throw new Error("No se pudo crear el gateway sintético");
      expect(await gateway.recommend({ progress: current, limit: 3 }))
        .toEqual({ status: "unavailable", reason: "invalid-recommendations" });
    }
  });

  it("rejects recommendation requests with extra properties or invalid limits", async () => {
    const current = snapshot(3);
    const runtime = {
      answer: vi.fn(async () => answer),
      recommend: vi.fn(async () => ({ status: "ready" as const, items: [] })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.recommend({ progress: current, extra: true }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(await gateway.recommend({ progress: current, limit: 21 }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.recommend).not.toHaveBeenCalled();
  });

  it("abstains when the runtime has no recommendation capability", async () => {
    const { gateway } = setup();
    expect(await gateway.recommend({ progress: snapshot(3), limit: 3 }))
      .toEqual({ status: "unavailable", reason: "runtime-unavailable" });
  });

  it("treats an invalid-progress recommendation result as unavailable", async () => {
    const current = snapshot(3);
    const gateway = createHoidConversationGateway({
      runtime: {
        answer: vi.fn(async () => answer),
        recommend: vi.fn(async () => ({ status: "abstain" as const, reason: "invalid-progress" as const, items: [] as const })),
      },
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.recommend({ progress: current }))
      .toEqual({ status: "unavailable", reason: "invalid-progress" });
  });


  it("serves catalogue-only recommendations from the empty production registry without a provider", async () => {
    const editorialRuntime = createHoidEditorialRuntime();
    if (!editorialRuntime) throw new Error("No se pudo crear el runtime editorial de producción");
    const cursorRuntime = createHoidCursorEvidenceRuntime(editorialRuntime);
    const current = snapshot(1);
    const gateway = createHoidConversationGateway({
      runtime: cursorRuntime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway de producción");

    const result = await gateway.recommend({ progress: current, limit: 3 });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items).toEqual([
      { sourceId: "tfe", title: "El Imperio Final", reason: "unread-source" },
      { sourceId: "woa", title: "El Pozo de la Ascensión", reason: "unread-source" },
      { sourceId: "hoa", title: "El Héroe de las Eras", reason: "unread-source" },
    ]);
    expect(result.items.some(item => item.sourceId === "twok")).toBe(false);
  });


  it("forwards a validated context intent to the strict runtime", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({
      question: "¿Hasta dónde he leído?",
      progress: current,
      intent: "context",
    });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Hasta dónde he leído?",
      progress: current,
      intent: "context",
    });
  });

  it("defaults an omitted intent to explain for backward compatibility", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    await gateway.answer({ question: "¿Qué significa este concepto?", progress: current });

    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Qué significa este concepto?",
      progress: current,
      intent: "explain",
    });
  });

  it("rejects unsupported intents before invoking the runtime", async () => {
    const { gateway, runtime } = setup();
    const result = await gateway.answer({
      question: "Pregunta sintética",
      progress: snapshot(3),
      intent: "spoiler-dump",
    });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("rejects Unicode format characters at the conversation boundary", async () => {
    const { gateway, runtime } = setup();
    const result = await gateway.answer({
      question: "¿Quién es\\u200B?",
      progress: snapshot(3),
    });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

});