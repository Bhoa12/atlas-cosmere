import { describe, expect, it, vi } from "vitest";
import type { HoidEvidenceAnswer, HoidRuntimeCallOptions } from "./evidenceRuntime";
import {
  createHoidConversationGateway,
  type HoidConversationGatewayConfig,
} from "./conversationGateway";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./cursorProgressFingerprint";
import { createHoidConversationContext } from "./conversationContext";
import { createHoidTypedConversationContext } from "./typedConversationContext";

const UPDATED_AT = "2026-11-23T00:00:00.000Z";

function snapshot(chapter: number, revision = 1) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor sintético no disponible");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "twok", cursor: cursor.cursor }],
    updatedAt: UPDATED_AT,
  };
}

function progressIdentity(progress: unknown) {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Snapshot sintético inválido");
  return {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  };
}

const authorizedAnswer: HoidEvidenceAnswer = Object.freeze({
  status: "abstain",
  reason: "no-authorized-evidence",
  text: "No hay afirmaciones editoriales autorizadas para esta consulta.",
  claimIds: Object.freeze([]),
  evidenceIds: Object.freeze([]),
  sources: Object.freeze([]),
});

function deferredRuntime() {
  let resolveAnswer: ((value: HoidEvidenceAnswer) => void) | undefined;
  let markStarted: (() => void) | undefined;
  let observedSignal: AbortSignal | undefined;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const runtime = {
    answer: vi.fn((_input: unknown, options?: HoidRuntimeCallOptions) => {
      observedSignal = options?.signal;
      markStarted?.();
      return new Promise<HoidEvidenceAnswer>(resolve => { resolveAnswer = resolve; });
    }),
  };
  return {
    runtime,
    started,
    signal: () => observedSignal,
    finish(value: HoidEvidenceAnswer = authorizedAnswer) {
      if (!resolveAnswer) throw new Error("El runtime todavía no ha iniciado");
      resolveAnswer(value);
    },
  };
}

