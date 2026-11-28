import { describe, expect, it } from "vitest";
import type { HoidAnswerBookScope } from "./answerScope";
import {
  resolveHoidConversationRouteExecution,
  type HoidConversationRouteExecutionInput,
} from "./conversationRouteExecution";
import type { HoidReadingFocusConversationScopeResolution } from "./readingFocusConversationScope";

const readyScope = Object.freeze({
  status: "ready" as const,
  scope: Object.freeze({ mode: "single-work" as const, bookIds: Object.freeze(["tfe"]) }) as HoidAnswerBookScope,
  focus: null,
  source: "automatic-focus" as const,
}) satisfies HoidReadingFocusConversationScopeResolution;

const unavailableScope = Object.freeze({
  status: "unavailable" as const,
  reason: "invalid-progress" as const,
}) satisfies HoidReadingFocusConversationScopeResolution;

const selectionRequiredScope = Object.freeze({
  status: "selection-required" as const,
  reason: "multiple-active-works" as const,
  choices: Object.freeze([
    Object.freeze({
      bookId: "tfe",
      title: "El Imperio Final",
      status: "in-progress" as const,
      currentChapter: 1,
      completedThroughChapter: 0,
      completedThroughEntireWork: false,
      chapterTracking: "verified" as const,
    }),
    Object.freeze({
      bookId: "woa",
      title: "El Pozo de la Ascensión",
      status: "in-progress" as const,
      currentChapter: 1,
      completedThroughChapter: 0,
      completedThroughEntireWork: false,
      chapterTracking: "verified" as const,
    }),
  ]),
}) satisfies HoidReadingFocusConversationScopeResolution;

const base: HoidConversationRouteExecutionInput = Object.freeze({
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
  answerScope: readyScope,
  trustedConversationAvailable: true,
});

function resolve(overrides: Partial<HoidConversationRouteExecutionInput> = {}) {
  return resolveHoidConversationRouteExecution({ ...base, ...overrides });
}

describe("Hoid typed conversation route execution", () => {
  it("binds a trusted generic conversation to its exact scope and intent", () => {
    const result = resolve();
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "conversation") throw new Error("expected conversation");
    expect(result.intent.intent).toBe("explain");
    expect(result.scope).toEqual({ mode: "single-work", bookIds: ["tfe"] });
  });

  it("returns metadata-only reading progress without requiring a narrative scope", () => {
    const result = resolve({
      intentPlan: Object.freeze({
        status: "ready" as const,
        intent: "context" as const,
        mode: "reading-progress" as const,
        signal: "progress-position-cue" as const,
      }),
      answerScope: unavailableScope,
      trustedConversationAvailable: false,
    });
    expect(result).toEqual({ status: "ready", route: "reading-progress" });
  });

  it("returns a typed scope-unavailable resolution", () => {
    expect(resolve({ answerScope: unavailableScope })).toEqual({
      status: "ready",
      route: "scope-unavailable",
      resolution: unavailableScope,
    });
  });

  it("returns a typed explicit-focus selection requirement", () => {
    const result = resolve({ answerScope: selectionRequiredScope });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "scope-selection-required") throw new Error("expected scope selection");
    expect(result.resolution.reason).toBe("multiple-active-works");
  });

  it("binds relationship names only when the relationship parser is ready", () => {
    const result = resolve({
      relationshipIntent: Object.freeze({ status: "ready" as const, leftEntityName: "A", rightEntityName: "B" }),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "relationship") throw new Error("expected relationship");
    expect(result.intent.leftEntityName).toBe("A");
    expect(result.intent.rightEntityName).toBe("B");
    expect(result.scope.bookIds).toEqual(["tfe"]);
  });

  it("binds a timeline entity to a verified reading scope", () => {
    const result = resolve({
      timelineIntent: Object.freeze({ status: "ready" as const, entityName: "A" }),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "timeline") throw new Error("expected timeline");
    expect(result.intent.entityName).toBe("A");
  });

  it("preserves incomplete evolution requests as typed terminal routes", () => {
    const result = resolve({ characterEvolutionIntent: Object.freeze({ status: "needs-name" as const }) });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "character-evolution") throw new Error("expected evolution");
    expect(result.intent.status).toBe("needs-name");
  });

  it("binds an approved evolution lookup dimension without widening its scope", () => {
    const result = resolve({
      characterEvolutionIntent: Object.freeze({
        status: "ready" as const,
        characterName: "A",
        dimension: "knowledge" as const,
      }),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "character-evolution") throw new Error("expected evolution");
    expect(result.intent.status).toBe("ready");
    if (result.intent.status === "ready") expect(result.intent.dimension).toBe("knowledge");
    expect(result.scope.bookIds).toEqual(["tfe"]);
  });

  it("preserves incomplete magic-system requests as typed terminal routes", () => {
    const result = resolve({ magicSystemIntent: Object.freeze({ status: "needs-name" as const }) });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "magic-system") throw new Error("expected magic");
    expect(result.intent.status).toBe("needs-name");
  });

  it("binds a magic facet to the current reading scope", () => {
    const result = resolve({
      magicSystemIntent: Object.freeze({
        status: "ready" as const,
        systemName: "A",
        facet: "limitation" as const,
      }),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "magic-system") throw new Error("expected magic");
    expect(result.intent.status).toBe("ready");
    if (result.intent.status === "ready") expect(result.intent.facet).toBe("limitation");
  });

  it("binds a dossier entity only for a ready exact-name parser result", () => {
    const result = resolve({ dossierIntent: Object.freeze({ status: "ready" as const, entityName: "A" }) });
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.route !== "dossier") throw new Error("expected dossier");
    expect(result.intent.entityName).toBe("A");
  });

  it("blocks generic narrative dispatch when the trusted host is absent", () => {
    expect(resolve({ trustedConversationAvailable: false })).toEqual({
      status: "ready",
      route: "trusted-host-unavailable",
    });
  });

  it("rejects a root object with additional properties", () => {
    expect(resolveHoidConversationRouteExecution({ ...base, extra: true }))
      .toEqual({ status: "unavailable", reason: "invalid-input" });
  });

  it("rejects root accessors without invoking them", () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(base)) {
      Object.defineProperty(hostile, key, { value, enumerable: true, configurable: true });
    }
    Object.defineProperty(hostile, "trustedConversationAvailable", {
      enumerable: true,
      get() {
        invoked = true;
        return true;
      },
    });
    expect(resolveHoidConversationRouteExecution(hostile))
      .toEqual({ status: "unavailable", reason: "invalid-input" });
    expect(invoked).toBe(false);
  });

  it("rejects an accessor on the nested scope without invoking it", () => {
    let invoked = false;
    const hostileScope = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostileScope, "status", {
      enumerable: true,
      get() {
        invoked = true;
        return "ready";
      },
    });
    expect(resolve({ answerScope: hostileScope as unknown as HoidReadingFocusConversationScopeResolution }))
      .toEqual({ status: "unavailable", reason: "invalid-input" });
    expect(invoked).toBe(false);
  });

  it("does not turn a malformed specialist request into a generic conversation", () => {
    const result = resolve({ relationshipIntent: Object.freeze({ status: "needs-names" as const }) });
    expect(result).toEqual({ status: "ready", route: "relationship-needs-names" });
  });
});
