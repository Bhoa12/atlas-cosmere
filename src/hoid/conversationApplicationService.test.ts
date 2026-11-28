import { describe, expect, it, vi } from "vitest";
import {
  createHoidConversationApplicationService,
  type HoidConversationApplicationProgress,
  type HoidConversationApplicationPorts,
} from "./conversationApplicationService";
import type { HoidConversationRouteExecutionInput } from "./conversationRouteExecution";

const progress: HoidConversationApplicationProgress = Object.freeze({
  revision: 7,
  fingerprint: "a".repeat(64),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function createPorts(overrides: Partial<HoidConversationApplicationPorts> = {}) {
  return {
    readProgress: vi.fn(() => progress),
    executeRoute: vi.fn(async () => Object.freeze({ text: "synthetic answer" })),
    ...overrides,
  } satisfies HoidConversationApplicationPorts;
}

describe("Hoid conversation application service", () => {
  it("dispatches a typed route with an immutable, ID-free turn context", async () => {
    const ports = createPorts();
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute(routeInput, progress);

    expect(result.status).toBe("completed");
    expect(ports.readProgress).toHaveBeenCalledTimes(2);
    expect(ports.executeRoute).toHaveBeenCalledTimes(1);
    if (result.status !== "completed") throw new Error("expected completed result");
    expect(result.context).toEqual({
      schemaVersion: 1,
      turnSequence: 1,
      route: "conversation",
      progress,
    });
    expect(Object.isFrozen(result.context)).toBe(true);
    expect(Object.keys(result.context)).toEqual(["schemaVersion", "turnSequence", "route", "progress"]);
    expect(result.context).not.toHaveProperty("question");
    expect(result.context).not.toHaveProperty("text");
  });

  it("rejects malformed expected progress before reading or dispatching", async () => {
    const ports = createPorts();
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute(routeInput, { revision: 7, fingerprint: "bad" });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
    expect(ports.readProgress).not.toHaveBeenCalled();
    expect(ports.executeRoute).not.toHaveBeenCalled();
  });

  it("rejects stale progress before route resolution and dispatch", async () => {
    const ports = createPorts({
      readProgress: vi.fn(() => ({ revision: 8, fingerprint: "b".repeat(64) })),
    });
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "stale-before-execution" });
    expect(ports.executeRoute).not.toHaveBeenCalled();
  });

  it("discards a handler result when progress changes before delivery", async () => {
    let reads = 0;
    const ports = createPorts({
      readProgress: vi.fn(() => {
        reads += 1;
        return reads === 1 ? progress : { revision: 8, fingerprint: "b".repeat(64) };
      }),
    });
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "stale-after-execution" });
    expect(ports.executeRoute).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch an invalid or ambiguous route plan", async () => {
    const ports = createPorts();
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute({ invalid: true }, progress);

    expect(result).toEqual({ status: "unavailable", reason: "route-unavailable" });
    expect(ports.executeRoute).not.toHaveBeenCalled();
  });

  it("discards an older turn when a newer turn starts", async () => {
    const firstHandler = deferred<unknown>();
    const firstStarted = deferred<void>();
    let calls = 0;
    const ports = createPorts({
      executeRoute: vi.fn(() => {
        calls += 1;
        if (calls === 1) {
          firstStarted.resolve();
          return firstHandler.promise;
        }
        return Promise.resolve({ text: "new turn" });
      }),
    });
    const service = createHoidConversationApplicationService(ports);

    const first = service.execute(routeInput, progress);
    await firstStarted.promise;
    const second = await service.execute(routeInput, progress);
    firstHandler.resolve({ text: "old turn" });
    const firstResult = await first;

    expect(second.status).toBe("completed");
    expect(firstResult).toEqual({ status: "unavailable", reason: "superseded" });
  });

  it("returns cancelled and observes a non-cooperative late handler completion", async () => {
    const controller = new AbortController();
    const handler = deferred<unknown>();
    const started = deferred<void>();
    const ports = createPorts({
      executeRoute: vi.fn(() => {
        started.resolve();
        return handler.promise;
      }),
    });
    const service = createHoidConversationApplicationService(ports);

    const pending = service.execute(routeInput, progress, { signal: controller.signal });
    await started.promise;
    controller.abort();
    const result = await pending;
    handler.resolve({ text: "late result" });

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
  });

  it("fails closed when the progress reader throws", async () => {
    const ports = createPorts({
      readProgress: vi.fn(() => { throw new Error("synthetic storage failure"); }),
    });
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "progress-unavailable" });
    expect(ports.executeRoute).not.toHaveBeenCalled();
  });

  it("does not expose handler exceptions or partial values", async () => {
    const ports = createPorts({
      executeRoute: vi.fn(async () => { throw new Error("synthetic gateway failure"); }),
    });
    const service = createHoidConversationApplicationService(ports);
    const result = await service.execute(routeInput, progress);

    expect(result).toEqual({ status: "unavailable", reason: "handler-failed" });
  });

  it("invalidates in-flight work explicitly", async () => {
    const handler = deferred<unknown>();
    const started = deferred<void>();
    const ports = createPorts({
      executeRoute: vi.fn(() => {
        started.resolve();
        return handler.promise;
      }),
    });
    const service = createHoidConversationApplicationService(ports);
    const pending = service.execute(routeInput, progress);
    await started.promise;
    service.invalidate();
    handler.resolve({ text: "invalidated" });

    expect(await pending).toEqual({ status: "unavailable", reason: "superseded" });
  });
});
