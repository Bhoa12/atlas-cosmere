import { describe, expect, it, vi } from "vitest";
import {
  createHoidEntityRelationshipApplicationAdapter,
  type HoidEntityRelationshipApplicationDispatch,
} from "./entityRelationshipApplicationAdapter";
import type { HoidEntityRelationshipConversationAdapter } from "./entityRelationshipConversation";
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
const question = "¿Qué relación hay entre Entidad Alfa y Entidad Beta?";

const routeInput: HoidConversationRouteExecutionInput = Object.freeze({
  intentPlan: Object.freeze({
    status: "ready" as const,
    intent: "explain" as const,
    mode: "explanation" as const,
    signal: "default-explanation" as const,
  }),
  dossierIntent: Object.freeze({ status: "not-dossier" as const }),
  relationshipIntent: Object.freeze({
    status: "ready" as const,
    leftEntityName: "Entidad Alfa",
    rightEntityName: "Entidad Beta",
  }),
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
  answer: HoidEntityRelationshipConversationAdapter["answer"],
  overrides: Partial<HoidEntityRelationshipApplicationDispatch> = {},
): HoidEntityRelationshipApplicationDispatch {
  const adapter = Object.freeze({ answer }) as unknown as HoidEntityRelationshipConversationAdapter;
  return Object.freeze({
    adapter,
    question,
    leftEntityName: "Entidad Alfa",
    rightEntityName: "Entidad Beta",
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

describe("Hoid entity relationship application adapter", () => {
  it("dispatches only a ready relationship route through the existing evidence-bound adapter", async () => {
    const relationshipResult = Object.freeze({ status: "not-found" as const });
    const answer = vi.fn(async () => relationshipResult);
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });

    const controller = new AbortController();
    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toEqual(relationshipResult);
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith({
      question,
      progress: progressSnapshot,
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
      depth: "detailed",
    }, { signal: controller.signal });
  });

  it("rejects a dossier route before reading progress or invoking the relationship adapter", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const dossierRoute = Object.freeze({
      ...routeInput,
      dossierIntent: Object.freeze({ status: "ready" as const, entityName: "Entidad Alfa" }),
      relationshipIntent: Object.freeze({ status: "not-relationship" as const }),
    });

    const result = await adapter.execute(dossierRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not dispatch when progress is stale before execution", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => changedProgress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("discards the relationship result if progress changes after execution", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    let reads = 0;
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => {
        reads += 1;
        return reads === 1 ? progress : changedProgress;
      },
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("rejects a dispatch whose entity identities differ from the resolved route", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { rightEntityName: "Entidad Fantasma" });
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a dispatch question that parses to different entity identities", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, {
      question: "Relación entre Entidad Alfa y Entidad Fantasma",
    });
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects mutable dispatch snapshots", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const frozenDispatch = createDispatch(answer);
    const mutableDispatch = { ...frozenDispatch };
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => mutableDispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not dispatch after the UI turn is no longer current", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { isCurrent: () => false });
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

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
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const controller = new AbortController();
    controller.abort();

    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects provider-bearing application ports at construction", () => {
    expect(() => createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => null,
      provider: { invoke: vi.fn() },
    })).toThrow();
  });

  it("invalidates an in-flight turn before relationship dispatch", async () => {
    const pendingProgress = deferred<unknown>();
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: () => pendingProgress.promise,
      getCurrentDispatch: () => dispatch,
    });

    const pending = adapter.execute(routeInput, progress);
    adapter.invalidate();
    pendingProgress.resolve(progress);

    const result = await pending;

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("converts an unexpected non-relationship adapter result into a closed failure", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "needs-names" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidEntityRelationshipApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
  });
});
