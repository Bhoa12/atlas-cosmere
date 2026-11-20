import { describe, expect, it } from "vitest";
import type { HoidClaimSelector } from "./evidenceRuntime";
import {
  createHoidClaimSelectionRequest,
  createHoidClaimSelectionResponse,
  parseHoidClaimSelectionResponse,
} from "./selectionProtocol";
import type { HoidClaimSelectionRequest } from "./selectionProtocol";
import type {
  HoidClaimSelectionTransport,
  HoidClaimSelectionTransportContext,
  HoidClaimSelectorAdapter,
} from "./providerAdapter";
import type { HoidAnswerSelectionBudget } from "./types";

/**
 * Reusable behavioral suite for provider-neutral Hoid selector adapters.
 * Provider-specific packages can pass their own factory and transport bridge
 * without importing a vendor SDK into the Hoid domain.
 */
export type HoidProviderAdapterFactory = (
  transport: HoidClaimSelectionTransport,
) => HoidClaimSelectorAdapter;

const CONFORMANCE_BUDGET: HoidAnswerSelectionBudget = Object.freeze({
  maxClaims: 2,
  maxEvidence: 4,
  maxWorks: 2,
  maxCharacters: 6_000,
  minimumWorks: 1,
  requireSegmentProvenance: true,
  requireCrossWorkSegment: false,
});

function syntheticRequest(): HoidClaimSelectionRequest {
  return createHoidClaimSelectionRequest({
    question: "¿Qué significa este concepto sintético?",
    intent: "explain",
    candidates: [{
      id: "claim.conformance",
      text: "Afirmación sintética de conformidad.",
      evidenceIds: ["evidence.conformance"],
    }],
    selectionBudget: CONFORMANCE_BUDGET,
    reading: [{ bookId: "synthetic-work", chapter: 2, completed: true }],
  });
}

function invocationContext(signal: AbortSignal): HoidClaimSelectionTransportContext {
  return Object.freeze({ signal });
}

function abortError(): Error {
  const error = new Error("Synthetic transport abort.");
  error.name = "AbortError";
  return error;
}

export function defineHoidProviderAdapterConformanceSuite(
  label: string,
  createAdapter: HoidProviderAdapterFactory,
): void {
  describe(`${label} — Hoid adapter conformance`, () => {
    it("forwards the exact immutable v1 request and the exact invocation signal", async () => {
      const request = syntheticRequest();
      const controller = new AbortController();
      let receivedRequest: HoidClaimSelectionRequest | undefined;
      let receivedContext: HoidClaimSelectionTransportContext | undefined;
      const adapter = createAdapter(async (candidate, context) => {
        receivedRequest = candidate;
        receivedContext = context;
        return createHoidClaimSelectionResponse(candidate, ["claim.conformance"]);
      });

      const response = await adapter.selectClaims(request, invocationContext(controller.signal));

      expect(receivedRequest).toBe(request);
      expect(receivedContext?.signal).toBe(controller.signal);
      expect(Object.isFrozen(receivedContext)).toBe(true);
      expect(parseHoidClaimSelectionResponse(response, request, 2)).toEqual(["claim.conformance"]);
    });

    it("rejects mutable request snapshots before invoking the transport", async () => {
      const request = syntheticRequest();
      const mutable = {
        ...request,
        candidates: request.candidates.map(candidate => ({
          ...candidate,
          evidenceIds: [...candidate.evidenceIds],
        })),
      } as unknown as HoidClaimSelectionRequest;
      let dispatches = 0;
      const adapter = createAdapter(async () => {
        dispatches += 1;
        return {};
      });

      await expect(adapter.selectClaims(mutable, invocationContext(new AbortController().signal)))
        .rejects.toThrow();
      expect(dispatches).toBe(0);
    });

    it("rejects accessor-backed invocation contexts without evaluating accessors", async () => {
      let getterCalls = 0;
      const context = Object.create(null) as Record<string, unknown>;
      Object.defineProperty(context, "signal", {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          return new AbortController().signal;
        },
      });
      Object.freeze(context);
      let dispatches = 0;
      const adapter = createAdapter(async () => {
        dispatches += 1;
        return {};
      });

      await expect(adapter.selectClaims(
        syntheticRequest(),
        context as unknown as HoidClaimSelectionTransportContext,
      )).rejects.toThrow();
      expect(getterCalls).toBe(0);
      expect(dispatches).toBe(0);
    });

    it("does not dispatch when the invocation signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      let dispatches = 0;
      const adapter = createAdapter(async () => {
        dispatches += 1;
        return {};
      });

      await expect(adapter.selectClaims(syntheticRequest(), invocationContext(controller.signal)))
        .rejects.toMatchObject({ name: "AbortError" });
      expect(dispatches).toBe(0);
    });

    it("propagates active cancellation to the transport signal", async () => {
      const controller = new AbortController();
      let dispatches = 0;
      const adapter = createAdapter((_request, context) => {
        dispatches += 1;
        return new Promise<unknown>((_resolve, reject) => {
          context.signal.addEventListener("abort", () => reject(abortError()), { once: true });
        });
      });
      const pending = adapter.selectClaims(syntheticRequest(), invocationContext(controller.signal));

      await Promise.resolve();
      expect(dispatches).toBe(1);
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    });

    it("dispatches at most once per invocation and never retries an unclassified transport failure", async () => {
      let dispatches = 0;
      const adapter = createAdapter(async () => {
        dispatches += 1;
        throw new Error("Synthetic transport failure.");
      });

      await expect(adapter.selectClaims(
        syntheticRequest(),
        invocationContext(new AbortController().signal),
      )).rejects.toThrow("Synthetic transport failure.");
      expect(dispatches).toBe(1);
    });

    it("keeps identical request fingerprints stable across explicit repeated invocations", async () => {
      const request = syntheticRequest();
      const seenFingerprints: string[] = [];
      const adapter = createAdapter(async received => {
        seenFingerprints.push(received.requestFingerprint);
        return createHoidClaimSelectionResponse(received, ["claim.conformance"]);
      });

      await adapter.selectClaims(request, invocationContext(new AbortController().signal));
      await adapter.selectClaims(request, invocationContext(new AbortController().signal));

      expect(seenFingerprints).toEqual([
        request.requestFingerprint,
        request.requestFingerprint,
      ]);
      expect(Object.isFrozen(request)).toBe(true);
    });
  });
}

/** Compile-time proof that a conforming adapter can be supplied to the runtime. */
export function assertHoidRuntimeSelectorCompatibility(
  adapter: HoidClaimSelectorAdapter,
): HoidClaimSelector {
  return adapter;
}
