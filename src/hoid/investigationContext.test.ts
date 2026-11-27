import { describe, expect, it } from "vitest";
import { buildHoidAuthorizedKnowledgeGraph, buildProductionHoidAuthorizedKnowledgeGraph, fingerprintHoidCursorProgressSnapshot, type HoidKnowledgeGraphDefinition, type HoidKnowledgeGraphRelation } from "./knowledgeGraph";
import { createHoidInvestigationSession } from "./investigationSession";
import { planHoidInvestigationContext } from "./investigationContext";
import { fingerprintHoidInvestigationScope, fingerprintHoidInvestigationSubject } from "./investigationIdentity";
import type { HoidAnswerBookScope } from "./answerScope";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { createHoidApprovedClaimAttestation } from "./approvedClaimIntegrity";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import { sha256Hex } from "./sha256";

const NOW = "2026-11-17T11:00:00.000Z";
const CROSS_SCOPE: HoidAnswerBookScope = Object.freeze({ mode: "cross-work", bookIds: Object.freeze(["edgedancer", "twok"]) });
const SINGLE_SCOPE: HoidAnswerBookScope = Object.freeze({ mode: "single-work", bookIds: Object.freeze(["twok"]) });

function progress(positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>) {
  const canonical = positions.map(position => {
    if (position.completed === true) return { bookId: position.bookId, completed: true as const };
    const cursor = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursor.status !== "ready") throw new Error("Cursor fixture unavailable");
    return { bookId: position.bookId, cursor: cursor.cursor };
  });
  return { schemaVersion: 2, revision: canonical.length === 0 ? 0 : 1, positions: canonical, updatedAt: canonical.length === 0 ? null : NOW };
}
function identity(snapshot: unknown) {
  const result = fingerprintHoidCursorProgressSnapshot(snapshot);
  if (result.status !== "ready") throw new Error("Progress fixture unavailable");
  return result;
}
function knowledge(id: string, bookId: string, aliases: string[], kind: HoidKnowledgeKind = "character") {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifest fixture unavailable");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Locator fixture unavailable");
  return {
    id, aliases, kind,
    firstSafeAppearance: { bookId, chapter: 1 },
    evidenceSource: { bookId, chapter: 1, locatorId: unit.locatorId },
    evidenceUnlock: { bookId, chapter: 1 },
    summary: "Synthetic test summary; not a Cosmere fact.",
    provenance: "verified" as const,
  };
}
function approvedClaim(id: string, evidenceIds: string[], sourceKnowledge: readonly HoidKnowledgeEntry[]) {
  const core = { id, text: "Synthetic reviewed relation for tests.", intent: "context" as const, evidenceIds };
  const attestation = createHoidApprovedClaimAttestation(core, sourceKnowledge, {
    reviewerId: "synthetic-context-reviewer", reviewedAt: NOW,
  });
  if (attestation.status !== "valid") throw new Error("Synthetic attestation unavailable");
  return { ...core, integrity: attestation.integrity, review: attestation.review };
}
function relation(id: string, subjectId: string, objectId: string, claimId: string): HoidKnowledgeGraphRelation {
  return { id, subjectId, predicate: "related-to", objectId, claimId };
}
function definition(relations: readonly HoidKnowledgeGraphRelation[]): HoidKnowledgeGraphDefinition {
  return { schemaVersion: 1, relations };
}
function historyFor(snapshot: unknown, scope: HoidAnswerBookScope, subjects: readonly Readonly<{
  label: string; domain: "character-evolution" | "magic-system"; topic: "knowledge" | "rule";
}>[]) {
  const current = identity(snapshot);
  const session = createHoidInvestigationSession();
  const ticket = session.begin();
  for (const subject of subjects) {
    if (!session.recordCompleted(ticket, {
      subjectLabel: subject.label, domain: subject.domain, topic: subject.topic,
      progressRevision: current.revision, progressFingerprint: current.sha256, bookScope: scope,
    })) throw new Error("History fixture rejected");
  }
  return session.getHistory();
}
function plan(graph: unknown, history: unknown, snapshot: unknown, scope: unknown) {
  const current = identity(snapshot);
  return planHoidInvestigationContext({
    graph, history, progressRevision: current.revision, progressFingerprint: current.sha256, bookScope: scope,
  });
}

