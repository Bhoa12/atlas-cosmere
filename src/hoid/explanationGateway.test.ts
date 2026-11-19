import { describe, expect, it } from "vitest";
import {
  createHoidExplanationGateway,
  createProductionHoidExplanationGateway,
  type HoidExplanationEnginePort,
} from "./explanationGateway";
import {
  createHoidExplanationPlan,
  renderHoidExplanationPlan,
  type HoidKnowledgeGraphDefinition,
  type HoidKnowledgeGraphRelation,
} from "./knowledgeGraphQuery";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { createHoidApprovedClaimAttestation } from "./approvedClaimIntegrity";
import type { HoidApprovedClaim } from "./evidenceRuntime";

const NOW = "2026-11-18T03:30:00.000Z";

function progress(positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>) {
  const canonical = positions.map(position => {
    if (position.completed === true) return { bookId: position.bookId, completed: true as const };
    const cursor = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursor.status !== "ready") throw new Error("Cursor de fixture no disponible");
    return { bookId: position.bookId, cursor: cursor.cursor };
  });
  return {
    schemaVersion: 2,
    revision: canonical.length === 0 ? 0 : 1,
    positions: canonical,
    updatedAt: canonical.length === 0 ? null : NOW,
  };
}

function knowledge(id: string, bookId: string) {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto de fixture no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Localizador de fixture no disponible");
  return {
    id,
    aliases: [id],
    kind: "character" as const,
    firstSafeAppearance: { bookId, chapter: 1 },
    evidenceSource: { bookId, chapter: 1, locatorId: unit.locatorId },
    evidenceUnlock: { bookId, chapter: 1 },
    summary: "Resumen sintético de prueba; no representa hechos del Cosmere.",
    provenance: "verified" as const,
  };
}

function claim(
  id: string,
  sourceKnowledge: readonly ReturnType<typeof knowledge>[],
  text: string,
): HoidApprovedClaim {
  const core = {
    id,
    text,
    intent: "explain" as const,
    evidenceIds: sourceKnowledge.map(entry => entry.id),
  };
  const attestation = createHoidApprovedClaimAttestation(core, sourceKnowledge, {
    reviewerId: "synthetic-reviewer",
    reviewedAt: NOW,
  });
  if (attestation.status !== "valid") {
    throw new Error("Explanation fixture claim attestation failed: " + attestation.reason);
  }
  return Object.freeze({ ...core, integrity: attestation.integrity, review: attestation.review });
}

function relation(id: string, subjectId: string, objectId: string, claimId: string): HoidKnowledgeGraphRelation {
  return { id, subjectId, predicate: "related-to", objectId, claimId };
}

function fixture() {
  const a = knowledge("synthetic.a", "twok");
  const b = knowledge("synthetic.b", "edgedancer");
  const c = knowledge("synthetic.c", "dawnshard");
  const ab = claim("synthetic.claim-ab", [a, b], "Afirmación sintética A conecta con B.");
  const bc = claim("synthetic.claim-bc", [b, c], "Afirmación sintética B conecta con C.");
  const definition: HoidKnowledgeGraphDefinition = {
    schemaVersion: 1,
    relations: [
      relation("synthetic.edge-ab", a.id, b.id, ab.id),
      relation("synthetic.edge-bc", b.id, c.id, bc.id),
    ],
  };
  const knowledgeItems = [a, b, c];
  const claims = [ab, bc];
  const completed = progress([
    { bookId: "twok", chapter: 2 },
    { bookId: "edgedancer", chapter: 2 },
    { bookId: "dawnshard", chapter: 2 },
  ]);
  const changed = progress([
    { bookId: "twok", chapter: 3 },
    { bookId: "edgedancer", chapter: 2 },
    { bookId: "dawnshard", chapter: 2 },
  ]);
  const engine: HoidExplanationEnginePort = Object.freeze({
    createPlan: (snapshot, query) => createHoidExplanationPlan(
      definition, knowledgeItems, claims, snapshot, query,
    ),
    renderPlan: (plan, snapshot) => renderHoidExplanationPlan(plan, claims, snapshot),
  });
  const query = Object.freeze({ fromId: a.id, toId: c.id, maxDepth: 2 });
  return { a, b, c, claims, completed, changed, engine, query };
}

