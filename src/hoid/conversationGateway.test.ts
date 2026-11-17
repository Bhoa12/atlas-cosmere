import { describe, expect, it, vi } from "vitest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import {
  createHoidConversationGateway,
  type HoidConversationGatewayConfig,
} from "./conversationGateway";
import { createHoidReadingCursor } from "./readingManifest";

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
});
