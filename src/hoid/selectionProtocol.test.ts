import { describe, expect, it } from "vitest";
import {
  createHoidClaimSelectionRequest,
  createHoidClaimSelectionResponse,
  parseHoidClaimSelectionResponse,
} from "./selectionProtocol";
import type { HoidAnswerSelectionBudget, ReadingPosition } from "./types";

const budget: HoidAnswerSelectionBudget = Object.freeze({
  maxClaims: 3,
  maxEvidence: 4,
  maxWorks: 2,
  maxCharacters: 6_000,
  minimumWorks: 1,
  requireSegmentProvenance: true,
  requireCrossWorkSegment: false,
});
const candidates = Object.freeze([
  Object.freeze({
    id: "claim.alpha",
    text: "Afirmación sintética aprobada.",
    evidenceIds: Object.freeze(["evidence.alpha"]),
  }),
]);

function request(
  question = "¿Qué significa el concepto sintético?",
  reading: readonly ReadingPosition[] = [{ bookId: "tfe", chapter: 4 }],
  selectionBudget: HoidAnswerSelectionBudget = budget,
) {
  return createHoidClaimSelectionRequest({
    question,
    intent: "explain",
    candidates,
    selectionBudget,
    reading,
  });
}

describe("Hoid versioned claim-selection protocol", () => {
  it("creates an immutable v1 request without exposing raw reading positions", () => {
    const value = request();
    expect(value.schemaVersion).toBe(1);
    expect(value.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.candidates)).toBe(true);
    expect(Object.isFrozen(value.candidates[0].evidenceIds)).toBe(true);
    expect(value).not.toHaveProperty("reading");
    expect(value).not.toHaveProperty("progress");
  });

  it("binds the fingerprint to question, progress, budget and candidates", () => {
    const baseline = request();
    const differentQuestion = request("¿Quién utiliza el concepto sintético?");
    const differentProgress = request(
      "¿Qué significa el concepto sintético?",
      [{ bookId: "tfe", chapter: 5 }],
    );
    const differentBudget = request(
      "¿Qué significa el concepto sintético?",
      [{ bookId: "tfe", chapter: 4 }],
      Object.freeze({ ...budget, maxClaims: 2 }),
    );
    const differentCandidates = createHoidClaimSelectionRequest({
      question: "¿Qué significa el concepto sintético?",
      intent: "explain",
      candidates: [{ id: "claim.beta", text: "Otra afirmación sintética.", evidenceIds: ["evidence.alpha"] }],
      selectionBudget: budget,
      reading: [{ bookId: "tfe", chapter: 4 }],
    });
    expect(differentQuestion.requestFingerprint).not.toBe(baseline.requestFingerprint);
    expect(differentProgress.requestFingerprint).not.toBe(baseline.requestFingerprint);
    expect(differentBudget.requestFingerprint).not.toBe(baseline.requestFingerprint);
    expect(differentCandidates.requestFingerprint).not.toBe(baseline.requestFingerprint);
  });

  it("accepts a response bound to the exact request", () => {
    const current = request();
    const response = createHoidClaimSelectionResponse(current, ["claim.alpha"]);
    expect(parseHoidClaimSelectionResponse(response, current, 3)).toEqual(["claim.alpha"]);
  });

  it("rejects stale fingerprints and legacy bare arrays", () => {
    const first = request();
    const second = request("Otra pregunta sintética.");
    const stale = createHoidClaimSelectionResponse(first, ["claim.alpha"]);
    expect(parseHoidClaimSelectionResponse(stale, second, 3)).toBeNull();
    expect(parseHoidClaimSelectionResponse(["claim.alpha"], first, 3)).toBeNull();
  });

  it("rejects unknown fields, unsupported versions and duplicate IDs", () => {
    const current = request();
    const response = createHoidClaimSelectionResponse(current, ["claim.alpha"]);
    expect(parseHoidClaimSelectionResponse({ ...response, providerText: "No debe aceptarse" }, current, 3)).toBeNull();
    expect(parseHoidClaimSelectionResponse({ ...response, schemaVersion: 2 }, current, 3)).toBeNull();
    expect(parseHoidClaimSelectionResponse(
      createHoidClaimSelectionResponse(current, ["claim.alpha", "claim.alpha"]),
      current,
      3,
    )).toBeNull();
  });

  it("rejects accessors and sparse arrays without executing getters", () => {
    const current = request();
    let invoked = false;
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessor, {
      schemaVersion: { enumerable: true, get: () => { invoked = true; return 1; } },
      requestFingerprint: { enumerable: true, value: current.requestFingerprint },
      claimIds: { enumerable: true, value: ["claim.alpha"] },
    });
    expect(parseHoidClaimSelectionResponse(accessor, current, 3)).toBeNull();
    expect(invoked).toBe(false);
    const sparse = new Array(1) as unknown as readonly string[];
    expect(parseHoidClaimSelectionResponse({
      schemaVersion: 1,
      requestFingerprint: current.requestFingerprint,
      claimIds: sparse,
    }, current, 3)).toBeNull();
    expect(parseHoidClaimSelectionResponse(
      createHoidClaimSelectionResponse(current, ["claim.alpha"]),
      current,
      0,
    )).toBeNull();
  });
});
