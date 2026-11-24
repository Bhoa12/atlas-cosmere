import { describe, expect, it, vi } from "vitest";
import {
  createHoidTopicInterestRecommendationGateway,
} from "./topicInterestRecommendationsGateway";
import { createHoidTopicInterestContext } from "./topicInterestContext";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { HOID_APPROVED_TOPIC_ASSIGNMENTS } from "./topicTaxonomy";

const UPDATED_AT = "2026-11-18T17:00:00.000Z";

function snapshot(chapter = 3, revision = 7) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "twok", cursor: cursor.cursor }],
    updatedAt: UPDATED_AT,
  };
}

function context(progress: unknown = snapshot()) {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Synthetic progress invalid");
  const result = createHoidTopicInterestContext(["investiture-system", "organization"], {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
  if (!result) throw new Error("Synthetic interest context invalid");
  return result;
}

function setup(initial = snapshot(), answerApprovedClaims?: (ids: readonly string[], progress: unknown) => unknown) {
  let current: unknown = initial;
  const gateway = createHoidTopicInterestRecommendationGateway({
    getCurrentProgress: () => current,
    ...(answerApprovedClaims ? { answerApprovedClaims } : {}),
  });
  if (!gateway) throw new Error("Synthetic topic-interest gateway unavailable");
  return {
    gateway,
    setCurrent(value: unknown) { current = value; },
  };
}

describe("Hoid topic-interest recommendation gateway", () => {
  it("returns a neutral no-match result while the production assignment registry is empty", async () => {
    expect(HOID_APPROVED_TOPIC_ASSIGNMENTS).toEqual([]);
    const answerPort = vi.fn();
    const current = snapshot();
    const { gateway } = setup(current, answerPort);
    const result = await gateway.recommend({ progress: current, context: context(current), limit: 5 });
    expect(result).toMatchObject({ status: "none", reason: "no-safe-reviewed-matches" });
    expect(answerPort).not.toHaveBeenCalled();
  });

  it("does not accept an unbound or missing topic-interest context", async () => {
    const current = snapshot();
    const { gateway } = setup(current);
    expect(await gateway.recommend({ progress: current })).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
    expect(await gateway.recommend({ progress: current, context: null })).toEqual({
      status: "unavailable",
      reason: "context-missing",
    });
    expect(await gateway.recommend({ progress: current, context: {} })).toEqual({
      status: "unavailable",
      reason: "context-invalid",
    });
  });

  it("rejects a context whose progress revision or fingerprint is stale", async () => {
    const initial = snapshot(3, 7);
    const { gateway } = setup(initial);
    expect(await gateway.recommend({
      progress: snapshot(4, 8),
      context: context(initial),
    })).toEqual({ status: "unavailable", reason: "context-stale" });
  });

  it("rejects a request when the live progress differs before recommendation", async () => {
    const initial = snapshot(3, 7);
    const { gateway, setCurrent } = setup(initial);
    setCurrent(snapshot(4, 8));
    expect(await gateway.recommend({
      progress: initial,
      context: context(initial),
    })).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("does not invoke a local answer port when no selected topic has an approved work assignment", async () => {
    const current = snapshot();
    const port = vi.fn(async () => []);
    const { gateway } = setup(current, port);
    const result = await gateway.recommend({ progress: current, context: context(current) });
    expect(result.status).toBe("none");
    expect(port).not.toHaveBeenCalled();
  });

  it("rejects extra request fields and invalid limits before reading progress", async () => {
    const getCurrentProgress = vi.fn(() => snapshot());
    const gateway = createHoidTopicInterestRecommendationGateway({ getCurrentProgress });
    if (!gateway) throw new Error("Gateway unavailable");
    expect(await gateway.recommend({
      progress: snapshot(),
      context: context(),
      provider: "untrusted",
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(await gateway.recommend({
      progress: snapshot(),
      context: context(),
      limit: 11,
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(getCurrentProgress).not.toHaveBeenCalled();
  });

  it("rejects a malformed current progress snapshot without exposing recommendations", async () => {
    const gateway = createHoidTopicInterestRecommendationGateway({ getCurrentProgress: () => null });
    if (!gateway) throw new Error("Gateway unavailable");
    const current = snapshot();
    expect(await gateway.recommend({ progress: current, context: context(current) })).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
  });

  it("uses the durable refresh port before evaluating selected topic recommendations", async () => {
    const initial = snapshot(3, 7);
    const newer = snapshot(4, 8);
    const refreshCurrentProgress = vi.fn(async () => newer);
    const gateway = createHoidTopicInterestRecommendationGateway({
      getCurrentProgress: () => initial,
      refreshCurrentProgress,
    });
    if (!gateway) throw new Error("Gateway unavailable");

    const result = await gateway.recommend({
      progress: initial,
      context: context(initial),
    });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(1);
  });

  it("does not read progress when the request signal is already aborted", async () => {
    const getCurrentProgress = vi.fn(() => snapshot());
    const gateway = createHoidTopicInterestRecommendationGateway({ getCurrentProgress });
    if (!gateway) throw new Error("Gateway unavailable");
    const current = snapshot();
    const controller = new AbortController();
    controller.abort();

    await expect(gateway.recommend({
      progress: current,
      context: context(current),
    }, controller.signal)).resolves.toEqual({
      status: "unavailable",
      reason: "cancelled",
    });
    expect(getCurrentProgress).not.toHaveBeenCalled();
  });

  it("returns promptly when a durable progress refresh is aborted and ignores its late result", async () => {
    const initial = snapshot(3, 7);
    let resolveRefresh!: (value: unknown) => void;
    const refreshCurrentProgress = vi.fn(() => new Promise<unknown>(resolve => {
      resolveRefresh = resolve;
    }));
    const gateway = createHoidTopicInterestRecommendationGateway({
      getCurrentProgress: () => initial,
      refreshCurrentProgress,
    });
    if (!gateway) throw new Error("Gateway unavailable");
    const controller = new AbortController();
    const pending = gateway.recommend({
      progress: initial,
      context: context(initial),
    }, controller.signal);

    expect(refreshCurrentProgress).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(pending).resolves.toEqual({
      status: "unavailable",
      reason: "cancelled",
    });
    resolveRefresh(initial);
    await Promise.resolve();
  });

  it("fails closed when the durable progress refresh cannot read SQLite", async () => {
    const initial = snapshot(3, 7);
    const refreshCurrentProgress = vi.fn(async () => null);
    const gateway = createHoidTopicInterestRecommendationGateway({
      getCurrentProgress: () => initial,
      refreshCurrentProgress,
    });
    if (!gateway) throw new Error("Gateway unavailable");

    const result = await gateway.recommend({
      progress: initial,
      context: context(initial),
    });
    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(1);
  });

});