describe("Hoid progress-bound explanation gateway", () => {
  it("renders only exact approved statements and retains per-segment citations", () => {
    const f = fixture();
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine: f.engine,
    });
    expect(gateway).not.toBeNull();
    const result = gateway!.explain({ progress: f.completed, query: f.query });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.explanation.text).toBe(f.claims.map(item => item.text).join("\n\n"));
    expect(result.explanation.segments).toHaveLength(2);
    expect(result.explanation.segments.every(segment => segment.sources.length === 2)).toBe(true);
    expect(result.progressRevision).toBe(1);
    expect(result.explanation.truncated).toBe(false);
  });

  it("returns an opaque no-path result when no authorized relationship exists", () => {
    const f = fixture();
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine: f.engine,
    });
    const result = gateway!.explain({
      progress: f.completed,
      query: { fromId: "synthetic.missing", toId: f.c.id },
    });
    expect(result.status).toBe("no-path");
    if (result.status === "no-path") expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not invoke the planner when the authoritative progress already differs", () => {
    const f = fixture();
    let plans = 0;
    const engine: HoidExplanationEnginePort = {
      ...f.engine,
      createPlan: (snapshot, query) => {
        plans += 1;
        return f.engine.createPlan(snapshot, query);
      },
    };
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.changed,
      engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(plans).toBe(0);
  });

  it("discards a complete explanation if progress changes before the result is returned", () => {
    const f = fixture();
    let reads = 0;
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => {
        reads += 1;
        return reads === 1 ? f.completed : f.changed;
      },
      engine: f.engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(reads).toBe(2);
  });

  it("rejects query accessors without executing them", () => {
    const f = fixture();
    const query = { fromId: f.a.id, toId: f.c.id } as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(query, "maxDepth", {
      enumerable: true,
      get: () => { invoked = true; return 2; },
    });
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine: f.engine,
    });
    expect(gateway!.explain({ progress: f.completed, query }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(invoked).toBe(false);
  });

  it("rejects extra request fields and malformed path bounds", () => {
    const f = fixture();
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine: f.engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query, providerText: "spoiler" }))
      .toEqual({ status: "unavailable", reason: "invalid-request" });
    expect(gateway!.explain({
      progress: f.completed,
      query: { fromId: f.a.id, toId: f.c.id, maxDepth: 99 },
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
  });

  it("rejects a plan bound to a different progress identity", () => {
    const f = fixture();
    const engine: HoidExplanationEnginePort = {
      createPlan: (snapshot, query) => {
        const result = f.engine.createPlan(snapshot, query);
        if (result.status !== "ready") return result;
        return {
          status: "ready",
          plan: { ...result.plan, progressRevision: 99 },
        };
      },
      renderPlan: f.engine.renderPlan,
    };
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "invalid-plan" });
  });

  it("rejects rendered text that is not the exact concatenation of approved segments", () => {
    const f = fixture();
    const engine: HoidExplanationEnginePort = {
      createPlan: f.engine.createPlan,
      renderPlan: (plan, snapshot) => {
        const rendered = f.engine.renderPlan(plan, snapshot);
        if (rendered.status !== "ready") return rendered;
        return { ...rendered, text: "Texto añadido por un proveedor." };
      },
    };
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "invalid-rendered-explanation" });
  });

  it("contains planner and renderer exceptions without returning partial text", () => {
    const f = fixture();
    const plannerFailure = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine: {
        createPlan: () => { throw new Error("synthetic planner failure"); },
        renderPlan: f.engine.renderPlan,
      },
    });
    expect(plannerFailure!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "engine-failed" });

    const rendererFailure = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine: {
        createPlan: f.engine.createPlan,
        renderPlan: () => { throw new Error("synthetic renderer failure"); },
      },
    });
    expect(rendererFailure!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "engine-failed" });
  });

  it("keeps the production explanation route unavailable while the approved registry is empty", () => {
    const f = fixture();
    const gateway = createProductionHoidExplanationGateway(() => f.completed);
    expect(gateway).not.toBeNull();
    expect(gateway!.explain({
      progress: f.completed,
      query: { fromId: f.a.id, toId: f.b.id },
    }).status).toBe("no-path");
  });

  it("rejects an invalid authoritative snapshot and a throwing progress reader", () => {
    const f = fixture();
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => ({ schemaVersion: 2, revision: -1, positions: [], updatedAt: null }),
      engine: f.engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "invalid-progress" });

    const throwing = createHoidExplanationGateway({
      getCurrentProgress: () => { throw new Error("synthetic progress failure"); },
      engine: f.engine,
    });
    expect(throwing!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects a plan whose endpoint IDs differ from the requested entities", () => {
    const f = fixture();
    const engine: HoidExplanationEnginePort = {
      createPlan: (snapshot, query) => {
        const result = f.engine.createPlan(snapshot, query);
        if (result.status !== "ready") return result;
        return { status: "ready", plan: { ...result.plan, fromId: "synthetic.other" } };
      },
      renderPlan: f.engine.renderPlan,
    };
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "invalid-plan" });
  });

  it("rejects a segment whose citations do not exactly cover its evidence IDs", () => {
    const f = fixture();
    const engine: HoidExplanationEnginePort = {
      createPlan: f.engine.createPlan,
      renderPlan: (plan, snapshot) => {
        const rendered = f.engine.renderPlan(plan, snapshot);
        if (rendered.status !== "ready") return rendered;
        return {
          ...rendered,
          segments: rendered.segments.map((segment, index) => index === 0
            ? { ...segment, sources: segment.sources.slice(0, 1) }
            : segment),
        };
      },
    };
    const gateway = createHoidExplanationGateway({
      getCurrentProgress: () => f.completed,
      engine,
    });
    expect(gateway!.explain({ progress: f.completed, query: f.query }))
      .toEqual({ status: "unavailable", reason: "invalid-rendered-explanation" });
  });

});
