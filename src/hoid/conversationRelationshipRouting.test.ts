import { describe, expect, it, vi } from "vitest";
import { createHoidConversationGateway } from "./conversationGateway";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";

const UPDATED_AT = "2026-11-18T06:00:00.000Z";

function snapshot(chapter = 3, revision = 1) {
  const cursor = createHoidReadingCursor("tfe", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor sintético no disponible");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId: "tfe", cursor: cursor.cursor }],
    updatedAt: UPDATED_AT,
  };
}

function identity(progress: unknown) {
  const projection = projectHoidCursorProgressSnapshot(progress);
  if (projection.status !== "ready") throw new Error("Progreso sintético inválido");
  return {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  };
}

const abstain: HoidEvidenceAnswer = Object.freeze({
  status: "abstain",
  reason: "no-authorized-evidence",
  text: "No hay evidencia autorizada.",
  claimIds: Object.freeze([]),
  evidenceIds: Object.freeze([]),
  sources: Object.freeze([]),
});

describe("HoidConversationGateway relationship routing", () => {
  it("routes explicit relationship questions to the graph gateway and never to the claim selector", async () => {
    const progress = snapshot();
    const relationshipGateway = {
      answer: vi.fn(() => ({
        status: "no-path" as const,
        ...identity(progress),
      })),
    };
    const runtime = { answer: vi.fn(async () => abstain) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => progress,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({
      question: "¿Qué relación hay entre Vin y Kelsier?",
      progress,
    });
    expect(result).toEqual({ status: "unavailable", reason: "entity-unavailable" });
    expect(relationshipGateway.answer).toHaveBeenCalledTimes(1);
    expect(runtime.answer).not.toHaveBeenCalled();
  });

  it("does not route ordinary explanations through the relationship gateway", async () => {
    const progress = snapshot();
    const relationshipGateway = { answer: vi.fn() };
    const runtime = { answer: vi.fn(async () => abstain) };
    const gateway = createHoidConversationGateway({
      runtime,
      getCurrentProgress: () => progress,
      relationshipGateway,
    });
    if (!gateway) throw new Error("No se pudo crear el gateway sintético");

    const result = await gateway.answer({ question: "¿Cómo funciona este sistema?", progress });
    expect(result.status).toBe("ready");
    expect(relationshipGateway.answer).not.toHaveBeenCalled();
    expect(runtime.answer).toHaveBeenCalledTimes(1);
  });
});
