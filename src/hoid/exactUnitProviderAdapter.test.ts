import { describe, expect, it, vi } from "vitest";
import type {
  HoidExactClaimSelectionContext,
  HoidExactClaimSelectionRequest,
} from "./exactUnitEvidenceRuntime";
import type { HoidAnswerSelectionBudget } from "./types";
import {
  createHoidExactUnitSelectionAdapter,
  inspectHoidExactProviderInvocationContext,
  inspectHoidExactProviderSelectionSnapshot,
  isHoidExactProviderSelectionSnapshot,
} from "./exactUnitProviderAdapter";

const budget: HoidAnswerSelectionBudget = Object.freeze({
  maxClaims: 3,
  maxEvidence: 8,
  maxWorks: 2,
  maxCharacters: 8_000,
  minimumWorks: 1,
  requireSegmentProvenance: true,
  requireCrossWorkSegment: false,
});

function candidate(id = "claim.alpha") {
  return Object.freeze({
    id,
    text: "Afirmación editorial sintética aprobada.",
    evidenceIds: Object.freeze(["evidence.alpha"]),
  });
}

function requestV2(): HoidExactClaimSelectionRequest {
  return Object.freeze({
    schemaVersion: 2,
    requestFingerprint: "a".repeat(64),
    question: "¿Qué significa este concepto sintético?",
    intent: "explain",
    candidates: Object.freeze([candidate()]),
    selectionBudget: budget,
  });
}

function requestV3(): HoidExactClaimSelectionRequest {
  return Object.freeze({
    schemaVersion: 3,
    requestFingerprint: "b".repeat(64),
    question: "¿Y cómo se relaciona con la explicación anterior?",
    intent: "context",
    candidates: Object.freeze([candidate()]),
    selectionBudget: budget,
    conversationContext: Object.freeze({
      schemaVersion: 1,
      priorClaimIds: Object.freeze(["claim.previous"]),
      entityIds: Object.freeze(["evidence.alpha"]),
      bookIds: Object.freeze(["twok", "warbreaker"]),
    }),
  });
}

function invocation(signal: AbortSignal): HoidExactClaimSelectionContext {
  return Object.freeze({ signal });
}

function selected(request: HoidExactClaimSelectionRequest): unknown {
  return Object.freeze({
    schemaVersion: request.schemaVersion,
    requestFingerprint: request.requestFingerprint,
    claimIds: Object.freeze(["claim.alpha"]),
  });
}

function abortError(): Error {
  const error = new Error("Synthetic transport cancellation.");
  error.name = "AbortError";
  return error;
}

