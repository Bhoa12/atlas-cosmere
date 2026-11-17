import { describe, expect, it } from "vitest";
import {
  createHoidExplanationPlan,
  createProductionHoidExplanationPlan,
  queryHoidKnowledgeGraph,
  queryProductionHoidKnowledgeGraph,
  renderHoidExplanationPlan,
  renderProductionHoidExplanationPlan,
  type HoidKnowledgeGraphDefinition,
  type HoidKnowledgeGraphRelation,
} from "./knowledgeGraphQuery";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-17T11:00:00.000Z";

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

function claim(id: string, evidenceIds: string[], text = "Afirmación editorial sintética de prueba.") {
  return {
    id,
    text,
    intent: "explain" as const,
    evidenceIds,
    review: {
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "synthetic-reviewer",
      reviewedAt: NOW,
    },
  };
}

function relation(id: string, subjectId: string, objectId: string, claimId: string): HoidKnowledgeGraphRelation {
  return { id, subjectId, predicate: "related-to", objectId, claimId };
}

function definition(relations: readonly HoidKnowledgeGraphRelation[]): HoidKnowledgeGraphDefinition {
  return { schemaVersion: 1, relations };
}

function fixture() {
  const a = knowledge("synthetic.a", "twok");
  const b = knowledge("synthetic.b", "edgedancer");
  const c = knowledge("synthetic.c", "dawnshard");
  const ab = claim("synthetic.claim-ab", [a.id, b.id], "Afirmación sintética A conecta con B.");
  const bc = claim("synthetic.claim-bc", [b.id, c.id], "Afirmación sintética B conecta con C.");
  const graph = definition([
    relation("synthetic.edge-ab", a.id, b.id, ab.id),
    relation("synthetic.edge-bc", b.id, c.id, bc.id),
  ]);
  const knowledgeItems = [a, b, c];
  const claims = [ab, bc];
  const completed = progress([
    { bookId: "twok", chapter: 2 },
    { bookId: "edgedancer", chapter: 2 },
    { bookId: "dawnshard", chapter: 2 },
  ]);
  return { a, b, c, ab, bc, graph, knowledgeItems, claims, completed };
}

