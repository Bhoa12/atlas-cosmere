import { describe, expect, it, vi } from "vitest";
import {
  createHoidMagicSystemExplanationApplicationAdapter,
  type HoidMagicSystemExplanationApplicationDispatch,
} from "./magicSystemExplanationApplicationAdapter";
import type {
  HoidMagicSystemExplanationAdapter,
  HoidMagicSystemExplanationResult,
} from "./magicSystemExplanation";
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
const question = "Reglas de AonDor";

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
  magicSystemIntent: Object.freeze({
    status: "ready" as const,
    systemName: "AonDor",
    facet: "rule" as const,
  }),
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
  answer: HoidMagicSystemExplanationAdapter["answer"],
  overrides: Partial<HoidMagicSystemExplanationApplicationDispatch> = {},
): HoidMagicSystemExplanationApplicationDispatch {
  const adapter = Object.freeze({ answer }) as unknown as HoidMagicSystemExplanationAdapter;
  return Object.freeze({
    adapter,
    question,
    systemName: "AonDor",
    facet: "rule",
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

describe("Hoid magic-system application adapter", () => {
  it("dispatches only a ready magic route through the existing reviewed-fact adapter", async () => {
    const magicResult: HoidMagicSystemExplanationResult = Object.freeze({ status: "not-found" });
    const answer = vi.fn(async () => magicResult);
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const controller = new AbortController();

    const result = await adapter.execute(routeInput, progress, { signal: controller.signal });

    expect(result).toEqual(magicResult);
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith({
      question,
      progress: progressSnapshot,
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
      depth: "detailed",
    }, { signal: controller.signal });
  });

  it("rejects a non-magic route before reading progress or dispatching", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const nonMagicRoute = Object.freeze({
      ...routeInput,
      magicSystemIntent: Object.freeze({ status: "not-magic" as const }),
    });

    const result = await adapter.execute(nonMagicRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a magic route that still needs a system name", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => dispatch,
    });
    const incompleteRoute = Object.freeze({
      ...routeInput,
      magicSystemIntent: Object.freeze({ status: "needs-name" as const }),
    });

    const result = await adapter.execute(incompleteRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects invalid magic intents without falling through to a provider", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });
    const invalidRoute = Object.freeze({
      ...routeInput,
      magicSystemIntent: Object.freeze({ status: "invalid" as const }),
    });

    const result = await adapter.execute(invalidRoute, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a dispatch whose canonical system name differs from the routed name", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { systemName: "Sel" });
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("binds the exact facet parsed from the original question", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { facet: null });
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a question that parses to a different system than the dispatch claims", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer, { question: "Reglas de Sel" });
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("does not dispatch when progress is stale before execution", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = createDispatch(answer);
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
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
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
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
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
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
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects mutable dispatch snapshots", async () => {
    const answer = vi.fn(async () => Object.freeze({ status: "not-found" as const }));
    const dispatch = { ...createDispatch(answer) };
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch as HoidMagicSystemExplanationApplicationDispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("maps handler exceptions to a stable result without exposing internal errors", async () => {
    const dispatch = createDispatch(async () => {
      throw new Error("private magic adapter failure");
    });
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-dossier" });
    expect(JSON.stringify(result)).not.toContain("private magic adapter failure");
  });

  it("does not allow a routed magic request to degrade into an incomplete intent", async () => {
    const dispatch = createDispatch(async () => Object.freeze({ status: "needs-name" as const }));
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => dispatch,
    });

    const result = await adapter.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "invalid-request" });
  });

  it("maps stale, cancelled and superseded turns without exposing internals", async () => {
    const waiting = deferred<HoidMagicSystemExplanationResult>();
    const dispatch = createDispatch(() => waiting.promise);
    const adapter = createHoidMagicSystemExplanationApplicationAdapter({
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