describe("Hoid exact-unit provider adapter v2/v3", () => {
  it("accepts the closed immutable v2 snapshot and exposes no raw reading state", () => {
    const request = requestV2();
    expect(inspectHoidExactProviderSelectionSnapshot(request)).toBeNull();
    expect(isHoidExactProviderSelectionSnapshot(request)).toBe(true);
    expect(Object.keys(request).sort()).toEqual([
      "candidates", "intent", "question", "requestFingerprint", "schemaVersion", "selectionBudget",
    ]);
    expect(request).not.toHaveProperty("progress");
    expect(request).not.toHaveProperty("reading");
    expect(request).not.toHaveProperty("conversationContext");
  });

  it("accepts the closed immutable v3 snapshot with bounded context IDs only", () => {
    const request = requestV3();
    expect(inspectHoidExactProviderSelectionSnapshot(request)).toBeNull();
    expect(isHoidExactProviderSelectionSnapshot(request)).toBe(true);
    expect(request.conversationContext).toEqual({
      schemaVersion: 1,
      priorClaimIds: ["claim.previous"],
      entityIds: ["evidence.alpha"],
      bookIds: ["twok", "warbreaker"],
    });
    const serialized = JSON.stringify(request);
    for (const forbidden of ["progressRevision", "progressFingerprint", "unitId", "identityFingerprint", "chapterNumber"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("forwards the exact request and the exact per-invocation signal for both versions", async () => {
    for (const request of [requestV2(), requestV3()]) {
      const controller = new AbortController();
      let receivedRequest: HoidExactClaimSelectionRequest | undefined;
      let receivedSignal: AbortSignal | undefined;
      const transport = vi.fn(async (value: HoidExactClaimSelectionRequest, context: HoidExactClaimSelectionContext) => {
        receivedRequest = value;
        receivedSignal = context.signal;
        return selected(value);
      });
      const adapter = createHoidExactUnitSelectionAdapter(transport);
      const result = await adapter.selectClaims(request, invocation(controller.signal));
      expect(receivedRequest).toBe(request);
      expect(receivedSignal).toBe(controller.signal);
      expect(result).toEqual(selected(request));
      expect(transport).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects a v2 request carrying v3 context and a v3 request missing context", async () => {
    const base = requestV2();
    const wrongV2 = Object.freeze({ ...base, conversationContext: requestV3().conversationContext });
    const wrongV3 = Object.freeze({
      ...requestV2(),
      schemaVersion: 3,
    });
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    expect(inspectHoidExactProviderSelectionSnapshot(wrongV2)).not.toBeNull();
    expect(inspectHoidExactProviderSelectionSnapshot(wrongV3)).not.toBeNull();
    await expect(adapter.selectClaims(wrongV2 as unknown as HoidExactClaimSelectionRequest, invocation(new AbortController().signal)))
      .rejects.toThrow();
    await expect(adapter.selectClaims(wrongV3 as unknown as HoidExactClaimSelectionRequest, invocation(new AbortController().signal)))
      .rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects unknown books, unsorted context IDs and duplicate candidate IDs", () => {
    const source = requestV3();
    const unknownBook = Object.freeze({
      ...source,
      conversationContext: Object.freeze({
        ...source.conversationContext!,
        bookIds: Object.freeze(["not-a-catalogue-work"]),
      }),
    });
    const unsorted = Object.freeze({
      ...source,
      conversationContext: Object.freeze({
        ...source.conversationContext!,
        bookIds: Object.freeze(["warbreaker", "twok"]),
      }),
    });
    const duplicateCandidates = Object.freeze({
      ...requestV2(),
      candidates: Object.freeze([candidate("claim.alpha"), candidate("claim.alpha")]),
    });
    expect(inspectHoidExactProviderSelectionSnapshot(unknownBook)).toBe("conversation-context-values");
    expect(inspectHoidExactProviderSelectionSnapshot(unsorted)).toBe("conversation-context-order");
    expect(inspectHoidExactProviderSelectionSnapshot(duplicateCandidates)).toBe("candidate-values");
  });

  it("rejects accessor-backed request fields without invoking getters", () => {
    let getterCalls = 0;
    const hostile = Object.defineProperties({}, {
      schemaVersion: { enumerable: true, value: 2 },
      requestFingerprint: { enumerable: true, value: "a".repeat(64) },
      question: { enumerable: true, get() { getterCalls += 1; return "Pregunta"; } },
      intent: { enumerable: true, value: "explain" },
      candidates: { enumerable: true, value: requestV2().candidates },
      selectionBudget: { enumerable: true, value: budget },
    });
    Object.freeze(hostile);
    expect(inspectHoidExactProviderSelectionSnapshot(hostile)).toBe("request-fields");
    expect(getterCalls).toBe(0);
  });

  it("distinguishes malformed budget shape from out-of-range budget values", () => {
    const malformedBudget = Object.freeze({ ...budget, unexpected: true });
    const malformed = Object.freeze({ ...requestV2(), selectionBudget: malformedBudget });
    const outOfRangeBudget = Object.freeze({ ...budget, maxCharacters: 32_001 });
    const outOfRange = Object.freeze({ ...requestV2(), selectionBudget: outOfRangeBudget });
    expect(inspectHoidExactProviderSelectionSnapshot(malformed)).toBe("budget-shape");
    expect(inspectHoidExactProviderSelectionSnapshot(outOfRange)).toBe("budget-values");
  });

  it("rejects mutable nested candidates before transport dispatch", async () => {
    const request = requestV2();
    const mutable = {
      ...request,
      candidates: [{ id: "claim.alpha", text: "Afirmación sintética.", evidenceIds: ["evidence.alpha"] }],
    } as unknown as HoidExactClaimSelectionRequest;
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    expect(isHoidExactProviderSelectionSnapshot(mutable)).toBe(false);
    await expect(adapter.selectClaims(mutable, invocation(new AbortController().signal))).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects accessor-backed invocation contexts without invoking the getter", async () => {
    let getterCalls = 0;
    const hostile = Object.defineProperty({}, "signal", {
      enumerable: true,
      get() { getterCalls += 1; return new AbortController().signal; },
    });
    Object.freeze(hostile);
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    expect(inspectHoidExactProviderInvocationContext(hostile)).toEqual({
      status: "invalid", issue: "context-shape",
    });
    await expect(adapter.selectClaims(requestV2(), hostile as unknown as HoidExactClaimSelectionContext)).rejects.toThrow();
    expect(getterCalls).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not dispatch when cancellation is already active or wins the dispatch microtask", async () => {
    const transport = vi.fn(async () => ({}));
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(adapter.selectClaims(requestV2(), invocation(alreadyAborted.signal)))
      .rejects.toMatchObject({ name: "AbortError" });

    const pendingController = new AbortController();
    const pending = adapter.selectClaims(requestV2(), invocation(pendingController.signal));
    pendingController.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("forwards active cancellation to the transport without retrying", async () => {
    const controller = new AbortController();
    const transport = vi.fn((_request: HoidExactClaimSelectionRequest, context: HoidExactClaimSelectionContext) =>
      new Promise<unknown>((_resolve, reject) => {
        context.signal.addEventListener("abort", () => reject(abortError()), { once: true });
      }));
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    const pending = adapter.selectClaims(requestV3(), invocation(controller.signal));
    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("dispatches at most once and propagates an unclassified transport failure", async () => {
    const transport = vi.fn(async () => { throw new Error("Synthetic transport failure."); });
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    await expect(adapter.selectClaims(requestV2(), invocation(new AbortController().signal)))
      .rejects.toThrow("Synthetic transport failure.");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not turn provider output into an authorization decision", async () => {
    const untrusted = Object.freeze({
      schemaVersion: 3,
      requestFingerprint: "f".repeat(64),
      claimIds: Object.freeze(["claim.not-in-request"]),
      answerText: "Untrusted provider prose.",
      unlock: "all-books",
    });
    const transport = vi.fn(async () => untrusted);
    const adapter = createHoidExactUnitSelectionAdapter(transport);
    const result = await adapter.selectClaims(requestV3(), invocation(new AbortController().signal));
    expect(result).toBe(untrusted);
    // The exact-unit runtime remains responsible for rejecting this envelope.
    expect(result).not.toHaveProperty("authorized");
  });
});