describe("Hoid evidence-linked investigation context", () => {
  const snapshot = progress([{ bookId: "twok", chapter: 2 }, { bookId: "edgedancer", chapter: 2 }]);
  const a = knowledge("synthetic.character-a", "twok", ["Personaje Alfa"]);
  const b = knowledge("synthetic.magic-b", "edgedancer", ["Sistema Beta"], "phenomenon");
  const approved = approvedClaim("synthetic.shared-claim", [a.id, b.id], [a, b]);
  const graph = buildHoidAuthorizedKnowledgeGraph(
    definition([relation("synthetic.edge-a-b", a.id, b.id, approved.id)]), [a, b], [approved], snapshot,
  );
  const history = historyFor(snapshot, CROSS_SCOPE, [
    { label: "Personaje Alfa", domain: "character-evolution", topic: "knowledge" },
    { label: "Sistema Beta", domain: "magic-system", topic: "rule" },
  ]);

  it("links two researched subjects only through a reviewed, unlocked graph edge", () => {
    const result = plan(graph, history, snapshot, CROSS_SCOPE);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.links).toHaveLength(1);
    expect(result.links[0].leftNodeFingerprint).toBe(sha256Hex(a.id));
    expect(result.links[0].rightNodeFingerprint).toBe(sha256Hex(b.id));
    expect(result.links[0].predicate).toBe("related-to");
    expect(result.links[0].leftInvestigations).toEqual([{ domain: "character-evolution", topic: "knowledge" }]);
    expect(result.links[0].rightInvestigations).toEqual([{ domain: "magic-system", topic: "rule" }]);
    expect(result.links[0].sources).toEqual([
      { sourceBookId: "edgedancer", chapter: 1 }, { sourceBookId: "twok", chapter: 1 },
    ]);
  });

  it("does not infer links from co-occurrence or history alone", () => {
    const empty = buildProductionHoidAuthorizedKnowledgeGraph(snapshot);
    expect(plan(empty, history, snapshot, CROSS_SCOPE)).toEqual(expect.objectContaining({ status: "ready", links: [] }));
  });

  it("requires completed history for both endpoints", () => {
    const onlyLeft = historyFor(snapshot, CROSS_SCOPE, [
      { label: "Personaje Alfa", domain: "character-evolution", topic: "knowledge" },
    ]);
    expect(plan(graph, onlyLeft, snapshot, CROSS_SCOPE)).toEqual(expect.objectContaining({ status: "ready", links: [] }));
  });

  it("withholds cross-work evidence outside the selected single-work scope", () => {
    const singleHistory = historyFor(snapshot, SINGLE_SCOPE, [
      { label: "Personaje Alfa", domain: "character-evolution", topic: "knowledge" },
      { label: "Sistema Beta", domain: "magic-system", topic: "rule" },
    ]);
    expect(plan(graph, singleHistory, snapshot, SINGLE_SCOPE)).toEqual(expect.objectContaining({ status: "ready", links: [] }));
  });

  it("rejects a graph built for another progress revision", () => {
    const current = identity(snapshot);
    expect(planHoidInvestigationContext({
      graph, history, progressRevision: current.revision + 1,
      progressFingerprint: current.sha256, bookScope: CROSS_SCOPE,
    })).toEqual({ status: "unavailable", reason: "progress-mismatch" });
  });

  it("rejects serialized or provider-supplied graph-shaped data", () => {
    expect(plan(JSON.parse(JSON.stringify(graph)), history, snapshot, CROSS_SCOPE))
      .toEqual({ status: "unavailable", reason: "invalid-graph" });
  });

  it("withholds ambiguous alias-to-node matches", () => {
    const c = knowledge("synthetic.character-c", "dawnshard", ["Personaje Alfa"]);
    const expanded = progress([
      { bookId: "twok", chapter: 2 }, { bookId: "edgedancer", chapter: 2 }, { bookId: "dawnshard", chapter: 2 },
    ]);
    const expandedA = knowledge("synthetic.character-a", "twok", ["Personaje Alfa"]);
    const expandedB = knowledge("synthetic.magic-b", "edgedancer", ["Sistema Beta"], "phenomenon");
    const claim = approvedClaim("synthetic.ambiguous-claim", [expandedA.id, expandedB.id, c.id], [expandedA, expandedB, c]);
    const expandedGraph = buildHoidAuthorizedKnowledgeGraph(definition([
      relation("synthetic.edge-a-b", expandedA.id, expandedB.id, claim.id),
      relation("synthetic.edge-c-b", c.id, expandedB.id, claim.id),
    ]), [expandedA, expandedB, c], [claim], expanded);
    const scope: HoidAnswerBookScope = Object.freeze({
      mode: "cross-work", bookIds: Object.freeze(["dawnshard", "edgedancer", "twok"]),
    });
    const expandedHistory = historyFor(expanded, scope, [
      { label: "Personaje Alfa", domain: "character-evolution", topic: "knowledge" },
      { label: "Sistema Beta", domain: "magic-system", topic: "rule" },
    ]);
    expect(plan(expandedGraph, expandedHistory, expanded, scope))
      .toEqual(expect.objectContaining({ status: "ready", links: [] }));
  });

  it("returns chapter metadata and fingerprints, never claim prose, evidence IDs, locators or raw aliases", () => {
    const result = plan(graph, history, snapshot, CROSS_SCOPE);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(approved.text);
    expect(serialized).not.toContain(a.aliases[0]);
    expect(serialized).not.toContain(b.aliases[0]);
    expect(serialized).not.toContain(a.id);
    expect(serialized).not.toContain(b.id);
    if (result.status === "ready") {
      expect(result.links[0].linkFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(serialized).not.toContain("synthetic.edge-a-b");
    }
  });

  it("shares the exact subject and scope fingerprints used by the session ledger", () => {
    const current = identity(snapshot);
    expect(fingerprintHoidInvestigationScope(current.revision, current.sha256, CROSS_SCOPE))
      .toBe(history[0].scopeFingerprint);
    expect(fingerprintHoidInvestigationSubject("PERSONAJE ÁLFA")).toBe(history[0].subjectFingerprint);
  });

  it("rejects malformed history without partially planning", () => {
    expect(plan(graph, [{ ...history[0], extra: true }], snapshot, CROSS_SCOPE))
      .toEqual({ status: "unavailable", reason: "invalid-history" });
  });
});
