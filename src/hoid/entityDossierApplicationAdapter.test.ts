import { describe, expect, it, vi } from "vitest";
import {
  createHoidEntityDossierApplicationAdapter,
  type HoidEntityDossierApplicationDispatch,
} from "./entityDossierApplicationAdapter";
import type { HoidEntityDossierConversationAdapter } from "./entityDossierConversation";
import type { HoidConversationRouteExecutionInput } from "./conversationRouteExecution";

const progress = Object.freeze({
  revision: 7,
  fingerprint: "a".repeat(64),
});
const changedProgress = Object.freeze({
  revision: 8,
  fingerprint: "b".repeat(64),
});
const progressSnapshot = Object.freeze({ schemaVersion: 2, revision: 7 });

const routeInput: HoidConversationRouteExecutionInput = Object.freeze({
  intentPlan: Object.freeze({
    status: "ready" as const,
    intent: "explain" as const,
    mode: "explanation" as const,
    signal: "default-explanation" as const,
  }),
  dossierIntent: Object.freeze({ status: "ready" as const, entityName: "Vin" }),
  relationshipIntent: Object.freeze({ status: "not-relationship" as const }),
  timelineIntent: Object.freeze({ status: "not-timeline" as const }),
  magicSystemIntent: Object.freeze({ status: "not-magic" as const }),
  characterEvolutionIntent: Object.freeze({ status: "not-evolution" as const }),
  answerScope: Object.freeze({
    status: "ready" as const,
    scope: Object.freeze({
      mode: "single-work" as const,
      bookIds: Object.freeze(["tfe"]),
    }),
    focus: null,
    source: "automatic-focus" as const,
  }),
  trustedConversationAvailable: false,
});

function createDispatch(
  answer: HoidEntityDossierConversationAdapter["answer"],
  overrides: Partial<HoidEntityDossierApplicationDispatch> = {},
): HoidEntityDossierApplicationDispatch {
  const adapter = Object.freeze({ answer }) as unknown as HoidEntityDossierConversationAdapter;
  return Object.freeze({
    adapter,
    question: "¿Quién es Vin?",
    entityName: "Vin",
    progress: progressSnapshot,
    depth: "detailed",
    isCurrent: () => true,
    ...overrides,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => {
    resolve = complete;
  });
  return Object.freeze({ promise, resolve: (value: T) => resolve(value) });
}

describe("Hoid entity dossier application adapter", () => {
  it("dispatches only a ready dossier route through the existing local dossier adapter", async () => {
    const dossierResult = Object.freeze({ status: "not-found" as const });
    const answer = vi.fn(async () => dossierResult);
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const controller = new AbortController();
    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toBe(dossierResult);
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(answer).toHaveBeenCalledWith({
      question: "¿Quién es Vin?",
      progress: progressSnapshot,
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
      depth: "detailed",
    }, { signal: controller.signal });
  });

  it("does not call the dossier adapter when progress is stale before dispatch", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress: async () => changedProgress,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("discards a dossier result if progress changes after the adapter returns", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    let reads = 0;
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress: async () => {
        reads += 1;
        return reads === 1 ? progress : changedProgress;
      },
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-dossier route without invoking the local adapter", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");
    const nonDossierRoute = Object.freeze({
      ...routeInput,
      dossierIntent: Object.freeze({ status: "not-dossier" as const }),
      trustedConversationAvailable: true,
    });

    const result = await adapter.execute(nonDossierRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a dispatch whose entity identity differs from the resolved route", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { entityName: "Kelsier" });
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a mutable dispatch snapshot before calling the dossier adapter", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const frozenDispatch = createDispatch(answer);
    const mutableDispatch = { ...frozenDispatch };
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => mutableDispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not dispatch when the UI turn is no longer current", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { isCurrent: () => false });
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const result = await adapter.execute(routeInput, progress, {
      isCurrent: dispatch.isCurrent,
    });

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not start progress reads or dispatch after cancellation", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");
    const controller = new AbortController();
    controller.abort();

    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects provider-bearing application ports at construction", () => {
    expect(() => createHoidEntityDossierApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => null,
      provider: { invoke: vi.fn() },
    })).toThrow();
  });

  it("invalidates an in-flight turn before it can dispatch", async () => {
    const pendingProgress = deferred<unknown>();
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidEntityDossierApplicationAdapter({
      readProgress: () => pendingProgress.promise,
      getCurrentDispatch: () => dispatch,
    });
    if (!adapter) throw new Error("Expected dossier application adapter");

    const pending = adapter.execute(routeInput, progress);
    adapter.invalidate();
    pendingProgress.resolve(progress);

    const result = await pending;
    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(answer).not.toHaveBeenCalled();
  });
});