import { describe, expect, it } from "vitest";
import {
  createHoidInvestigationContextPresenter,
  isHoidInvestigationContextPresenter,
} from "./investigationContextPresentation";
import {
  resolveHoidAuthorizedEntityAliasDisclosures,
  isHoidAuthorizedEntityAliasDisclosureResult,
} from "./entityResolver";
import {
  buildHoidAuthorizedKnowledgeGraph,
  type HoidKnowledgeGraphDefinition,
  type HoidKnowledgeGraphRelation,
  fingerprintHoidCursorProgressSnapshot,
} from "./knowledgeGraph";
import { createHoidInvestigationSession } from "./investigationSession";
import { createHoidApprovedClaimAttestation } from "./approvedClaimIntegrity";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import type { HoidAnswerBookScope } from "./answerScope";

const NOW = "2026-11-17T11:00:00.000Z";
const CROSS_SCOPE: HoidAnswerBookScope = Object.freeze({
  mode: "cross-work",
  bookIds: Object.freeze(["edgedancer", "twok"]),
});

function progress(positions: Array<{ bookId: string; chapter?: number; completed?: boolean }>) {
  const canonical = positions.map(position => {
    if (position.completed === true) return { bookId: position.bookId, completed: true as const };
    const cursor = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursor.status !== "ready") throw new Error("Cursor fixture unavailable");
    return { bookId: position.bookId, cursor: cursor.cursor };
  });
  return {
    schemaVersion: 2,
    revision: canonical.length === 0 ? 0 : 1,
    positions: canonical,
    updatedAt: canonical.length === 0 ? null : NOW,
  };
}

function identity(snapshot: unknown) {
  const result = fingerprintHoidCursorProgressSnapshot(snapshot);
  if (result.status !== "ready") throw new Error("Progress fixture unavailable");
  return result;
}

function knowledge(id: string, bookId: string, label: string, kind: HoidKnowledgeKind = "character") {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Manifest fixture unavailable");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Locator fixture unavailable");
  return {
    id,
    aliases: [label],
    kind,
    firstSafeAppearance: { bookId, chapter: 1 },
    evidenceSource: { bookId, chapter: 1, locatorId: unit.locatorId },
    evidenceUnlock: { bookId, chapter: 1 },
    summary: "Synthetic test summary; not a Cosmere fact.",
    provenance: "verified" as const,
  };
}

function aliasRecord(
  id: string,
  entityId: string,
  alias: string,
  bookId: string,
  unlockChapter = 1,
): HoidEntityAliasRecord {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Alias manifest fixture unavailable");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Alias locator fixture unavailable");
  return {
    id,
    entityId,
    alias,
    evidence: [{
      id: id + ".evidence",
      source: { bookId, chapter: 1, locatorId: unit.locatorId },
      unlock: { bookId, chapter: unlockChapter },
    }],
    review: {
      status: "approved",
      origin: "original-editorial",
      reviewerId: "synthetic-alias-reviewer",
      reviewedAt: NOW,
    },
  };
}

function approvedClaim(id: string, evidenceIds: string[], sourceKnowledge: readonly HoidKnowledgeEntry[]) {
  const core = { id, text: "Synthetic reviewed relation for tests.", intent: "context" as const, evidenceIds };
  const attestation = createHoidApprovedClaimAttestation(core, sourceKnowledge, {
    reviewerId: "synthetic-context-reviewer",
    reviewedAt: NOW,
  });
  if (attestation.status !== "valid") throw new Error("Synthetic attestation unavailable");
  return { ...core, integrity: attestation.integrity, review: attestation.review };
}

function relation(id: string, subjectId: string, objectId: string, claimId: string): HoidKnowledgeGraphRelation {
  return { id, subjectId, predicate: "uses", objectId, claimId };
}

function graphFor(a: HoidKnowledgeEntry, b: HoidKnowledgeEntry, snapshot: unknown) {
  const claim = approvedClaim("synthetic.claim-ab", [a.id, b.id], [a, b]);
  const definition: HoidKnowledgeGraphDefinition = {
    schemaVersion: 1,
    relations: [relation("synthetic.edge-ab", a.id, b.id, claim.id)],
  };
  const graph = buildHoidAuthorizedKnowledgeGraph(definition, [a, b], [claim], snapshot);
  if (graph.status !== "ready") throw new Error("Synthetic graph unavailable");
  return graph;
}

