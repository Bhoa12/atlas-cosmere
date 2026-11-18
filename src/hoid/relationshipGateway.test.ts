import { describe, expect, it, vi } from "vitest";
import {
  createHoidRelationshipGateway,
  type HoidRelationshipGatewayConfig,
} from "./relationshipGateway";
import type { HoidEntityMentionResolutionResult, HoidResolvedEntity } from "./entityResolver";
import type { HoidExplanationGatewayResult } from "./explanationGateway";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";

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

function source(evidenceId: string) {
  const manifest = getHoidReadingManifest("tfe");
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units[0];
  if (!unit.locatorId) throw new Error("Localizador sintético no disponible");
  const documentSha256 = getVerifiedChapterDocumentSha256(
    "tfe",
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    1,
  );
  if (!documentSha256) throw new Error("Hash documental sintético no disponible");
  return Object.freeze({
    evidenceId,
    sourceBookId: "tfe",
    sourceChapter: 1,
    locatorId: unit.locatorId,
    unlockBookId: "tfe",
    unlockChapter: 1,
    editionId: manifest.manifest.editionId,
    navigationSha256: manifest.manifest.navigationSha256,
    documentSha256,
  });
}

function entity(id: string, alias: string): HoidResolvedEntity {
  const entitySource = source(id);
  const aliasEvidenceId = "alias." + id;
  return Object.freeze({
    id,
    kind: "character",
    matchedAlias: alias,
    entitySource,
    aliasEvidence: Object.freeze([Object.freeze({
      evidenceId: aliasEvidenceId,
      source: source(aliasEvidenceId),
    })]),
  });
}

function mentionResult(progress: unknown, matches: readonly HoidResolvedEntity[], resolution: "matched" | "ambiguous" | "not-found" = "matched"): HoidEntityMentionResolutionResult {
  const current = identity(progress);
  return Object.freeze({
    status: "ready",
    resolution,
    progressRevision: current.revision,
    progressFingerprint: current.fingerprint,
    matches,
    truncated: false,
  });
}

function readyExplanation(progress: unknown): HoidExplanationGatewayResult {
  const current = identity(progress);
  const evidence = source("evidence.claim-one");
  const explanation = Object.freeze({
    status: "ready" as const,
    planId: "a".repeat(64),
    progressRevision: current.revision,
    text: "Afirmación editorial sintética.",
    segments: Object.freeze([Object.freeze({
      claimId: "claim.one",
      text: "Afirmación editorial sintética.",
      evidenceIds: Object.freeze([evidence.evidenceId]),
      sources: Object.freeze([evidence]),
    })]),
    sources: Object.freeze([evidence]),
    truncated: false,
  });
  return Object.freeze({
    status: "ready",
    explanation,
    progressRevision: current.revision,
    progressFingerprint: current.fingerprint,
  });
}

function setup(options?: {
  initial?: unknown;
  resolver?: (progress: unknown, question: string) => HoidEntityMentionResolutionResult;
  explain?: (input: unknown) => HoidExplanationGatewayResult;
  current?: () => unknown;
}) {
  const initial = options?.initial ?? snapshot();
  let current: unknown = initial;
  const resolver = options?.resolver ?? ((progress: unknown) => mentionResult(progress, [
    entity("vin", "Vin"),
    entity("kelsier", "Kelsier"),
  ]));
  const explain = vi.fn(options?.explain ?? ((input: unknown) => {
    const record = input as { progress: unknown };
    return readyExplanation(record.progress);
  }));
  const config: HoidRelationshipGatewayConfig = {
    getCurrentProgress: options?.current ?? (() => current),
    explanationGateway: { explain },
    resolveEntities: resolver,
  };
  const gateway = createHoidRelationshipGateway(config);
  if (!gateway) throw new Error("No se pudo crear el gateway sintético");
  return { gateway, explain, setCurrent(value: unknown) { current = value; } };
}

