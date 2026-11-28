import { describe, expect, it } from "vitest";
import type { HoidConversationIntentResult } from "./conversationIntent";
import type { HoidConversationRoutePlanInput } from "./conversationRoutePlan";
import { resolveHoidConversationRoutePlan } from "./conversationRoutePlan";

function intent(
  mode: "reread-request" | "curated-discovery" | "catalogue-recommendation" |
    "reading-progress" | "narrative-context" | "relationship-explanation" | "explanation" = "explanation",
): HoidConversationIntentResult {
  const signal =
    mode === "reread-request" ? "reread-cue" :
    mode === "curated-discovery" ? "discovery-cue" :
    mode === "catalogue-recommendation" ? "recommendation-cue" :
    mode === "reading-progress" ? "progress-position-cue" :
    mode === "narrative-context" ? "narrative-recap-cue" :
    mode === "relationship-explanation" ? "relationship-cue" :
    "default-explanation";
  return Object.freeze({
    status: "ready",
    intent: mode === "catalogue-recommendation" || mode === "curated-discovery" || mode === "reread-request"
      ? "recommend"
      : mode === "reading-progress" || mode === "narrative-context" ? "context" : "explain",
    mode,
    signal,
  }) as HoidConversationIntentResult;
}

const BASE: HoidConversationRoutePlanInput = Object.freeze({
  intentPlan: intent(),
  dossierIntent: Object.freeze({ status: "not-dossier" }),
  relationshipIntent: Object.freeze({ status: "not-relationship" }),
  timelineIntent: Object.freeze({ status: "not-timeline" }),
  magicSystemIntent: Object.freeze({ status: "not-magic" }),
  characterEvolutionIntent: Object.freeze({ status: "not-evolution" }),
  answerScopeStatus: "ready",
  trustedConversationAvailable: true,
});

function route(
  overrides: Partial<HoidConversationRoutePlanInput> = {},
): string {
  const result = resolveHoidConversationRoutePlan({ ...BASE, ...overrides });
  return result.status === "ready" ? result.route : "invalid-input";
}