describe("Hoid knowledge graph queries and explanation planning", () => {
  it("finds a direct authorized path and returns metadata only", () => {
    const f = fixture();
    const result = queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.b.id },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].nodeIds).toEqual([f.a.id, f.b.id]);
    expect(JSON.stringify(result)).not.toContain(f.ab.text);
    expect(result.paths[0].edges[0].claimTextSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps graph traversal directed and does not infer inverse relations", () => {
    const f = fixture();
    const result = queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.b.id, toId: f.a.id },
    );
    expect(result.status).toBe("no-path");
  });

  it("finds a two-hop path in breadth-first order", () => {
    const f = fixture();
    const result = queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 2 },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.paths[0].nodeIds).toEqual([f.a.id, f.b.id, f.c.id]);
    expect(result.paths[0].edges.map(edge => edge.id)).toEqual([
      "synthetic.edge-ab", "synthetic.edge-bc",
    ]);
  });

  it("does not traverse a cycle by revisiting a node", () => {
    const f = fixture();
    const cycle = definition([
      relation("synthetic.edge-ab", f.a.id, f.b.id, f.ab.id),
      relation("synthetic.edge-ba", f.b.id, f.a.id, f.ab.id),
      relation("synthetic.edge-bc", f.b.id, f.c.id, f.bc.id),
    ]);
    const result = queryHoidKnowledgeGraph(
      cycle, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 4 },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.paths[0].nodeIds).toEqual([f.a.id, f.b.id, f.c.id]);
  });

  it("withholds a path when any evidence work is locked", () => {
    const f = fixture();
    const partial = progress([
      { bookId: "twok", chapter: 2 },
      { bookId: "edgedancer", chapter: 2 },
    ]);
    const result = queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, partial,
      { fromId: f.a.id, toId: f.c.id },
    );
    expect(result.status).toBe("no-path");
  });

  it("does not unlock the chapter currently open", () => {
    const f = fixture();
    const currentChapterOnly = progress([
      { bookId: "twok", chapter: 1 },
      { bookId: "edgedancer", chapter: 2 },
      { bookId: "dawnshard", chapter: 2 },
    ]);
    const result = queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, currentChapterOnly,
      { fromId: f.a.id, toId: f.b.id },
    );
    expect(result.status).toBe("no-path");
  });

  it("respects the maximum path depth", () => {
    const f = fixture();
    const result = queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 1 },
    );
    expect(result.status).toBe("no-path");
  });

  it("caps returned paths and marks the result as truncated only when another path exists", () => {
    const f = fixture();
    const alternateClaim = claim("synthetic.claim-ac", [f.a.id, f.c.id], "Afirmación sintética alternativa.");
    const branching = definition([
      relation("synthetic.edge-ab", f.a.id, f.b.id, f.ab.id),
      relation("synthetic.edge-bc", f.b.id, f.c.id, f.bc.id),
      relation("synthetic.edge-ac", f.a.id, f.c.id, alternateClaim.id),
    ]);
    const result = queryHoidKnowledgeGraph(
      branching, f.knowledgeItems, [...f.claims, alternateClaim], f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 3, maxPaths: 1 },
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.paths).toHaveLength(1);
      expect(result.truncated).toBe(true);
    }
  });

  it("rejects invalid query bounds and accessors without executing them", () => {
    const f = fixture();
    expect(queryHoidKnowledgeGraph(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 99 },
    )).toEqual({ status: "unavailable", reason: "invalid-query" });

    const query = { fromId: f.a.id, toId: f.c.id } as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(query, "maxDepth", {
      enumerable: true,
      get: () => { invoked = true; return 2; },
    });
    expect(queryHoidKnowledgeGraph(f.graph, f.knowledgeItems, f.claims, f.completed, query))
      .toEqual({ status: "unavailable", reason: "invalid-query" });
    expect(invoked).toBe(false);
  });

  it("creates a text-free explanation plan with exact source citations", () => {
    const f = fixture();
    const result = createHoidExplanationPlan(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 2 },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const serialized = JSON.stringify(result.plan);
    expect(serialized).not.toContain(f.ab.text);
    expect(serialized).not.toContain(f.bc.text);
    expect(result.plan.claims).toHaveLength(2);
    expect(result.plan.sources).toHaveLength(3);
    expect(result.plan.planId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("renders exact approved statements without adding provider-authored prose", () => {
    const f = fixture();
    const result = createHoidExplanationPlan(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 2 },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const rendered = renderHoidExplanationPlan(result.plan, f.claims, f.completed);
    expect(rendered.status).toBe("ready");
    if (rendered.status === "ready") {
      expect(rendered.text).toBe([f.ab.text, f.bc.text].join("\n\n"));
      expect(rendered.segments).toHaveLength(2);
      expect(rendered.sources).toHaveLength(3);
    }
  });

  it("rejects a substituted claim statement even when its ID and evidence set match", () => {
    const f = fixture();
    const result = createHoidExplanationPlan(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 2 },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const substituted = [
      { ...f.ab, text: "Afirmación falsa sustituida para la prueba." },
      f.bc,
    ];
    expect(renderHoidExplanationPlan(result.plan, substituted, f.completed))
      .toEqual({ status: "unavailable", reason: "invalid-claims" });
  });

  it("rejects a plan after progress changes even when the revision number is reused", () => {
    const f = fixture();
    const result = createHoidExplanationPlan(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 2 },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const changed = progress([
      { bookId: "twok", chapter: 3 },
      { bookId: "edgedancer", chapter: 2 },
      { bookId: "dawnshard", chapter: 2 },
    ]);
    expect(renderHoidExplanationPlan(result.plan, f.claims, changed))
      .toEqual({ status: "unavailable", reason: "stale-progress" });
  });

  it("rejects forged plans and malformed approved-claim registries", () => {
    const f = fixture();
    const result = createHoidExplanationPlan(
      f.graph, f.knowledgeItems, f.claims, f.completed,
      { fromId: f.a.id, toId: f.c.id, maxDepth: 2 },
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(renderHoidExplanationPlan({ ...result.plan }, f.claims, f.completed))
      .toEqual({ status: "unavailable", reason: "untrusted-plan" });
    expect(renderHoidExplanationPlan(result.plan, [null], f.completed))
      .toEqual({ status: "unavailable", reason: "invalid-claims" });
  });

  it("keeps the production query and renderer empty until source-controlled claims exist", () => {
    const f = fixture();
    expect(queryProductionHoidKnowledgeGraph(f.completed, {
      fromId: f.a.id, toId: f.b.id,
    }).status).toBe("no-path");
    expect(createProductionHoidExplanationPlan(f.completed, {
      fromId: f.a.id, toId: f.b.id,
    }).status).toBe("no-path");
    expect(renderProductionHoidExplanationPlan({}, f.completed))
      .toEqual({ status: "unavailable", reason: "untrusted-plan" });
  });
});
