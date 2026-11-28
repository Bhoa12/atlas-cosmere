import { describe, expect, it, vi } from "vitest";
import {
  createHoidTrustedConversationApplicationAdapter,
  type HoidTrustedConversationApplicationDispatch,
} from "./trustedConversationApplicationAdapter";
import type { HoidConversationApplicationProgress } from "./conversationApplicationService";
import type { HoidConversationRouteExecutionInput } from "./conversationRouteExecution";
import type {
  HoidTrustedConversationScreenPort,
  HoidTrustedConversationScreenResult,
} from "./trustedConversationScreenPort";

const progress: HoidConversationApplicationProgress = Object.freeze({
  revision: 7,
  fingerprint: "a".repeat(64),
});

const changedProgress: HoidConversationApplicationProgress = Object.freeze({
  revision: 8,
  fingerprint: "b".repeat(64),
});

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
  trustedConversationAvailable: true,
});

const blockedResult: HoidTrustedConversationScreenResult = Object.freeze({
  status: "blocked",
  reason: "disposed",
});

function dispatch(
  port: HoidTrustedConversationScreenPort,
  overrides: Partial<HoidTrustedConversationApplicationDispatch> = {},
): HoidTrustedConversationApplicationDispatch {
  return Object.freeze({
    port,
    question: "Explain the verified topic",
    depth: "detailed",
    isCurrent: () => true,
    ...overrides,
  });
}

describe("Hoid trusted conversation application adapter", () => {
  it("routes a typed conversation through the trusted screen port and returns its typed result", async () => {
    const send = vi.fn(async () => blockedResult);
    const port = { send } as unknown as HoidTrustedConversationScreenPort;
    const active = dispatch(port);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidTrustedConversationApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => active,
    });
    const controller = new AbortController();

    const result = await adapter.execute(routeInput, progress, {
      signal: controller.signal,
      isCurrent: () => true,
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") throw new Error("expected completed result");
    expect(result.value).toBe(blockedResult);
    expect(result.context).toEqual({
      schemaVersion: 1,
      turnSequence: 1,
      route: "conversation",
      progress,
    });
    expect(result.context).not.toHaveProperty("question");
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      question: "Explain the verified topic",
      intent: "explain",
      depth: "detailed",
      bookScope: { mode: "single-work", bookIds: ["tfe"] },
    }, { signal: controller.signal });
  });

  it("does not dispatch when the active UI turn is no longer current", async () => {
    const send = vi.fn(async () => blockedResult);
    const port = { send } as unknown as HoidTrustedConversationScreenPort;
    const active = dispatch(port, { isCurrent: () => false });
    const adapter = createHoidTrustedConversationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => active,
    });

    const result = await adapter.execute(routeInput, progress, {
      isCurrent: () => true,
    });

    expect(result).toEqual({ status: "unavailable", reason: "handler-failed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("discards a trusted result if progress changes before application delivery", async () => {
    const send = vi.fn(async () => blockedResult);
    const port = { send } as unknown as HoidTrustedConversationScreenPort;
    const active = dispatch(port);
    let reads = 0;
    const adapter = createHoidTrustedConversationApplicationAdapter({
      readProgress: async () => {
        reads += 1;
        return reads === 1 ? progress : changedProgress;
      },
      getCurrentDispatch: () => active,
    });

    const result = await adapter.execute(routeInput, progress, {
      isCurrent: () => true,
    });

    expect(result).toEqual({ status: "unavailable", reason: "stale-after-execution" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never sends a metadata or non-conversation route through the narrative port", async () => {
    const send = vi.fn(async () => blockedResult);
    const port = { send } as unknown as HoidTrustedConversationScreenPort;
    const active = dispatch(port);
    const adapter = createHoidTrustedConversationApplicationAdapter({
      readProgress: async () => progress,
      getCurrentDispatch: () => active,
    });

    const result = await adapter.execute({
      ...routeInput,
      trustedConversationAvailable: false,
    }, progress, { isCurrent: () => true });

    expect(result).toEqual({ status: "unavailable", reason: "handler-failed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("does not dispatch after cancellation", async () => {
    const send = vi.fn(async () => blockedResult);
    const port = { send } as unknown as HoidTrustedConversationScreenPort;
    const active = dispatch(port);
    const readProgress = vi.fn(async () => progress);
    const adapter = createHoidTrustedConversationApplicationAdapter({
      readProgress,
      getCurrentDispatch: () => active,
    });
    const controller = new AbortController();
    controller.abort();

    const result = await adapter.execute(routeInput, progress, {
      signal: controller.signal,
      isCurrent: () => true,
    });

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(readProgress).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
