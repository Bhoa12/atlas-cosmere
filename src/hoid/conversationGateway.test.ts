import { describe, expect, it, vi } from "vitest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import {
  createHoidConversationGateway,
  type HoidConversationGatewayConfig,
} from "./conversationGateway";
import { createHoidReadingCursor } from "./readingManifest";
import { createHoidCursorEvidenceRuntime, projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { createHoidEditorialRuntime } from "./editorialRegistry";
import { createHoidConversationContext } from "./conversationContext";
import { HOID_EXPLANATION_DEPTH_BUDGETS } from "./explanationDepth";

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

function setup(initial: unknown = snapshot(3), resolveEntities?: HoidConversationGatewayConfig["resolveEntities"]) {
  let current: unknown = initial;
  const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
  const config: HoidConversationGatewayConfig = {
    runtime,
    getCurrentProgress: () => current,
    ...(resolveEntities ? { resolveEntities } : {}),
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

  it("canonicalizes and forwards an explicit single-work scope to the strict runtime", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({
      question: "¿Qué se ha autorizado?",
      progress: current,
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
    });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith(expect.objectContaining({
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
    }), undefined);
  });

  it("forwards explicit scope through a resolved single-entity coreference route", async () => {
    const current = snapshot(3);
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const identity = {
      revision: projection.revision,
      fingerprint: fingerprintHoidCursorProgressProjection(projection),
    };
    const context = createHoidConversationContext(["synthetic.entity-alpha", "synthetic.entity-beta"], identity);
    if (!context) throw new Error("Contexto sintético no disponible");
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      resolveCoreference: () => ({
        status: "resolved",
        entityId: "synthetic.entity-alpha",
        context,
        progressRevision: identity.revision,
        progressFingerprint: identity.fingerprint,
      }),
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Qué pasa con él?",
      progress: current,
      bookScope: { mode: "single-work", bookIds: ["twok"] },
    });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith(expect.objectContaining({
      entityIds: ["synthetic.entity-alpha"],
      bookScope: { mode: "single-work", bookIds: ["twok"] },
    }), undefined);
  });

  it("rejects malformed explicit work scopes before runtime invocation", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({
      question: "¿Qué se ha autorizado?",
      progress: current,
      bookScope: { mode: "cross-work", bookIds: ["twok", "unknown-work"] },
    });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("defaults to detailed depth and forwards its closed selection budget", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({ question: "¿Qué se ha autorizado?", progress: current });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.depth).toBe("detailed");
    expect(runtime.answer).toHaveBeenCalledWith(expect.objectContaining({
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
    }), undefined);
  });

  it("accepts explicit brief depth and forwards its bounded budget", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({
      question: "¿Qué se ha autorizado?",
      progress: current,
      depth: "brief",
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.depth).toBe("brief");
    expect(runtime.answer).toHaveBeenCalledWith(expect.objectContaining({
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.brief,
    }), undefined);
  });

  it("rejects unsupported explanation depths before invoking the runtime", async () => {
    const { gateway, runtime } = setup();
    const result = await gateway.answer({
      question: "Pregunta sintética",
      progress: snapshot(3),
      depth: "unlimited",
    });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("does not invoke the runtime when the request snapshot is already stale", async () => {
    const { gateway, runtime } = setup(snapshot(4));
    const result = await gateway.answer({ question: "Pregunta sintética", progress: snapshot(3) });

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("discards the entire answer if progress changes while the runtime is pending", async () => {
    let finish: ((value: HoidEvidenceAnswer) => void) | undefined;
    let markRuntimeStarted: (() => void) | undefined;
    const runtimeStarted = new Promise<void>(resolve => { markRuntimeStarted = resolve; });
    const initial = snapshot(3);
    const runtime = {
      answer: vi.fn(() => {
        markRuntimeStarted?.();
        return new Promise<HoidEvidenceAnswer>(resolve => { finish = resolve; });
      }),
    };
    let current: unknown = initial;
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({ question: "Pregunta sintética", progress: initial });
    await runtimeStarted;
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
      runtime: { answer: vi.fn(async (_input: unknown) => answer) },
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
      answer: vi.fn(async (_input: unknown) => answer),
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
    expect(runtime.recommend).toHaveBeenCalledWith(current, 2, undefined);
  });

  it("accepts a resume recommendation only when its chapter boundary matches the v2 cursor", async () => {
    const current = snapshot(3);
    const runtime = {
      answer: vi.fn(async (_input: unknown) => answer),
      recommend: vi.fn(async () => ({
        status: "ready" as const,
        items: [{
          sourceId: "twok",
          title: "El Camino de los Reyes",
          reason: "resume-current-work",
          currentChapter: 3,
          completedThroughChapter: 2,
        }],
      })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.recommend({ progress: current, limit: 1 });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.items[0]).toEqual({
        sourceId: "twok",
        title: "El Camino de los Reyes",
        reason: "resume-current-work",
        currentChapter: 3,
        completedThroughChapter: 2,
      });
    }
  });

  it("rejects a forged resume chapter that does not match the authoritative cursor", async () => {
    const current = snapshot(3);
    const gateway = createHoidConversationGateway({
      runtime: {
        answer: vi.fn(async (_input: unknown) => answer),
        recommend: vi.fn(async () => ({
          status: "ready" as const,
          items: [{
            sourceId: "twok",
            title: "El Camino de los Reyes",
            reason: "resume-current-work",
            currentChapter: 4,
            completedThroughChapter: 3,
          }],
        })),
      },
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.recommend({ progress: current, limit: 1 }))
      .toEqual({ status: "unavailable", reason: "invalid-recommendations" });
  });

  it("does not invoke the recommender when the request snapshot is stale", async () => {
    const current = snapshot(4);
    const runtime = {
      answer: vi.fn(async (_input: unknown) => answer),
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
    let markRecommenderStarted: (() => void) | undefined;
    const recommenderStarted = new Promise<void>(resolve => { markRecommenderStarted = resolve; });
    const initial = snapshot(3);
    let current: unknown = initial;
    const runtime = {
      answer: vi.fn(async (_input: unknown) => answer),
      recommend: vi.fn(() => {
        markRecommenderStarted?.();
        return new Promise(resolve => { finish = resolve; });
      }),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.recommend({ progress: initial, limit: 1 });
    await recommenderStarted;
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
          answer: vi.fn(async (_input: unknown) => answer),
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
      answer: vi.fn(async (_input: unknown) => answer),
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
        answer: vi.fn(async (_input: unknown) => answer),
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
      {
        sourceId: "twok",
        title: "El Camino de los Reyes",
        reason: "resume-current-work",
        currentChapter: 1,
        completedThroughChapter: null,
      },
      { sourceId: "tfe", title: "El Imperio Final", reason: "unread-source" },
      { sourceId: "woa", title: "El Pozo de la Ascensión", reason: "unread-source" },
    ]);
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
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
    }, undefined);
  });

  it("defaults an omitted intent to explain for backward compatibility", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    await gateway.answer({ question: "¿Qué significa este concepto?", progress: current });

    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Qué significa este concepto?",
      progress: current,
      intent: "explain",
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
    }, undefined);
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
      question: "¿Quién es" + String.fromCharCode(0x200B) + "?",
      progress: snapshot(3),
    });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });


  it("returns a metadata-only reading position through the freshness-checked gateway", async () => {
    const current = snapshot(7);
    const { gateway } = setup(current);
    const result = await gateway.readingContext({ progress: current });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions).toEqual([{
      bookId: "twok",
      title: "El Camino de los Reyes",
      status: "in-progress",
      currentChapter: 7,
      completedThroughChapter: 6,
    }]);
    expect(result.progressRevision).toBe(1);
    expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not return a reading context for an already stale snapshot", async () => {
    const { gateway } = setup(snapshot(8));
    expect(await gateway.readingContext({ progress: snapshot(7) })).toEqual({
      status: "unavailable",
      reason: "progress-changed",
    });
  });

  it("discards a reading context if the authoritative snapshot changes during construction", async () => {
    const initial = snapshot(7);
    let calls = 0;
    const gateway = createHoidConversationGateway({
      runtime: { answer: vi.fn(async (_input: unknown) => answer) },
      getCurrentProgress: () => {
        calls += 1;
        return calls === 1 ? initial : snapshot(8);
      },
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.readingContext({ progress: initial })).toEqual({
      status: "unavailable",
      reason: "progress-changed",
    });
  });

  it("rejects malformed reading-context requests before reading progress", async () => {
    const { gateway } = setup();
    expect(await gateway.readingContext({ progress: snapshot(3), extra: true })).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
  });

  it("reports explicit completion without exposing a fabricated chapter count", async () => {
    const current = {
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "twok", completed: true }],
      updatedAt: UPDATED_AT,
    };
    const { gateway } = setup(current);
    const result = await gateway.readingContext({ progress: current });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions[0]).toMatchObject({
      status: "completed",
      completedThrough: "entire-work",
    });
    expect(result.context.positions[0]).not.toHaveProperty("currentChapter");
  });


  it("blocks a known but unauthorized entity mention before invoking the answer runtime", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current, () => ({ status: "blocked" }));
    const result = await gateway.answer({ question: "Pregunta con alias bloqueado", progress: current });

    expect(result).toEqual({ status: "unavailable", reason: "entity-blocked" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("blocks ambiguous authorized entity mentions instead of selecting one silently", async () => {
    const current = snapshot(3);
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const { gateway, runtime } = setup(current, () => ({
      status: "ready",
      resolution: "ambiguous",
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      matches: [],
      truncated: false,
    }));
    const result = await gateway.answer({ question: "Pregunta ambigua", progress: current });

    expect(result).toEqual({ status: "unavailable", reason: "entity-ambiguous" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("rejects an entity resolver result bound to another progress identity", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current, () => ({
      status: "ready",
      resolution: "not-found",
      progressRevision: 1,
      progressFingerprint: "0".repeat(64),
      matches: [],
      truncated: false,
    }));
    const result = await gateway.answer({ question: "Pregunta", progress: current });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("contains entity resolver failures without invoking the answer runtime", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current, () => { throw new Error("synthetic resolver failure"); });
    const result = await gateway.answer({ question: "Pregunta", progress: current });

    expect(result).toEqual({ status: "unavailable", reason: "entity-unavailable" });
    expect(runtime.answer).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("synthetic resolver failure");
  });

  it("forwards all unambiguous matched entity IDs to the strict runtime", async () => {
    const current = snapshot(3);
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const resolver = (() => ({
      status: "ready",
      resolution: "matched",
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      matches: [{ id: "e-alpha" }, { id: "e-beta" }],
      truncated: false,
    })) as unknown as NonNullable<HoidConversationGatewayConfig["resolveEntities"]>;
    const { gateway, runtime } = setup(current, resolver);

    const result = await gateway.answer({
      question: "Compara Personaje Alfa con Personaje Beta",
      progress: current,
    });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith({
      question: "Compara Personaje Alfa con Personaje Beta",
      progress: current,
      intent: "explain",
      entityIds: ["e-alpha", "e-beta"],
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
    }, undefined);
  });

  it("rejects malformed matched entity IDs before invoking the strict runtime", async () => {
    const current = snapshot(3);
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const resolver = (() => ({
      status: "ready",
      resolution: "matched",
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      matches: [{ id: "e-alpha" }, { id: "e-alpha" }],
      truncated: false,
    })) as unknown as NonNullable<HoidConversationGatewayConfig["resolveEntities"]>;
    const { gateway, runtime } = setup(current, resolver);

    expect(await gateway.answer({ question: "Pregunta", progress: current })).toEqual({
      status: "unavailable",
      reason: "entity-unavailable",
    });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

});

describe("Hoid spoiler-safe conversational follow-ups", () => {
  function contextFor(progress: unknown) {
    const projection = projectHoidCursorProgressSnapshot(progress);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const context = createHoidConversationContext(
      ["synthetic.entity-alpha", "synthetic.entity-beta"],
      {
        revision: projection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(projection),
      },
    );
    if (!context) throw new Error("Contexto sintético no disponible");
    return context;
  }

  it("routes a scoped group follow-up through the strict evidence runtime, not the unscoped graph shortcut", async () => {
    const current = snapshot(3);
    const relationshipGateway = {
      answer: vi.fn(() => ({ status: "unavailable" as const, reason: "entity-ambiguous" as const })),
    };
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y entre ellos?",
      progress: current,
      context: contextFor(current),
      bookScope: { mode: "cross-work", bookIds: ["twok", "edgedancer"] },
    });

    expect(result.status).toBe("ready");
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(runtime.answer).toHaveBeenCalledWith(expect.objectContaining({
      entityIds: ["synthetic.entity-alpha", "synthetic.entity-beta"],
      bookScope: { mode: "cross-work", bookIds: ["edgedancer", "twok"] },
    }), undefined);
  });

  it("routes an explicit group follow-up through the graph with only prior canonical IDs", async () => {
    const current = snapshot(3);
    const relationshipGateway = {
      answer: vi.fn(() => ({ status: "unavailable" as const, reason: "entity-ambiguous" as const })),
    };
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y entre ellos?",
      progress: current,
      context: contextFor(current),
    });

    expect(result).toEqual({ status: "unavailable", reason: "entity-ambiguous" });
    expect(relationshipGateway.answer).toHaveBeenCalledWith({
      question: "¿Y entre ellos?",
      progress: current,
      entityIds: ["synthetic.entity-alpha", "synthetic.entity-beta"],
    });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("blocks singular pronouns instead of guessing which prior entity they name", async () => {
    const current = snapshot(3);
    const relationshipGateway = { answer: vi.fn() };
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y ella?",
      progress: current,
      context: contextFor(current),
    });

    expect(result).toEqual({ status: "unavailable", reason: "context-ambiguous" });
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("blocks a group follow-up when the stored progress fingerprint is stale", async () => {
    const oldProgress = snapshot(3);
    const current = snapshot(4);
    const relationshipGateway = { answer: vi.fn() };
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y entre ellos?",
      progress: current,
      context: contextFor(oldProgress),
    });

    expect(result).toEqual({ status: "unavailable", reason: "context-stale" });
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("does not send a group follow-up to the general runtime when context is missing", async () => {
    const current = snapshot(3);
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.answer({
      question: "¿Y entre ellos?",
      progress: current,
    })).toEqual({ status: "unavailable", reason: "context-unavailable" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("does not pass an old context to an unrelated new question", async () => {
    const current = snapshot(3);
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Qué información está autorizada?",
      progress: current,
      context: contextFor(current),
    });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledTimes(1);
    expect(runtime.answer.mock.calls[0][0]).not.toHaveProperty("context");
  });
});


describe("HoidConversationGateway reviewed pronoun follow-ups", () => {
  function contextAndProgress(current: unknown) {
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const context = createHoidConversationContext(
      ["synthetic.entity-alpha", "synthetic.entity-beta"],
      {
        revision: projection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(projection),
      },
    );
    if (!context) throw new Error("Contexto sintético no disponible");
    return { context, projection };
  }

  it("sends only the uniquely reauthorized entity ID to the strict runtime", async () => {
    const current = snapshot(3);
    const { context, projection } = contextAndProgress(current);
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const resolveCoreference = vi.fn(() => ({
      status: "resolved" as const,
      entityId: "synthetic.entity-beta",
      context,
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    }));
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      resolveCoreference,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y ella?",
      progress: current,
      context,
    });

    expect(result.status).toBe("ready");
    expect(resolveCoreference).toHaveBeenCalledWith("¿Y ella?", context, current);
    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Y ella?",
      progress: current,
      intent: "explain",
      entityIds: ["synthetic.entity-beta"],
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
    }, undefined);
    expect(runtime.answer.mock.calls[0][0]).not.toHaveProperty("context");
    if (result.status === "ready") expect(result.conversationContext).toEqual(context);
  });

  it("does not invoke the runtime or relationship graph when coreference is ambiguous", async () => {
    const current = snapshot(3);
    const { context, projection } = contextAndProgress(current);
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const relationshipGateway = { answer: vi.fn() };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
      resolveCoreference: () => ({
        status: "unavailable" as const,
        reason: "ambiguous-reference" as const,
      }),
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({ question: "¿Y ella?", progress: current, context });
    expect(result).toEqual({ status: "unavailable", reason: "context-ambiguous" });
    expect(runtime.answer).not.toHaveBeenCalled();
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(projection.status).toBe("ready");
  });

  it("discards a pronoun answer if progress changes while the runtime is pending", async () => {
    const initial = snapshot(3);
    const { context, projection } = contextAndProgress(initial);
    let current: unknown = initial;
    let finish: ((value: HoidEvidenceAnswer) => void) | undefined;
    let markRuntimeStarted: (() => void) | undefined;
    const runtimeStarted = new Promise<void>(resolve => { markRuntimeStarted = resolve; });
    const runtime = {
      answer: vi.fn(() => {
        markRuntimeStarted?.();
        return new Promise<HoidEvidenceAnswer>(resolve => { finish = resolve; });
      }),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      resolveCoreference: () => ({
        status: "resolved" as const,
        entityId: "synthetic.entity-beta",
        context,
        progressRevision: projection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      }),
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({ question: "¿Y ella?", progress: initial, context });
    await runtimeStarted;
    current = snapshot(4);
    finish?.(answer);
    expect(await pending).toEqual({ status: "unavailable", reason: "progress-changed" });
  });
});


