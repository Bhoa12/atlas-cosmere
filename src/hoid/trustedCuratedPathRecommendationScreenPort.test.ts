import { describe, expect, it, vi } from "vitest";
import {
  createHoidTrustedCuratedPathRecommendationScreenPort,
  isHoidTrustedCuratedPathRecommendationScreenPort,
} from "./trustedCuratedPathRecommendationScreenPort";

describe("Hoid trusted curated-path recommendation screen port", () => {
  it("creates a branded port and reloads its validation context on every presentation", async () => {
    const loadValidationInput = vi.fn(async () => null);
    const port = createHoidTrustedCuratedPathRecommendationScreenPort({ loadValidationInput });
    expect(port).not.toBeNull();
    if (!port) return;

    expect(isHoidTrustedCuratedPathRecommendationScreenPort(port)).toBe(true);
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "invalid-input",
    });
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "invalid-input",
    });
    expect(loadValidationInput).toHaveBeenCalledTimes(2);
    port.dispose();
  });

  it("rejects structurally compatible but unbranded ports", () => {
    const fake = Object.freeze({
      present: async () => ({ status: "ready", items: [] }),
      dispose: () => {},
    });
    expect(isHoidTrustedCuratedPathRecommendationScreenPort(fake)).toBe(false);
  });

  it("rejects accessor-backed configuration without invoking the getter", () => {
    let getterCalls = 0;
    const hostile = Object.create(null);
    Object.defineProperty(hostile, "loadValidationInput", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return async () => null;
      },
    });
    expect(createHoidTrustedCuratedPathRecommendationScreenPort(hostile)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it("does not call the host loader when the request is already aborted", async () => {
    const loadValidationInput = vi.fn(async () => null);
    const port = createHoidTrustedCuratedPathRecommendationScreenPort({ loadValidationInput });
    if (!port) throw new Error("Port unavailable");
    const controller = new AbortController();
    controller.abort();

    expect(await port.present(controller.signal)).toEqual({
      status: "withheld",
      reason: "cancelled",
    });
    expect(loadValidationInput).not.toHaveBeenCalled();
    port.dispose();
  });

  it("discards an older request when a newer presentation starts", async () => {
    let releaseFirst!: (value: unknown) => void;
    const firstInput = new Promise<unknown>(resolve => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const loadValidationInput = vi.fn(() => {
      calls += 1;
      return calls === 1 ? firstInput : Promise.resolve(null);
    });
    const port = createHoidTrustedCuratedPathRecommendationScreenPort({ loadValidationInput });
    if (!port) throw new Error("Port unavailable");

    const first = port.present();
    const second = port.present();
    expect(await second).toEqual({ status: "withheld", reason: "invalid-input" });
    releaseFirst(null);
    expect(await first).toEqual({ status: "withheld", reason: "cancelled" });
    port.dispose();
  });

  it("returns a neutral source-unavailable result when the host loader fails", async () => {
    const port = createHoidTrustedCuratedPathRecommendationScreenPort({
      loadValidationInput: async () => { throw new Error("private host failure"); },
    });
    if (!port) throw new Error("Port unavailable");
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "source-unavailable",
    });
    port.dispose();
  });

  it("invalidates in-flight work when disposed", async () => {
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>(resolve => { release = resolve; });
    const port = createHoidTrustedCuratedPathRecommendationScreenPort({
      loadValidationInput: () => pending,
    });
    if (!port) throw new Error("Port unavailable");

    const request = port.present();
    port.dispose();
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "port-disposed",
    });
    release(null);
    expect(await request).toEqual({
      status: "withheld",
      reason: "cancelled",
    });
  });
});