function historyFor(snapshot: unknown, subjects: readonly Readonly<{
  label: string;
  domain: "character-evolution" | "magic-system";
  topic: "knowledge" | "rule";
}>[]) {
  const current = identity(snapshot);
  const session = createHoidInvestigationSession();
  const ticket = session.begin();
  for (const subject of subjects) {
    if (!session.recordCompleted(ticket, {
      subjectLabel: subject.label,
      domain: subject.domain,
      topic: subject.topic,
      progressRevision: current.revision,
      progressFingerprint: current.sha256,
      bookScope: CROSS_SCOPE,
    })) throw new Error("History fixture rejected");
  }
  return session.getHistory();
}

function baseFixture() {
  const snapshot = progress([{ bookId: "twok", chapter: 2 }, { bookId: "edgedancer", chapter: 2 }]);
  const a = knowledge("synthetic.entity-a", "twok", "Entidad Alfa");
  const b = knowledge("synthetic.entity-b", "edgedancer", "Entidad Beta", "phenomenon");
  const graph = graphFor(a, b, snapshot);
  const history = historyFor(snapshot, [
    { label: "Entidad Alfa", domain: "character-evolution", topic: "knowledge" },
    { label: "Entidad Beta", domain: "magic-system", topic: "rule" },
  ]);
  const aliases = [
    aliasRecord("synthetic.alias-a", a.id, "Entidad Alfa", "twok"),
    aliasRecord("synthetic.alias-b", b.id, "Entidad Beta", "edgedancer"),
  ];
  return { snapshot, a, b, graph, history, aliases };
}