describe("HoidConversationGateway pronoun relationship routing", () => {
  it("routes a uniquely resolved pronoun relationship through the local graph for a two-entity context", async () => {
    const current = snapshot(3);
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const context = createHoidConversationContext(
      ["synthetic.entity-alpha", "synthetic.entity-beta"],
      {
        revision: projection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(projection),
      },
    );
    if (!context) throw new Error("Contexto sintético no disponible");
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const relationshipGateway = {
      answer: vi.fn(() => ({
        status: "unavailable" as const,
        reason: "entity-ambiguous" as const,
      })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
      resolveCoreference: () => ({
        status: "resolved" as const,
        entityId: "synthetic.entity-beta",
        context,
        progressRevision: projection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      }),
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y cómo se relaciona con ella?",
      progress: current,
      context,
    });
    expect(result).toEqual({ status: "unavailable", reason: "entity-ambiguous" });
    expect(relationshipGateway.answer).toHaveBeenCalledWith({
      question: "¿Y cómo se relaciona con ella?",
      progress: current,
      entityIds: ["synthetic.entity-alpha", "synthetic.entity-beta"],
    });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("abstains when a relational pronoun is used with a context larger than a pair", async () => {
    const current = snapshot(3);
    const projection = projectHoidCursorProgressSnapshot(current);
    if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
    const context = createHoidConversationContext(
      ["synthetic.entity-alpha", "synthetic.entity-beta", "synthetic.entity-gamma"],
      {
        revision: projection.revision,
        fingerprint: fingerprintHoidCursorProgressProjection(projection),
      },
    );
    if (!context) throw new Error("Contexto sintético no disponible");
    const runtime = { answer: vi.fn(async (_input: unknown) => answer) };
    const relationshipGateway = { answer: vi.fn() };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
      resolveCoreference: () => ({
        status: "resolved" as const,
        entityId: "synthetic.entity-beta",
        context,
        progressRevision: projection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      }),
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Y cómo se relaciona con ella?",
      progress: current,
      context,
    });
    expect(result).toEqual({ status: "unavailable", reason: "context-ambiguous" });
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("rejects unread discovery before an in-progress work has been offered for resumption", async () => {
    const current = snapshot(3);
    const runtime = {
      answer: vi.fn(async (_input: unknown) => answer),
      recommend: vi.fn(async () => ({
        status: "ready" as const,
        items: [
          tfeRecommendation,
          {
            sourceId: "twok",
            title: "El Camino de los Reyes",
            reason: "resume-current-work",
            currentChapter: 3,
            completedThroughChapter: 2,
          },
        ],
      })),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.recommend({ progress: current, limit: 2 }))
      .toEqual({ status: "unavailable", reason: "invalid-recommendations" });
  });

  it("rejects unread recommendations that do not follow canonical bibliography order", async () => {
    const current = snapshot(3);
    const gateway = createHoidConversationGateway({
      runtime: {
        answer: vi.fn(async (_input: unknown) => answer),
        recommend: vi.fn(async () => ({
          status: "ready" as const,
          items: [elantrisRecommendation, tfeRecommendation],
        })),
      },
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.recommend({ progress: current, limit: 2 }))
      .toEqual({ status: "unavailable", reason: "invalid-recommendations" });
  });

  it("rejects active-work recommendations that contradict the reader's recorded order", async () => {
    const twokCursor = createHoidReadingCursor("twok", 3);
    const worCursor = createHoidReadingCursor("wor", 5);
    if (twokCursor.status !== "ready" || worCursor.status !== "ready") {
      throw new Error("Cursores sintéticos no disponibles");
    }
    const current = {
      schemaVersion: 2,
      revision: 2,
      positions: [
        { bookId: "twok", cursor: twokCursor.cursor, order: 1 },
        { bookId: "wor", cursor: worCursor.cursor, order: 2 },
      ],
      updatedAt: UPDATED_AT,
    };
    const gateway = createHoidConversationGateway({
      runtime: {
        answer: vi.fn(async (_input: unknown) => answer),
        recommend: vi.fn(async () => ({
          status: "ready" as const,
          items: [
            {
              sourceId: "wor",
              title: "Palabras radiantes",
              reason: "resume-current-work",
              currentChapter: 5,
              completedThroughChapter: 4,
            },
            {
              sourceId: "twok",
              title: "El Camino de los Reyes",
              reason: "resume-current-work",
              currentChapter: 3,
              completedThroughChapter: 2,
            },
          ],
        })),
      },
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.recommend({ progress: current, limit: 2 }))
      .toEqual({ status: "unavailable", reason: "invalid-recommendations" });
  });
  it("forwards caller cancellation options to the strict runtime", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const controller = new AbortController();
    const result = await gateway.answer({
      question: "¿Qué se ha autorizado?",
      progress: current,
    }, { signal: controller.signal });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith(
      expect.objectContaining({ question: "¿Qué se ha autorizado?" }),
      { signal: controller.signal },
    );
  });

  it("discards a late answer when the caller aborts even if the runtime ignores the signal", async () => {
    let finish: ((value: HoidEvidenceAnswer) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const current = snapshot(3);
    const runtime = {
      answer: vi.fn(() => {
        markStarted?.();
        return new Promise<HoidEvidenceAnswer>(resolve => { finish = resolve; });
      }),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");
    const controller = new AbortController();

    const pending = gateway.answer(
      { question: "Pregunta sintética", progress: current },
      { signal: controller.signal },
    );
    await started;
    controller.abort();
    finish?.(answer);

    expect(await pending).toEqual({ status: "unavailable", reason: "cancelled" });
  });

  it("does not invoke the runtime when the caller signal is already aborted", async () => {
    const current = snapshot(3);
    const { gateway, runtime } = setup(current);
    const controller = new AbortController();
    controller.abort();

    const result = await gateway.answer(
      { question: "Pregunta sintética", progress: current },
      { signal: controller.signal },
    );

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("discards a late recommendation when the caller aborts", async () => {
    let finish: ((value: unknown) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const current = snapshot(3);
    const runtime = {
      answer: vi.fn(async (_input: unknown) => answer),
      recommend: vi.fn(() => {
        markStarted?.();
        return new Promise<unknown>(resolve => { finish = resolve; });
      }),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");
    const controller = new AbortController();

    const pending = gateway.recommend(
      { progress: current, limit: 2 },
      { signal: controller.signal },
    );
    await started;
    controller.abort();
    finish?.({ status: "ready", items: [tfeRecommendation] });

    expect(await pending).toEqual({ status: "unavailable", reason: "cancelled" });
  });

  it("discards an answer if the caller aborts during the final durable progress read", async () => {
    const current = snapshot(3);
    let reads = 0;
    let markFinalRead: (() => void) | undefined;
    const finalReadStarted = new Promise<void>(resolve => { markFinalRead = resolve; });
    let finishRead: ((value: unknown) => void) | undefined;
    const finalRead = new Promise<unknown>(resolve => { finishRead = resolve; });
    const gateway = createHoidConversationGateway({
      runtime: { answer: vi.fn(async () => answer) },
      getCurrentProgress: () => current,
      refreshCurrentProgress: async () => {
        reads += 1;
        if (reads === 1) return current;
        if (reads === 2) {
          markFinalRead?.();
          return finalRead;
        }
        return current;
      },
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");
    const controller = new AbortController();

    const pending = gateway.answer(
      { question: "Pregunta sintética", progress: current },
      { signal: controller.signal },
    );
    await finalReadStarted;
    controller.abort();
    finishRead?.(current);

    expect(await pending).toEqual({ status: "unavailable", reason: "cancelled" });
  });


});
