import { describe, expect, it, vi } from "vitest";
import {
  createHoidClaimSelectorAdapter,
  inspectHoidProviderSelectionSnapshot,
  isHoidProviderSelectionSnapshot,
} from "./providerAdapter";
import {
  createHoidClaimSelectionRequest,
  createHoidClaimSelectionResponse,
  parseHoidClaimSelectionResponse,
} from "./selectionProtocol";
import type { HoidClaimSelectionRequest, HoidClaimSelectionTransportContext } from "./providerAdapter";
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

function createRequest(reading: readonly ReadingPosition[] = [{ bookId: "tfe", chapter: 4 }]) {
  return createHoidClaimSelectionRequest({
    question: "¿Qué significa este concepto sintético?",
    intent: "explain",
    candidates: [{
      id: "claim.alpha",
      text: "Afirmación sintética aprobada.",
      evidenceIds: ["evidence.alpha"],
    }],
    selectionBudget: budget,
    reading,
  });
}

function abortError(): Error {
  const error = new Error("transport aborted");
  error.name = "AbortError";
  return error;
}

describe("Hoid provider-neutral selector adapter", () => {
  it("accepts only immutable protocol snapshots without raw progress", () => {
    const request = createRequest();
    expect(inspectHoidProviderSelectionSnapshot(request)).toBeNull();
    expect(isHoidProviderSelectionSnapshot(request)).toBe(true);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.selectionBudget)).toBe(true);
    expect(Object.isFrozen(request.candidates[0])).toBe(true);
    expect(Object.isFrozen(request.candidates[0].evidenceIds)).toBe(true);
    expect(Object.keys(request).sort()).toEqual([
      "candidates",
      "intent",
      "question",
      "requestFingerprint",
      "schemaVersion",
      "selectionBudget",
    ]);
    expect(request).not.toHaveProperty("reading");
    expect(request).not.toHaveProperty("progress");
  });

  it("rejects mutable or non-canonical requests before transport dispatch", async () => {
    const request = createRequest();
    const mutable = {
      ...request,
      candidates: request.candidates.map(candidate => ({
        ...candidate,
        evidenceIds: [...candidate.evidenceIds],
      })),
    } as unknown as typeof request;
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidClaimSelectorAdapter(transport);

    expect(isHoidProviderSelectionSnapshot(mutable)).toBe(false);
    await expect(adapter.selectClaims(mutable, { signal: new AbortController().signal }))
      .rejects.toThrow("immutable Hoid selection snapshots");
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects budgets and candidate payloads beyond runtime hard ceilings", () => {
    const invalidBudget = Object.freeze({ ...budget, maxCharacters: 32_001 });
    const overBudget = createHoidClaimSelectionRequest({
      question: "Pregunta sintética.",
      intent: "explain",
      candidates: [{ id: "claim.alpha", text: "Afirmación sintética.", evidenceIds: ["evidence.alpha"] }],
      selectionBudget: invalidBudget,
      reading: [{ bookId: "tfe", chapter: 4 }],
    });
    expect(isHoidProviderSelectionSnapshot(overBudget)).toBe(false);

    const tooManyCandidates = createHoidClaimSelectionRequest({
      question: "Pregunta sintética.",
      intent: "explain",
      candidates: Array.from({ length: 33 }, (_, index) => ({
        id: `claim.item-${index}`,
        text: "Afirmación sintética.",
        evidenceIds: ["evidence.alpha"],
      })),
      selectionBudget: budget,
      reading: [{ bookId: "tfe", chapter: 4 }],
    });
    expect(isHoidProviderSelectionSnapshot(tooManyCandidates)).toBe(false);
  });

  it("rejects duplicate evidence IDs inside a candidate", () => {
    const duplicateEvidence = createHoidClaimSelectionRequest({
      question: "Pregunta sintética.",
      intent: "explain",
      candidates: [{
        id: "claim.alpha",
        text: "Afirmación sintética.",
        evidenceIds: ["evidence.alpha", "evidence.alpha"],
      }],
      selectionBudget: budget,
      reading: [{ bookId: "tfe", chapter: 4 }],
    });
    expect(isHoidProviderSelectionSnapshot(duplicateEvidence)).toBe(false);
  });

  it("does not dispatch transport when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidClaimSelectorAdapter(transport);

    await expect(adapter.selectClaims(createRequest(), { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("re-checks cancellation after adapter entry but before transport dispatch", async () => {
    const controller = new AbortController();
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidClaimSelectorAdapter(transport);
    const pending = adapter.selectClaims(createRequest(), { signal: controller.signal });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("passes the exact per-invocation signal to the transport", async () => {
    const controller = new AbortController();
    const request = createRequest();
    const transport = vi.fn(async (received: HoidClaimSelectionRequest, _context: HoidClaimSelectionTransportContext) =>
      createHoidClaimSelectionResponse(received, ["claim.alpha"])
    );
    const adapter = createHoidClaimSelectorAdapter(transport);

    const response = await adapter.selectClaims(request, { signal: controller.signal });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe(request);
    expect(Object.isFrozen(transport.mock.calls[0][0])).toBe(true);
    expect(Object.isFrozen(transport.mock.calls[0][0].candidates[0])).toBe(true);
    expect(transport.mock.calls[0][1].signal).toBe(controller.signal);
    expect(Object.isFrozen(transport.mock.calls[0][1])).toBe(true);
    expect(parseHoidClaimSelectionResponse(response, request, 3)).toEqual(["claim.alpha"]);
  });

  it("propagates cancellation to an active transport", async () => {
    const controller = new AbortController();
    const transport = vi.fn((_request: HoidClaimSelectionRequest, context: HoidClaimSelectionTransportContext) => new Promise<unknown>((_resolve, reject) => {
      context.signal.addEventListener("abort", () => reject(abortError()), { once: true });
    }));
    const adapter = createHoidClaimSelectorAdapter(transport);
    const pending = adapter.selectClaims(createRequest(), { signal: controller.signal });

    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(1);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("preserves synchronous transport failures as promise rejections", async () => {
    const adapter = createHoidClaimSelectorAdapter(() => {
      throw new Error("synthetic transport failure");
    });

    await expect(adapter.selectClaims(createRequest(), { signal: new AbortController().signal }))
      .rejects.toThrow("synthetic transport failure");
  });
});