describe("HoidRelationshipGateway", () => {
  it("resolves exactly two reviewed aliases in the order they appear in the question", () => {
    const progress = snapshot();
    const { gateway, explain } = setup({ initial: progress });
    const result = gateway.answer({
      question: "¿Qué relación hay entre Kelsier y Vin?",
      progress,
    });

    expect(result.status).toBe("ready");
    expect(explain).toHaveBeenCalledTimes(1);
    expect(explain.mock.calls[0][0]).toMatchObject({
      query: { fromId: "kelsier", toId: "vin", maxDepth: 4, maxPaths: 1 },
    });
  });

  it("tries the reverse direction only when the first direction has no path", () => {
    const progress = snapshot();
    const { gateway, explain } = setup({
      initial: progress,
      explain: vi.fn()
        .mockReturnValueOnce({
          status: "no-path",
          progressRevision: identity(progress).revision,
          progressFingerprint: identity(progress).fingerprint,
        } as HoidExplanationGatewayResult)
        .mockImplementationOnce(() => readyExplanation(progress)),
    });
    const result = gateway.answer({ question: "¿Qué relación hay entre Kelsier y Vin?", progress });

    expect(result.status).toBe("ready");
    expect(explain).toHaveBeenCalledTimes(2);
    expect(explain.mock.calls[1][0]).toMatchObject({
      query: { fromId: "vin", toId: "kelsier" },
    });
  });

  it("blocks a known but undisclosed alias without querying the graph", () => {
    const progress = snapshot();
    const { gateway, explain } = setup({
      initial: progress,
      resolver: () => Object.freeze({ status: "blocked" }),
    });
    expect(gateway.answer({ question: "¿Qué relación hay entre Kelsier y Vin?", progress }))
      .toEqual({ status: "unavailable", reason: "entity-blocked" });
    expect(explain).not.toHaveBeenCalled();
  });

  it("rejects ambiguous or more-than-two entity mentions", () => {
    const progress = snapshot();
    const { gateway, explain } = setup({
      initial: progress,
      resolver: () => mentionResult(progress, [
        entity("vin", "Vin"),
        entity("kelsier", "Kelsier"),
        entity("kaladin", "Kaladin"),
      ], "ambiguous"),
    });
    expect(gateway.answer({ question: "¿Qué relación hay entre Kelsier, Vin y Kaladin?", progress }))
      .toEqual({ status: "unavailable", reason: "entity-ambiguous" });
    expect(explain).not.toHaveBeenCalled();
  });

  it("rejects a resolver result whose aliases are not present in the original question", () => {
    const progress = snapshot();
    const { gateway, explain } = setup({
      initial: progress,
      resolver: () => mentionResult(progress, [
        entity("vin", "Vin"),
        entity("kelsier", "Kelsier"),
      ]),
    });
    expect(gateway.answer({ question: "¿Qué relación hay entre Vin y alguien?", progress }))
      .toEqual({ status: "unavailable", reason: "entity-ambiguous" });
    expect(explain).not.toHaveBeenCalled();
  });

  it("does not query the resolver when the request progress is stale", () => {
    const progress = snapshot();
    const resolver = vi.fn(() => mentionResult(progress, [entity("vin", "Vin"), entity("kelsier", "Kelsier")]));
    const { gateway } = setup({ initial: snapshot(4), resolver });
    expect(gateway.answer({ question: "¿Qué relación hay entre Vin y Kelsier?", progress }))
      .toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(resolver).not.toHaveBeenCalled();
  });

  it("discards a graph result if progress changes before the gateway returns", () => {
    const progress = snapshot();
    let reads = 0;
    const { gateway } = setup({
      initial: progress,
      current: () => {
        reads += 1;
        return reads === 1 ? progress : snapshot(4);
      },
    });
    expect(gateway.answer({ question: "¿Qué relación hay entre Vin y Kelsier?", progress }))
      .toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("returns no-path only after both directed searches are empty", () => {
    const progress = snapshot();
    const currentIdentity = identity(progress);
    const noPath = {
      status: "no-path" as const,
      progressRevision: currentIdentity.revision,
      progressFingerprint: currentIdentity.fingerprint,
    };
    const { gateway, explain } = setup({ initial: progress, explain: () => noPath });
    expect(gateway.answer({ question: "¿Qué relación hay entre Vin y Kelsier?", progress }))
      .toMatchObject({ status: "no-path" });
    expect(explain).toHaveBeenCalledTimes(2);
  });
});
