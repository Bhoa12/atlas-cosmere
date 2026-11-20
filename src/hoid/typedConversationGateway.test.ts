import { describe, expect, it, vi } from "vitest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import {
  createHoidConversationGateway,
  type HoidConversationGatewayConfig,
} from "./conversationGateway";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { createHoidTypedConversationContext } from "./typedConversationContext";
import { HOID_EXPLANATION_DEPTH_BUDGETS } from "./explanationDepth";

const UPDATED_AT = "2026-11-18T15:00:00.000Z";

function snapshot(chapter = 4, revision = 9) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "twok", cursor: cursor.cursor }],
    updatedAt: UPDATED_AT,
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

const refs = Object.freeze([
  Object.freeze({ id: "synthetic.character-a", kind: "character" as const }),
  Object.freeze({ id: "synthetic.organization-a", kind: "organization" as const }),
  Object.freeze({ id: "synthetic.object-a", kind: "object" as const }),
  Object.freeze({ id: "synthetic.phenomenon-a", kind: "phenomenon" as const }),
]);

function typedContext(progress: unknown = snapshot()) {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Synthetic progress invalid");
  const context = createHoidTypedConversationContext(refs, {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
  if (!context) throw new Error("Synthetic typed context invalid");
  return context;
}

function setup(
  initial = snapshot(),
  resolver: NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]> = (progress, ids) => {
    const projection = projectHoidCursorProgressSnapshot(progress);
    if (projection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" };
    const kindById = new Map(refs.map(item => [item.id, item.kind]));
    return {
      status: "ready",
      resolution: "matched",
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      matches: ids.map(id => ({ id, kind: kindById.get(id) })),
      truncated: false,
    } as unknown as ReturnType<NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>>;
  },
) {
  let current: unknown = initial;
  const runtime = { answer: vi.fn(async () => answer) };
  const config: HoidConversationGatewayConfig = {
    runtime,
    getCurrentProgress: () => current,
    resolveEntityIds: resolver,
  };
  const gateway = createHoidConversationGateway(config);
  if (!gateway) throw new Error("Synthetic gateway unavailable");
  return {
    gateway,
    runtime,
    setCurrent(value: unknown) { current = value; },
  };
}

describe("Hoid typed entity follow-up gateway", () => {
  it("reauthorizes every context ID and sends only the unique typed target to the runtime", async () => {
    const current = snapshot();
    const resolver = vi.fn((progress: unknown, ids: readonly string[]) => {
      const projection = projectHoidCursorProgressSnapshot(progress);
      if (projection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" } as const;
      const kinds = new Map(refs.map(item => [item.id, item.kind]));
      return {
        status: "ready",
        resolution: "matched",
        progressRevision: projection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
        matches: ids.map(id => ({ id, kind: kinds.get(id) })),
        truncated: false,
      } as unknown as ReturnType<NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>>;
    });
    const { gateway, runtime } = setup(current, resolver);
    const result = await gateway.answer({
      question: "¿Y esa organización?",
      progress: current,
      typedContext: typedContext(current),
    });

    expect(result.status).toBe("ready");
    expect(resolver).toHaveBeenCalledWith(current, refs.map(item => item.id));
    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Y esa organización?",
      progress: current,
      intent: "explain",
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
      entityIds: ["synthetic.organization-a"],
    });
    if (result.status === "ready") {
      expect(result.typedConversationContext?.entities).toEqual(refs);
    }
  });

  it("blocks a recognized typed follow-up when context is missing", async () => {
    const current = snapshot();
    const { gateway, runtime, } = setup(current);
    expect(await gateway.answer({ question: "¿Y ese objeto?", progress: current })).toEqual({
      status: "unavailable",
      reason: "context-unavailable",
    });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("resolves a phenomenon follow-up and sends only its canonical ID", async () => {
    const current = snapshot();
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({
      question: "¿Y ese fenómeno?",
      progress: current,
      typedContext: typedContext(current),
    });
    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Y ese fenómeno?",
      progress: current,
      intent: "explain",
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.detailed,
      entityIds: ["synthetic.phenomenon-a"],
    });
  });

  it("forwards an explicitly requested brief budget through a typed phenomenon follow-up", async () => {
    const current = snapshot();
    const { gateway, runtime } = setup(current);
    const result = await gateway.answer({
      question: "¿Y ese fenómeno?",
      progress: current,
      typedContext: typedContext(current),
      depth: "brief",
    });

    expect(result.status).toBe("ready");
    expect(runtime.answer).toHaveBeenCalledWith({
      question: "¿Y ese fenómeno?",
      progress: current,
      intent: "explain",
      selectionBudget: HOID_EXPLANATION_DEPTH_BUDGETS.brief,
      entityIds: ["synthetic.phenomenon-a"],
    });
  });

  it("blocks ambiguous categories before entity reauthorization and runtime invocation", async () => {
    const current = snapshot();
    const ambiguous = typedContext(current);
    const twoOrganizations = createHoidTypedConversationContext([
      refs[1],
      { id: "synthetic.organization-b", kind: "organization" },
    ], {
      revision: ambiguous.progressRevision,
      fingerprint: ambiguous.progressFingerprint,
    });
    const resolver = vi.fn();
    const { gateway, runtime } = setup(current, resolver as HoidConversationGatewayConfig["resolveEntityIds"]);
    expect(await gateway.answer({
      question: "¿Y esa organización?",
      progress: current,
      typedContext: twoOrganizations,
    })).toEqual({ status: "unavailable", reason: "context-ambiguous" });
    expect(resolver).not.toHaveBeenCalled();
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("blocks a typed context whose stored kinds disagree with the live entity registry", async () => {
    const current = snapshot();
    const mismatched = vi.fn((progress: unknown, ids: readonly string[]) => {
      const projection = projectHoidCursorProgressSnapshot(progress);
      if (projection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" } as const;
      return {
        status: "ready",
        resolution: "matched",
        progressRevision: projection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
        matches: ids.map(id => ({ id, kind: "character" })),
        truncated: false,
      } as unknown as ReturnType<NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>>;
    });
    const { gateway, runtime } = setup(current, mismatched);
    expect(await gateway.answer({
      question: "¿Y esa organización?",
      progress: current,
      typedContext: typedContext(current),
    })).toEqual({ status: "unavailable", reason: "context-unavailable" });
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("discards the answer if progress changes while the strict runtime is pending", async () => {
    let finish!: (value: HoidEvidenceAnswer) => void;
    let markRuntimeStarted!: () => void;
    const runtimeStarted = new Promise<void>(resolve => { markRuntimeStarted = resolve; });
    const initial = snapshot();
    let current: unknown = initial;
    const projection = projectHoidCursorProgressSnapshot(initial);
    if (projection.status !== "ready") throw new Error("Synthetic progress invalid");
    const typed = createHoidTypedConversationContext(refs, {
      revision: projection.revision,
      fingerprint: fingerprintHoidCursorProgressProjection(projection),
    });
    if (!typed) throw new Error("Synthetic context invalid");
    const runtime = {
      answer: vi.fn(() => {
        markRuntimeStarted();
        return new Promise<HoidEvidenceAnswer>(resolve => { finish = resolve; });
      }),
    };
    const resolver = (progress: unknown, ids: readonly string[]) => {
      const currentProjection = projectHoidCursorProgressSnapshot(progress);
      if (currentProjection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" } as const;
      const kinds = new Map(refs.map(item => [item.id, item.kind]));
      return {
        status: "ready",
        resolution: "matched",
        progressRevision: currentProjection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(currentProjection),
        matches: ids.map(id => ({ id, kind: kinds.get(id) })),
        truncated: false,
      } as unknown as ReturnType<NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>>;
    };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => current,
      resolveEntityIds: resolver,
    });
    if (!gateway) throw new Error("Synthetic gateway unavailable");

    const pending = gateway.answer({
      question: "¿Y ese objeto?",
      progress: initial,
      typedContext: typed,
    });
    await runtimeStarted;
    current = snapshot(5);
    finish(answer);

    expect(await pending).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(runtime.answer).toHaveBeenCalledTimes(1);
  });
});