describe("Hoid conversation route plan", () => {
  it("uses the trusted conversation route for a valid general explanation", () => {
    expect(route()).toBe("conversation");
  });

  it("does not route narrative questions when the trusted host is absent", () => {
    expect(route({ trustedConversationAvailable: false })).toBe("trusted-host-unavailable");
  });

  it("rejects malformed general intent before any broad fallback", () => {
    expect(route({
      intentPlan: Object.freeze({ status: "unavailable", reason: "invalid-question" }),
    })).toBe("invalid-request");
  });

  it("keeps dossier validation ahead of all broad routes", () => {
    expect(route({
      dossierIntent: Object.freeze({ status: "invalid" }),
      intentPlan: intent("catalogue-recommendation"),
    })).toBe("dossier-invalid");
    expect(route({
      dossierIntent: Object.freeze({ status: "needs-name" }),
      intentPlan: intent("reread-request"),
    })).toBe("dossier-needs-name");
  });

  it("keeps malformed and incomplete relationship requests terminal", () => {
    expect(route({ relationshipIntent: Object.freeze({ status: "invalid" }) }))
      .toBe("relationship-invalid");
    expect(route({ relationshipIntent: Object.freeze({ status: "needs-names" }) }))
      .toBe("relationship-needs-names");
  });

  it("keeps malformed and incomplete timeline requests terminal", () => {
    expect(route({ timelineIntent: Object.freeze({ status: "invalid" }) }))
      .toBe("timeline-invalid");
    expect(route({ timelineIntent: Object.freeze({ status: "needs-name" }) }))
      .toBe("timeline-needs-name");
  });

  it("does not allow a relationship cue with an unparsed pair to reach a provider", () => {
    expect(route({ intentPlan: intent("relationship-explanation") }))
      .toBe("relationship-intent-mismatch");
  });

  it("routes explicit navigation intents before narrative scope selection", () => {
    expect(route({
      intentPlan: intent("reread-request"),
      answerScopeStatus: "unavailable",
    })).toBe("reread-request");
    expect(route({
      intentPlan: intent("curated-discovery"),
      answerScopeStatus: "selection-required",
    })).toBe("curated-discovery");
    expect(route({
      intentPlan: intent("reading-progress"),
      answerScopeStatus: "unavailable",
    })).toBe("reading-progress");
    expect(route({
      intentPlan: intent("catalogue-recommendation"),
      answerScopeStatus: "selection-required",
    })).toBe("catalogue-recommendation");
  });

  it("requires a reading focus before dispatching narrative entity routes", () => {
    expect(route({
      relationshipIntent: Object.freeze({ status: "ready", leftEntityName: "A", rightEntityName: "B" }),
      answerScopeStatus: "selection-required",
    })).toBe("scope-selection-required");
    expect(route({
      timelineIntent: Object.freeze({ status: "ready", entityName: "A" }),
      answerScopeStatus: "unavailable",
    })).toBe("scope-unavailable");
  });

  it("preserves relationship-before-timeline precedence", () => {
    expect(route({
      relationshipIntent: Object.freeze({ status: "ready", leftEntityName: "A", rightEntityName: "B" }),
      timelineIntent: Object.freeze({ status: "ready", entityName: "A" }),
    })).toBe("relationship");
  });

  it("preserves timeline-before-evolution precedence", () => {
    expect(route({
      timelineIntent: Object.freeze({ status: "ready", entityName: "A" }),
      characterEvolutionIntent: Object.freeze({ status: "ready", characterName: "A" }),
    })).toBe("timeline");
  });

  it("preserves evolution-before-magic precedence", () => {
    expect(route({
      characterEvolutionIntent: Object.freeze({ status: "ready", characterName: "A" }),
      magicSystemIntent: Object.freeze({ status: "ready", systemName: "A" }),
    })).toBe("character-evolution");
  });

  it("preserves magic-before-dossier precedence", () => {
    expect(route({
      magicSystemIntent: Object.freeze({ status: "ready", systemName: "A" }),
      dossierIntent: Object.freeze({ status: "ready", entityName: "A" }),
    })).toBe("magic-system");
  });

  it("routes a recognized dossier only after the higher-priority specialist routes", () => {
    expect(route({
      dossierIntent: Object.freeze({ status: "ready", entityName: "A" }),
    })).toBe("dossier");
  });

  it("rejects unknown status values and additional input fields", () => {
    expect(resolveHoidConversationRoutePlan({
      ...BASE,
      dossierIntent: Object.freeze({ status: "future-route" }),
    })).toEqual({ status: "unavailable", reason: "invalid-input" });
    expect(resolveHoidConversationRoutePlan({ ...BASE, unexpected: true }))
      .toEqual({ status: "unavailable", reason: "invalid-input" });
  });

  it("rejects accessors without invoking them", () => {
    let invoked = false;
    const dossier = Object.defineProperty({}, "status", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("getter must not execute");
      },
    });
    const result = resolveHoidConversationRoutePlan({
      ...BASE,
      dossierIntent: dossier,
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-input" });
    expect(invoked).toBe(false);
  });

  it("does not coerce hostile intent values or invoke custom stringifiers", () => {
    let invoked = false;
    const hostileIntent = {
      toString() {
        invoked = true;
        throw new Error("coercion must not execute");
      },
    };
    const result = resolveHoidConversationRoutePlan({
      ...BASE,
      intentPlan: Object.freeze({
        status: "ready",
        intent: hostileIntent,
        mode: "explanation",
        signal: "default-explanation",
      }),
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-input" });
    expect(invoked).toBe(false);
  });

  it("rejects canonically identical relationship names", () => {
    expect(resolveHoidConversationRoutePlan({
      ...BASE,
      relationshipIntent: Object.freeze({
        status: "ready",
        leftEntityName: "A",
        rightEntityName: "a",
      }),
    })).toEqual({ status: "unavailable", reason: "invalid-input" });
  });

  it("routes missing names for evolution and magic to their specialized handlers", () => {
    expect(route({
      characterEvolutionIntent: Object.freeze({ status: "needs-name" }),
    })).toBe("character-evolution");
    expect(route({
      magicSystemIntent: Object.freeze({ status: "needs-name" }),
    })).toBe("magic-system");
  });

  it("rejects malformed ready intents rather than guessing a route", () => {
    expect(resolveHoidConversationRoutePlan({
      ...BASE,
      magicSystemIntent: Object.freeze({ status: "ready", systemName: " " }),
    })).toEqual({ status: "unavailable", reason: "invalid-input" });
  });
});
