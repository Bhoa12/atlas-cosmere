import { describe, expect, it, vi } from "vitest";
import {
  createHoidCharacterEvolutionApplicationAdapter,
  type HoidCharacterEvolutionApplicationDispatch,
} from "./entityEvolutionExplanationApplicationAdapter";
import type {
  HoidCharacterEvolutionExplanationAdapter,
  HoidCharacterEvolutionResult,
} from "./entityEvolutionExplanation";
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
const question = "Evolución de Personaje Alfa";

const routeInput: HoidConversationRouteExecutionInput = Object.freeze({
  intentPlan: Object.freeze({
    status: "ready" as const,
    intent: "explain" as const,
    mode: "explanation" as const,
    signal: "default-explanation" as const,
  }),
  dossierIntent: Object.freeze({ status: "not-dossier" as const }),
  relationshipIntent: Object.freeze({ status: "not-relationship" as const }),
  timelineIntent: Object.freeze({ status: "not-timeline" as const }),
  magicSystemIntent: Object.freeze({ status: "not-magic" as const }),
  characterEvolutionIntent: Object.freeze({
    status: "ready" as const,
    characterName: "Personaje Alfa",
  }),
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
  answer: HoidCharacterEvolutionExplanationAdapter["answer"],
  overrides: Partial<HoidCharacterEvolutionApplicationDispatch> = {},
): HoidCharacterEvolutionApplicationDispatch {
  const adapter = Object.freeze({ answer }) as unknown as HoidCharacterEvolutionExplanationAdapter;
  return Object.freeze({
    adapter,
    question,
    characterName: "Personaje Alfa",
    dimension: null,
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

describe("Hoid character evolution application adapter", () => {
  it("dispatches only a ready evolution route through the existing reviewed evidence adapter", async () => {
    const evolutionResult: HoidCharacterEvolutionResult = Object.freeze({ status: "not-found" });
    const answer = vi.fn(async () => evolutionResult);
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const controller = new AbortController();

    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toEqual(evolutionResult);
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith({
      question,
      progress: progressSnapshot,
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
      depth: "detailed",
    }, { signal: controller.signal });
  });

  it("rejects a dossier route before reading progress or invoking the evolution adapter", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const dossierRoute = Object.freeze({
      ...routeInput,
      dossierIntent: Object.freeze({ status: "ready" as const, entityName: "Personaje Alfa" }),
      characterEvolutionIntent: Object.freeze({ status: "not-evolution" as const }),
    });

    const result = await adapter.execute(dossierRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects an evolution intent that still needs a character name", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const incompleteRoute = Object.freeze({
      ...routeInput,
      characterEvolutionIntent: Object.freeze({ status: "needs-name" as const }),
    });

    const result = await adapter.execute(incompleteRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a dispatch whose question names a different character", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { characterName: "Personaje Beta" });
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("binds a dimension-specific question to the exact routed dimension", async () => {
    const capabilityQuestion = "Capacidades de Personaje Alfa";
    const capabilityRoute = Object.freeze({
      ...routeInput,
      characterEvolutionIntent: Object.freeze({
        status: "ready" as const,
        characterName: "Personaje Alfa",
        dimension: "capability" as const,
      }),
    });
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const mismatchedDispatch = createDispatch(answer, {
      question: capabilityQuestion,
      dimension: null,
    });
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => mismatchedDispatch,
    });

    const result = await adapter.execute(capabilityRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a route whose canonical character differs from the active dispatch", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const otherCharacterRoute = Object.freeze({
      ...routeInput,
      characterEvolutionIntent: Object.freeze({
        status: "ready" as const,
        characterName: "Personaje Beta",
      }),
    });
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(otherCharacterRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not dispatch when progress is stale before execution", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => changedProgress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("discards the complete result when progress changes after execution", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn()
      .mockResolvedValueOnce(progress)
      .mockResolvedValueOnce(changedProgress);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("does not read progress or dispatch after cancellation", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const getCurrentDispatch = vi.fn(() => dispatch);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress,
      getCurrentDispatch,
    });
    const controller = new AbortController();
    controller.abort();

    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(getCurrentDispatch).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a dispatch whose UI turn is no longer current", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { isCurrent: () => false });
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects mutable dispatch snapshots", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = {
      ...createDispatch(answer),
    };
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch as HoidCharacterEvolutionApplicationDispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("maps handler exceptions to a stable unavailable result", async () => {
    const dispatch = createDispatch(async () => {
      throw new Error("private adapter failure");
    });
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(JSON.stringify(result)).not.toContain("private adapter failure");
  });

  it("does not allow a recognized evolution route to degrade into an unrelated intent", async () => {
    const dispatch = createDispatch(async () => Object.freeze({ status: "needs-name" as const }));
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
  });

  it("maps stale, cancelled and superseded application failures without exposing internals", async () => {
    const waiting = deferred<HoidCharacterEvolutionResult>();
    const dispatch = createDispatch(() => waiting.promise);
    const adapter = createHoidCharacterEvolutionApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });
    const first = adapter.execute(routeInput, progress);
    const second = adapter.execute(routeInput, progress);
    waiting.resolve(Object.freeze({ status: "not-found" }));

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(secondResult).toEqual({ status: "not-found" });
  });
});
