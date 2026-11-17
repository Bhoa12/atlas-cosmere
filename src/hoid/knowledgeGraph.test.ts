import { describe, expect, it } from "vitest";
import {
  buildHoidAuthorizedKnowledgeGraph,
  buildProductionHoidAuthorizedKnowledgeGraph,
  fingerprintHoidCursorProgressSnapshot,
  HOID_KNOWLEDGE_GRAPH_DEFINITION,
  type HoidKnowledgeGraphDefinition,
  type HoidKnowledgeGraphRelation,
} from "./knowledgeGraph";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-17T11:00:00.000Z";

function progress(
  positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>,
) {
  const canonical = positions.map(position => {
    if (position.completed === true) {
      return { bookId: position.bookId, completed: true as const };
    }
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

function progressFingerprint(snapshot: unknown): string {
  const result = fingerprintHoidCursorProgressSnapshot(snapshot);
  if (result.status !== "ready") throw new Error("Fingerprint de fixture no disponible");
  return result.sha256;
}

function knowledge(
  id: string,
  bookId: string,
  unlockChapter = 1,
  provenance: "verified" | "limited" | "unavailable" = "verified",
) {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifiesto de fixture no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Localizador de fixture no disponible");
  return {
    id,
    aliases: ["alias-" + id],
    kind: "character" as const,
    firstSafeAppearance: { bookId, chapter: 1 },
    evidenceSource: { bookId, chapter: 1, locatorId: unit.locatorId },
    evidenceUnlock: { bookId, chapter: unlockChapter },
    summary: "Resumen sintético privado de prueba; no representa un hecho del Cosmere.",
    provenance,
  };
}

function approvedClaim(id: string, evidenceIds: string[]) {
  return {
    id,
    text: "Relación sintética de prueba entre entidades ficticias.",
    intent: "context" as const,
    evidenceIds,
    review: {
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "synthetic-test-reviewer",
      reviewedAt: NOW,
    },
  };
}

function relation(
  id: string,
  subjectId: string,
  objectId: string,
  claimId: string,
): HoidKnowledgeGraphRelation {
  return { id, subjectId, predicate: "related-to", objectId, claimId };
}

function definition(relations: readonly HoidKnowledgeGraphRelation[]): HoidKnowledgeGraphDefinition {
  return { schemaVersion: 1, relations };
}

describe("Hoid authorized knowledge graph", () => {
  it("binds the production graph to the currently empty editorial registry", () => {
    expect(buildProductionHoidAuthorizedKnowledgeGraph(progress([]))).toEqual({
      status: "ready",
      progressRevision: 0,
      progressFingerprint: progressFingerprint(progress([])),
      nodes: [],
      edges: [],
    });
  });

  it("keeps the production graph empty until reviewed relations are added", () => {
    const result = buildHoidAuthorizedKnowledgeGraph(
      HOID_KNOWLEDGE_GRAPH_DEFINITION,
      [],
      [],
      progress([]),
    );
    expect(result).toEqual({
      status: "ready",
      progressRevision: 0,
      progressFingerprint: progressFingerprint(progress([])),
      nodes: [],
      edges: [],
    });
  });

  it("emits a relation only when both endpoints and all evidence are authorized", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.edges).toHaveLength(1);
    expect(result.nodes.map(node => node.id)).toEqual([a.id, b.id]);
    expect(result.edges[0].sources).toHaveLength(2);
    expect(result.edges[0].sources.map(source => source.documentSha256)).toHaveLength(2);
  });

  it("withholds the complete cross-work edge when one source is still locked", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([{ bookId: "twok", chapter: 2 }]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.edges).toEqual([]);
    expect(result.nodes).toEqual([]);
  });

  it("does not unlock evidence from the chapter currently open", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", chapter: 1 },
        { bookId: "edgedancer", chapter: 1 },
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.edges).toEqual([]);
    expect(result.nodes).toEqual([]);
  });

  it("respects a later evidence-unlock threshold independently of its source chapter", () => {
    const a = knowledge("synthetic.entity-a", "twok", 2);
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const before = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    const after = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", chapter: 3 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    expect(before.status).toBe("ready");
    if (before.status === "ready") expect(before.edges).toEqual([]);
    expect(after.status).toBe("ready");
    if (after.status === "ready") expect(after.edges).toHaveLength(1);
  });

  it("requires every supporting evidence ID, including non-endpoint evidence", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const support = knowledge("synthetic.support-c", "dawnshard");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id, support.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b, support],
      [claim],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.edges).toEqual([]);
      expect(result.nodes).toEqual([]);
    }
  });

  it("allows an explicit whole-work completion to satisfy that work's evidence", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", completed: true },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.edges).toHaveLength(1);
  });

  it("does not expose claim prose, summaries or aliases in graph results", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(claim.text);
    expect(serialized).not.toContain(a.summary);
    expect(serialized).not.toContain(a.aliases[0]);
  });

  it("rejects a knowledge node whose source chapter has not been inspected", () => {
    const manifest = getHoidReadingManifest("twok");
    if (manifest.status !== "ready") throw new Error("Manifiesto no disponible");
    const unit = manifest.manifest.units.find(item => item.chapterNumber === 2);
    if (!unit?.locatorId) throw new Error("Localizador no disponible");
    const uninspected = {
      ...knowledge("synthetic.uninspected", "twok"),
      evidenceSource: { bookId: "twok", chapter: 2, locatorId: unit.locatorId },
      firstSafeAppearance: { bookId: "twok", chapter: 2 },
    };
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([]),
      [uninspected],
      [],
      progress([]),
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });

  it("rejects knowledge that is not explicitly marked as verified", () => {
    const limited = knowledge("synthetic.limited", "twok", 1, "limited");
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([]),
      [limited],
      [],
      progress([]),
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
  });


  it("rejects control characters in summaries and approved claim statements", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const invalidSummary = {
      ...a,
      summary: "Resumen con control" + String.fromCharCode(0) + "incrustado.",
    };
    const badKnowledge = buildHoidAuthorizedKnowledgeGraph(
      definition([]),
      [invalidSummary, b],
      [claim],
      progress([]),
    );
    const invalidClaim = {
      ...claim,
      text: "Afirmación con control" + String.fromCharCode(0) + "incrustado.",
    };
    const badClaim = buildHoidAuthorizedKnowledgeGraph(
      definition([]),
      [a, b],
      [invalidClaim],
      progress([]),
    );
    expect(badKnowledge).toEqual({ status: "unavailable", reason: "invalid-knowledge" });
    expect(badClaim).toEqual({ status: "unavailable", reason: "invalid-claims" });
  });

  it("rejects a relation whose endpoints are not both cited by its approved claim", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([]),
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-claims" });
  });

  it("rejects unknown claims and duplicate relation identities", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const unknown = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, "synthetic.missing-claim")]),
      [a, b],
      [claim],
      progress([]),
    );
    const duplicate = buildHoidAuthorizedKnowledgeGraph(
      definition([
        relation("synthetic.edge-ab", a.id, b.id, claim.id),
        relation("synthetic.edge-ab", a.id, b.id, claim.id),
      ]),
      [a, b],
      [claim],
      progress([]),
    );
    expect(unknown).toEqual({ status: "unavailable", reason: "invalid-definition" });
    expect(duplicate).toEqual({ status: "unavailable", reason: "invalid-definition" });
  });

  it("rejects a malformed progress snapshot as a whole", () => {
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([]),
      [],
      [],
      { schemaVersion: 2, revision: 1, positions: [], updatedAt: null },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects accessors without executing them", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const raw = {
      schemaVersion: 1,
      relations: [relation("synthetic.edge-ab", a.id, b.id, claim.id)],
    } as Record<string, unknown>;
    let invoked = false;
    Object.defineProperty(raw, "relations", {
      enumerable: true,
      get: () => {
        invoked = true;
        return [];
      },
    });
    const result = buildHoidAuthorizedKnowledgeGraph(raw, [a, b], [claim], progress([]));
    expect(result).toEqual({ status: "unavailable", reason: "invalid-definition" });
    expect(invoked).toBe(false);
  });

  it("orders visible nodes and edges deterministically", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const c = knowledge("synthetic.entity-c", "dawnshard");
    const claimOne = approvedClaim("synthetic.claim-one", [a.id, b.id]);
    const claimTwo = approvedClaim("synthetic.claim-two", [a.id, c.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([
        relation("synthetic.edge-z", a.id, c.id, claimTwo.id),
        relation("synthetic.edge-a", a.id, b.id, claimOne.id),
      ]),
      [c, b, a],
      [claimTwo, claimOne],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
        { bookId: "dawnshard", chapter: 2 },
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.nodes.map(node => node.id)).toEqual([a.id, b.id, c.id]);
    expect(result.edges.map(edge => edge.id)).toEqual(["synthetic.edge-a", "synthetic.edge-z"]);
  });

  it("does not call or accept a provider as part of graph construction", () => {
    const a = knowledge("synthetic.entity-a", "twok");
    const b = knowledge("synthetic.entity-b", "edgedancer");
    const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id]);
    const result = buildHoidAuthorizedKnowledgeGraph(
      definition([relation("synthetic.edge-ab", a.id, b.id, claim.id)]),
      [a, b],
      [claim],
      progress([
        { bookId: "twok", chapter: 2 },
        { bookId: "edgedancer", chapter: 2 },
      ]),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.edges).toHaveLength(1);
  });
});