describe("Hoid conversation progress race matrix", () => {
  it("discards a typed-entity follow-up when the reader advances during provider work", async () => {
    const initial = snapshot(3);
    const identity = progressIdentity(initial);
    const typedContext = createHoidTypedConversationContext([
      { id: "synthetic.entity-alpha", kind: "character" },
      { id: "synthetic.place-beta", kind: "place" },
    ], identity);
    if (!typedContext) throw new Error("Contexto tipado sintético no disponible");

    const { runtime, started, finish } = deferredRuntime();
    let current: unknown = initial;
    const resolveEntityIds = (() => ({
      status: "ready",
      resolution: "matched",
      progressRevision: identity.revision,
      progressFingerprint: identity.fingerprint,
      matches: [
        { id: "synthetic.entity-alpha", kind: "character" },
        { id: "synthetic.place-beta", kind: "place" },
      ],
      truncated: false,
    })) as unknown as NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>;
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      resolveEntityIds,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({
      question: "¿Y ese personaje?",
      progress: initial,
      typedContext,
    });
    await started;
    current = snapshot(4, 2);
    finish();

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(result).not.toHaveProperty("answer");
    expect(result).not.toHaveProperty("conversationContext");
    expect(runtime.answer).toHaveBeenCalledTimes(1);
  });

  it("discards a scoped group follow-up when one of its reading positions changes in flight", async () => {
    const initial = snapshot(3);
    const identity = progressIdentity(initial);
    const context = createHoidConversationContext(
      ["synthetic.entity-alpha", "synthetic.entity-beta"],
      identity,
    );
    if (!context) throw new Error("Contexto de grupo sintético no disponible");

    const { runtime, started, finish } = deferredRuntime();
    let current: unknown = initial;
    const relationshipGateway = { answer: vi.fn() };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({
      question: "¿Y entre ellos?",
      progress: initial,
      context,
      bookScope: { mode: "cross-work", bookIds: ["twok", "edgedancer"] },
    });
    await started;
    current = snapshot(4, 2);
    finish();

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(result).not.toHaveProperty("answer");
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(runtime.answer).toHaveBeenCalledTimes(1);
  });

  it("discards a coreference-resolved answer when the authoritative progress changes in flight", async () => {
    const initial = snapshot(3);
    const identity = progressIdentity(initial);
    const context = createHoidConversationContext(
      ["synthetic.entity-alpha", "synthetic.entity-beta"],
      identity,
    );
    if (!context) throw new Error("Contexto de coreferencia sintético no disponible");

    const { runtime, started, finish } = deferredRuntime();
    let current: unknown = initial;
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

    const pending = gateway.answer({
      question: "Cuéntame más sobre él",
      progress: initial,
    });
    await started;
    current = snapshot(4, 2);
    finish();

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(result).not.toHaveProperty("answer");
    expect(runtime.answer).toHaveBeenCalledTimes(1);
  });

  it("uses the durable refresh port before and after async work instead of trusting a stale cache", async () => {
    const initial = snapshot(3);
    const { runtime, started, finish } = deferredRuntime();
    let durable: unknown = initial;
    const refreshCurrentProgress = vi.fn(async () => durable);
    const getCurrentProgress = vi.fn(() => initial);
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress,
      refreshCurrentProgress,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({
      question: "¿Qué se ha autorizado?",
      progress: initial,
    });
    await started;
    durable = snapshot(4, 2);
    finish();

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(result).not.toHaveProperty("answer");
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(2);
    expect(getCurrentProgress).not.toHaveBeenCalled();
  });

  it("aborts in-flight provider work on a committed progress event and always unsubscribes", async () => {
    const initial = snapshot(3);
    const { runtime, started, finish, signal } = deferredRuntime();
    let listener: (() => void) | undefined;
    const unsubscribe = vi.fn(() => { listener = undefined; });
    const subscribeToProgressChanges = vi.fn((notify: () => void) => {
      listener = notify;
      return unsubscribe;
    });
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => initial,
      refreshCurrentProgress: () => initial,
      subscribeToProgressChanges,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({ question: "Explica la evidencia autorizada", progress: initial });
    await started;
    expect(signal()?.aborted).toBe(false);
    listener?.();
    expect(signal()?.aborted).toBe(true);
    // This provider deliberately ignores AbortSignal; the gateway must still discard its result.
    finish();

    expect(await pending).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribeToProgressChanges).toHaveBeenCalledTimes(1);
  });

  it("rechecks durable progress after subscription to close the missed-event setup gap", async () => {
    const initial = snapshot(3);
    const advanced = snapshot(4, 2);
    const runtime = { answer: vi.fn(async (_input: unknown) => authorizedAnswer) };
    let reads = 0;
    const refreshCurrentProgress = vi.fn(async () => {
      reads += 1;
      return reads === 1 ? initial : advanced;
    });
    const unsubscribe = vi.fn();
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => initial,
      refreshCurrentProgress,
      subscribeToProgressChanges: () => unsubscribe,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({ question: "Explica", progress: initial });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(runtime.answer).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(2);
  });

  it("fails closed without invoking the provider when the progress subscription cannot be installed", async () => {
    const initial = snapshot(3);
    const runtime = { answer: vi.fn(async (_input: unknown) => authorizedAnswer) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => initial,
      subscribeToProgressChanges: () => { throw new Error("ledger event port unavailable"); },
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    expect(await gateway.answer({ question: "Explica", progress: initial })).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("aborts in-flight recommendation work when the reader advances", async () => {
    const initial = snapshot(3);
    let markStarted: (() => void) | undefined;
    let finish: ((value: unknown) => void) | undefined;
    let observedSignal: AbortSignal | undefined;
    let listener: (() => void) | undefined;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const unsubscribe = vi.fn(() => { listener = undefined; });
    const runtime = {
      answer: vi.fn(async (_input: unknown) => authorizedAnswer),
      recommend: vi.fn((_progress: unknown, _limit: number | undefined, options?: HoidRuntimeCallOptions) => {
        observedSignal = options?.signal;
        markStarted?.();
        return new Promise<unknown>(resolve => { finish = resolve; });
      }),
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => initial,
      refreshCurrentProgress: () => initial,
      subscribeToProgressChanges: notify => {
        listener = notify;
        return unsubscribe;
      },
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.recommend({ progress: initial, limit: 2 });
    await started;
    listener?.();
    expect(observedSignal?.aborted).toBe(true);
    finish?.({ status: "ready", items: [] });

    expect(await pending).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes after a watched provider call completes without a progress change", async () => {
    const initial = snapshot(3);
    const { runtime, started, finish, signal } = deferredRuntime();
    const unsubscribe = vi.fn();
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => initial,
      refreshCurrentProgress: () => initial,
      subscribeToProgressChanges: () => unsubscribe,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const pending = gateway.answer({ question: "Explica", progress: initial });
    await started;
    finish();
    const result = await pending;

    expect(result.status).toBe("ready");
    expect(signal()?.aborted).toBe(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
