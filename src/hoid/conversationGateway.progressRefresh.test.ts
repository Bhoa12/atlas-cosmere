import { describe, expect, it, vi } from "vitest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import type { HoidEntityMentionResolutionResult } from "./entityResolver";
import {
  createHoidConversationGateway,
} from "./conversationGateway";
import {
  createHoidReadingCursor,
} from "./readingManifest";
import {
  projectHoidCursorProgressSnapshot,
} from "./cursorEvidenceRuntime";
import {
  fingerprintHoidCursorProgressProjection,
} from "./knowledgeGraph";

const UPDATED_AT = "2026-11-19T14:00:00.000Z";

function snapshot(chapter: number, revision: number) {
  const created = createHoidReadingCursor("twok", chapter);
  if (created.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return Object.freeze({
    schemaVersion: 2 as const,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "twok", cursor: created.cursor }),
    ]),
    updatedAt: UPDATED_AT,
  });
}

function notFound(progress: unknown): HoidEntityMentionResolutionResult {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Synthetic progress invalid");
  return Object.freeze({
    status: "ready",
    resolution: "not-found",
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    matches: Object.freeze([]),
    truncated: false,
  });
}

const abstainedAnswer: HoidEvidenceAnswer = Object.freeze({
  status: "abstain",
  reason: "no-authorized-evidence",
  text: "Sin afirmaciones editoriales autorizadas.",
  claimIds: Object.freeze([]),
  evidenceIds: Object.freeze([]),
  sources: Object.freeze([]),
});

function createGateway(
  refreshCurrentProgress: () => unknown | Promise<unknown>,
  answer = vi.fn(async () => abstainedAnswer),
) {
  const initial = snapshot(4, 7);
  const gateway = createHoidConversationGateway({
    runtime: { answer },
    getCurrentProgress: () => initial,
    refreshCurrentProgress,
    resolveEntities: progress => notFound(progress),
    relationshipGateway: null,
  });
  if (!gateway) throw new Error("Synthetic conversation gateway unavailable");
  return { gateway, initial, answer };
}

describe("Hoid conversation gateway durable progress refresh", () => {
  it("withholds an answer when the SQLite-backed cursor changes during asynchronous selection", async () => {
    const initial = snapshot(4, 7);
    const changed = snapshot(5, 8);
    const refreshCurrentProgress = vi.fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(changed);
    const answer = vi.fn(async () => abstainedAnswer);
    const { gateway } = createGateway(refreshCurrentProgress, answer);

    const result = await gateway.answer({
      question: "¿Qué significa esta expresión?",
      progress: initial,
    });

    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(2);
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("returns an answer only when both durable reads match the requested cursor snapshot", async () => {
    const initial = snapshot(4, 7);
    const refreshCurrentProgress = vi.fn()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(initial);
    const answer = vi.fn(async () => abstainedAnswer);
    const { gateway } = createGateway(refreshCurrentProgress, answer);

    const result = await gateway.answer({
      question: "¿Qué significa esta expresión?",
      progress: initial,
    });

    expect(result).toMatchObject({
      status: "ready",
      progressRevision: 7,
    });
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(2);
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the runtime when the fresh durable snapshot is unavailable", async () => {
    const answer = vi.fn(async () => abstainedAnswer);
    const refreshCurrentProgress = vi.fn(async () => null);
    const { gateway } = createGateway(refreshCurrentProgress, answer);

    const result = await gateway.answer({
      question: "¿Qué significa esta expresión?",
      progress: snapshot(4, 7),
    });

    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
    expect(refreshCurrentProgress).toHaveBeenCalledTimes(1);
    expect(answer).not.toHaveBeenCalled();
  });
});