describe("Hoid spoiler-safe investigation context presentation", () => {
  it("presents only history-bound aliases with their independent disclosure sources", () => {
    const fixture = baseFixture();
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b],
      aliasEvidence: fixture.aliases,
      getCurrentProgress: () => fixture.snapshot,
    });
    expect(isHoidInvestigationContextPresenter(presenter)).toBe(true);
    const result = presenter!.present({
      graph: fixture.graph,
      history: fixture.history,
      bookScope: CROSS_SCOPE,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.links).toHaveLength(1);
    expect(result.links[0].leftLabel).toBe("Entidad Alfa");
    expect(result.links[0].rightLabel).toBe("Entidad Beta");
    expect(result.links[0].predicate).toBe("uses");
    expect(result.links[0].explanation).toContain("uso");
    expect(result.links[0].followUpQuestion).toContain("Entidad Alfa");
    expect(result.links[0].sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ bookId: "twok", chapter: 1, role: "relationship" }),
      expect.objectContaining({ bookId: "edgedancer", chapter: 1, role: "relationship" }),
      expect.objectContaining({ bookId: "twok", chapter: 1, role: "entity-label" }),
      expect.objectContaining({ bookId: "edgedancer", chapter: 1, role: "entity-label" }),
    ]));
  });

  it("withholds a relation when a history fingerprint belongs to an alias whose disclosure is still locked", () => {
    const fixture = baseFixture();
    const lockedAliases = [
      aliasRecord("synthetic.alias-a", fixture.a.id, "Entidad Alfa", "twok", 3),
      fixture.aliases[1],
    ];
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b],
      aliasEvidence: lockedAliases,
      getCurrentProgress: () => fixture.snapshot,
    });
    const result = presenter!.present({
      graph: fixture.graph,
      history: fixture.history,
      bookScope: CROSS_SCOPE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "locked-or-ambiguous-alias" });
  });

  it("does not disclose a label whose alias evidence falls outside the selected work scope", () => {
    const fixture = baseFixture();
    const outsideScope = [
      aliasRecord("synthetic.alias-a", fixture.a.id, "Entidad Alfa", "dawnshard"),
      fixture.aliases[1],
    ];
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b],
      aliasEvidence: outsideScope,
      getCurrentProgress: () => fixture.snapshot,
    });
    const result = presenter!.present({
      graph: fixture.graph,
      history: fixture.history,
      bookScope: CROSS_SCOPE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "locked-or-ambiguous-alias" });
  });

  it("withholds aliases shared by multiple currently disclosed entities", () => {
    const fixture = baseFixture();
    const duplicate = knowledge("synthetic.entity-c", "dawnshard", "Entidad Alfa");
    const expanded = progress([
      { bookId: "twok", chapter: 2 },
      { bookId: "edgedancer", chapter: 2 },
      { bookId: "dawnshard", chapter: 2 },
    ]);
    const expandedGraph = graphFor(fixture.a, fixture.b, expanded);
    const scope: HoidAnswerBookScope = {
      mode: "cross-work",
      bookIds: ["dawnshard", "edgedancer", "twok"],
    };
    const aliases = [
      aliasRecord("synthetic.alias-a", fixture.a.id, "Entidad Alfa", "twok"),
      aliasRecord("synthetic.alias-b", fixture.b.id, "Entidad Beta", "edgedancer"),
      aliasRecord("synthetic.alias-c", duplicate.id, "Entidad Alfa", "dawnshard"),
    ];
    const history = historyFor(expanded, [
      { label: "Entidad Alfa", domain: "character-evolution", topic: "knowledge" },
      { label: "Entidad Beta", domain: "magic-system", topic: "rule" },
    ]);
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b, duplicate],
      aliasEvidence: aliases,
      getCurrentProgress: () => expanded,
    });
    const result = presenter!.present({ graph: expandedGraph, history, bookScope: scope });
    expect(result).toEqual({ status: "unavailable", reason: "locked-or-ambiguous-alias" });
  });

  it("invalidates the presentation if progress changes during resolution", () => {
    const fixture = baseFixture();
    const changed = progress([{ bookId: "twok", chapter: 3 }, { bookId: "edgedancer", chapter: 2 }]);
    let calls = 0;
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b],
      aliasEvidence: fixture.aliases,
      getCurrentProgress: () => {
        calls += 1;
        return calls === 1 ? fixture.snapshot : changed;
      },
    });
    const result = presenter!.present({
      graph: fixture.graph,
      history: fixture.history,
      bookScope: CROSS_SCOPE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "stale-progress" });
  });

  it("does not accept a provider-shaped or serialized disclosure result as an authorization", () => {
    const fixture = baseFixture();
    const result = resolveHoidAuthorizedEntityAliasDisclosures(
      [fixture.a, fixture.b],
      fixture.aliases,
      fixture.snapshot,
      [fixture.a.id, fixture.b.id],
      CROSS_SCOPE,
    );
    expect(isHoidAuthorizedEntityAliasDisclosureResult(result)).toBe(true);
    expect(isHoidAuthorizedEntityAliasDisclosureResult(JSON.parse(JSON.stringify(result)))).toBe(false);
  });

  it("does not expose entity IDs, alias evidence IDs, locators or claim prose", () => {
    const fixture = baseFixture();
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b],
      aliasEvidence: fixture.aliases,
      getCurrentProgress: () => fixture.snapshot,
    });
    const result = presenter!.present({
      graph: fixture.graph,
      history: fixture.history,
      bookScope: CROSS_SCOPE,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(fixture.a.id);
    expect(serialized).not.toContain(fixture.b.id);
    expect(serialized).not.toContain("synthetic.alias-a");
    expect(serialized).not.toContain("synthetic.alias-b");
    expect(serialized).not.toContain("synthetic.edge-ab");
    expect(serialized).not.toContain("synthetic.claim-ab");
  });

  it("rejects malformed requests and malformed history without partial presentation", () => {
    const fixture = baseFixture();
    const presenter = createHoidInvestigationContextPresenter({
      knowledge: [fixture.a, fixture.b],
      aliasEvidence: fixture.aliases,
      getCurrentProgress: () => fixture.snapshot,
    });
    expect(presenter!.present({ graph: fixture.graph, history: fixture.history })).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
    expect(presenter!.present({
      graph: fixture.graph,
      history: [{ ...fixture.history[0], extra: true }],
      bookScope: CROSS_SCOPE,
    })).toEqual({ status: "unavailable", reason: "invalid-history" });
  });
});
