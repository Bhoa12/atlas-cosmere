import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
  type HoidApprovedClaimIntent,
} from "./approvedClaimIntegrity";
import {
  createHoidNarrativeTemporalChronologyAdapter,
  createHoidNarrativeTemporalRelationIndex,
} from "./narrativeTemporalRelations";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-27T03:00:00.000Z";
const SINGLE_TFE = Object.freeze({
  mode: "single-work" as const,
  bookIds: Object.freeze(["tfe"]),
});
const CROSS_TFE_TWOK = Object.freeze({
  mode: "cross-work" as const,
  bookIds: Object.freeze(["tfe", "twok"]),
});

function makeEntry(
  id: string,
  alias: string,
  bookId: string,
  chapter: number,
  kind: HoidKnowledgeKind = "event",
  unlockChapter = chapter,
): HoidKnowledgeEntry {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Expected a verified fixture manifest");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Expected an edition-bound fixture locator");
  return Object.freeze({
    id,
    aliases: Object.freeze([alias]) as unknown as string[],
    kind,
    firstSafeAppearance: Object.freeze({ bookId, chapter }),
    evidenceSource: Object.freeze({ bookId, chapter, locatorId: unit.locatorId }),
    evidenceUnlock: Object.freeze({ bookId, chapter: unlockChapter }),
    summary: "Original synthetic editorial summary for " + alias + ".",
    provenance: "verified" as const,
  });
}

function approvedClaim(
  id: string,
  text: string,
  knowledge: readonly HoidKnowledgeEntry[],
  evidenceIds: readonly string[],
  eventIds: readonly string[],
  intent: HoidApprovedClaimIntent = "explain",
): HoidApprovedClaim {
  const core = Object.freeze({
    id,
    text,
    intent,
    evidenceIds: Object.freeze([...evidenceIds]),
    entityIds: Object.freeze([...eventIds]),
  });
  const attestation = createHoidApprovedClaimAttestation(core, knowledge, {
    reviewerId: "reviewer.alpha",
    reviewedAt: NOW,
  });
  if (attestation.status !== "valid") {
    throw new Error("Expected a valid synthetic temporal attestation: " + attestation.reason);
  }
  return Object.freeze({
    ...core,
    integrity: attestation.integrity,
    review: attestation.review,
  });
}

function relation(
  id: string,
  earlierEventId: string,
  laterEventId: string,
  claimId: string,
) {
  return Object.freeze({
    id,
    relation: "precedes" as const,
    earlierEventId,
    laterEventId,
    claimId,
  });
}

function progressSnapshot(
  tfeCursor = 8,
  twokCursor = 8,
  revision = 1,
) {
  const tfe = createHoidReadingCursor("tfe", tfeCursor);
  const twok = createHoidReadingCursor("twok", twokCursor);
  if (tfe.status !== "ready" || twok.status !== "ready") {
    throw new Error("Expected verified fixture cursors");
  }
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId: "tfe", cursor: tfe.cursor }),
      Object.freeze({ bookId: "twok", cursor: twok.cursor }),
    ]),
    updatedAt: NOW,
  });
}

function simpleGraph(options: Readonly<{
  relationUnlock?: number;
  relationIntent?: HoidApprovedClaimIntent;
  eventKind?: HoidKnowledgeKind;
  evidenceIds?: readonly string[];
}> = {}) {
  const knowledge = Object.freeze([
    makeEntry("event.alpha", "Evento Alfa", "tfe", 1, options.eventKind ?? "event"),
    makeEntry("event.beta", "Evento Beta", "tfe", 2),
    makeEntry("evidence.alpha-beta", "Evidencia Alfa Beta", "tfe", 3, "concept", options.relationUnlock ?? 3),
  ]);
  const claim = approvedClaim(
    "claim.alpha-beta",
    "Acontecimiento Alfa precede al acontecimiento Beta (texto sintético).",
    knowledge,
    options.evidenceIds ?? ["event.alpha", "event.beta", "evidence.alpha-beta"],
    ["event.alpha", "event.beta"],
    options.relationIntent ?? "explain",
  );
  return createHoidNarrativeTemporalRelationIndex({
    knowledge,
    claims: Object.freeze([claim]),
    relations: Object.freeze([relation("relation.alpha-beta", "event.alpha", "event.beta", claim.id)]),
  });
}

describe("Hoid reviewed narrative temporal partial order", () => {
  it("builds a deterministic partial order only from approved event relations", () => {
    const index = simpleGraph();
    expect(index).not.toBeNull();
    const result = index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(),
      bookScope: SINGLE_TFE,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.semantics).toBe("editorial-partial-order");
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].earlierEventId).toBe("event.alpha");
    expect(result.relations[0].laterEventId).toBe("event.beta");
    expect(result.layers.map(layer => layer.events.map(event => event.eventId))).toEqual([
      ["event.alpha"],
      ["event.beta"],
    ]);
  });

  it("keeps incomparable events unordered within the same topological layer", () => {
    const knowledge = Object.freeze([
      makeEntry("event.alpha", "Evento Alfa", "tfe", 1),
      makeEntry("event.beta", "Evento Beta", "tfe", 2),
      makeEntry("event.gamma", "Evento Gamma", "tfe", 3),
      makeEntry("evidence.alpha-gamma", "Evidencia Alfa Gamma", "tfe", 4, "concept"),
      makeEntry("evidence.beta-gamma", "Evidencia Beta Gamma", "tfe", 5, "concept"),
    ]);
    const first = approvedClaim(
      "claim.alpha-gamma",
      "Alfa precede a Gamma (texto sintético).",
      knowledge,
      ["event.alpha", "event.gamma", "evidence.alpha-gamma"],
      ["event.alpha", "event.gamma"],
    );
    const second = approvedClaim(
      "claim.beta-gamma",
      "Beta precede a Gamma (texto sintético).",
      knowledge,
      ["event.beta", "event.gamma", "evidence.beta-gamma"],
      ["event.beta", "event.gamma"],
    );
    const index = createHoidNarrativeTemporalRelationIndex({
      knowledge,
      claims: Object.freeze([first, second]),
      relations: Object.freeze([
        relation("relation.alpha-gamma", "event.alpha", "event.gamma", first.id),
        relation("relation.beta-gamma", "event.beta", "event.gamma", second.id),
      ]),
    });
    expect(index).not.toBeNull();
    const result = index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(),
      bookScope: SINGLE_TFE,
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.layers.map(layer => layer.events.map(event => event.eventId))).toEqual([
      ["event.alpha", "event.beta"],
      ["event.gamma"],
    ]);
    expect(result.layers[0].withinLayer).toBe("unordered");
  });

  it("rejects a cyclic temporal graph", () => {
    const knowledge = Object.freeze([
      makeEntry("event.alpha", "Evento Alfa", "tfe", 1),
      makeEntry("event.beta", "Evento Beta", "tfe", 2),
      makeEntry("evidence.alpha-beta", "Evidencia Alfa Beta", "tfe", 3, "concept"),
      makeEntry("evidence.beta-alpha", "Evidencia Beta Alfa", "tfe", 4, "concept"),
    ]);
    const forward = approvedClaim(
      "claim.alpha-beta",
      "Alfa precede a Beta (texto sintético).",
      knowledge,
      ["event.alpha", "event.beta", "evidence.alpha-beta"],
      ["event.alpha", "event.beta"],
    );
    const reverse = approvedClaim(
      "claim.beta-alpha",
      "Beta precede a Alfa (texto sintético).",
      knowledge,
      ["event.alpha", "event.beta", "evidence.beta-alpha"],
      ["event.alpha", "event.beta"],
    );
    expect(createHoidNarrativeTemporalRelationIndex({
      knowledge,
      claims: Object.freeze([forward, reverse]),
      relations: Object.freeze([
        relation("relation.alpha-beta", "event.alpha", "event.beta", forward.id),
        relation("relation.beta-alpha", "event.beta", "event.alpha", reverse.id),
      ]),
    })).toBeNull();
  });

  it("rejects self edges, duplicate edges and duplicate relation identifiers", () => {
    const index = simpleGraph();
    expect(index).not.toBeNull();
    const knowledge = Object.freeze([
      makeEntry("event.alpha", "Evento Alfa", "tfe", 1),
      makeEntry("evidence.alpha", "Evidencia Alfa", "tfe", 2, "concept"),
    ]);
    const selfClaim = approvedClaim(
      "claim.self",
      "Relación sintética inválida.",
      knowledge,
      ["event.alpha", "evidence.alpha"],
      ["event.alpha"],
    );
    expect(createHoidNarrativeTemporalRelationIndex({
      knowledge,
      claims: Object.freeze([selfClaim]),
      relations: Object.freeze([relation("relation.self", "event.alpha", "event.alpha", selfClaim.id)]),
    })).toBeNull();
    expect(createHoidNarrativeTemporalRelationIndex({
      knowledge: Object.freeze([
        makeEntry("event.alpha", "Evento Alfa", "tfe", 1),
        makeEntry("event.beta", "Evento Beta", "tfe", 2),
        makeEntry("evidence.alpha-beta", "Evidencia Alfa Beta", "tfe", 3, "concept"),
      ]),
      claims: Object.freeze([approvedClaim(
        "claim.alpha-beta",
        "Alfa precede a Beta.",
        [
          makeEntry("event.alpha", "Evento Alfa", "tfe", 1),
          makeEntry("event.beta", "Evento Beta", "tfe", 2),
          makeEntry("evidence.alpha-beta", "Evidencia Alfa Beta", "tfe", 3, "concept"),
        ],
        ["event.alpha", "event.beta", "evidence.alpha-beta"],
        ["event.alpha", "event.beta"],
      )]),
      relations: Object.freeze([
        relation("relation.same", "event.alpha", "event.beta", "claim.alpha-beta"),
        relation("relation.same", "event.alpha", "event.beta", "claim.alpha-beta"),
      ]),
    })).toBeNull();
  });

  it("requires event-kind endpoints and an independently evidenced relation claim", () => {
    expect(simpleGraph({ eventKind: "character" })).toBeNull();
    expect(simpleGraph({ evidenceIds: ["event.alpha", "event.beta"] })).toBeNull();
    expect(simpleGraph({ relationIntent: "recommend" })).toBeNull();
  });

  it("withholds a relation until every source unlock watermark is complete", () => {
    const index = simpleGraph({ relationUnlock: 3 });
    expect(index).not.toBeNull();
    const locked = index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(3),
      bookScope: SINGLE_TFE,
    });
    expect(locked).toEqual({ status: "not-found" });
    const unlocked = index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(4),
      bookScope: SINGLE_TFE,
    });
    expect(unlocked.status).toBe("ready");
  });

  it("requires every cross-work source to be inside the selected scope", () => {
    const knowledge = Object.freeze([
      makeEntry("event.alpha", "Evento Alfa", "tfe", 1),
      makeEntry("event.beta", "Evento Beta", "twok", 1),
      makeEntry("evidence.alpha-beta", "Evidencia Alfa Beta", "tfe", 2, "concept"),
    ]);
    const claim = approvedClaim(
      "claim.alpha-beta",
      "Alfa precede a Beta (texto sintético).",
      knowledge,
      ["event.alpha", "event.beta", "evidence.alpha-beta"],
      ["event.alpha", "event.beta"],
    );
    const index = createHoidNarrativeTemporalRelationIndex({
      knowledge,
      claims: Object.freeze([claim]),
      relations: Object.freeze([relation("relation.alpha-beta", "event.alpha", "event.beta", claim.id)]),
    });
    expect(index).not.toBeNull();
    expect(index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(),
      bookScope: SINGLE_TFE,
    })).toEqual({ status: "not-found" });
    expect(index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(),
      bookScope: CROSS_TFE_TWOK,
    }).status).toBe("ready");
  });

  it("fails closed on malformed scopes and progress snapshots", () => {
    const index = simpleGraph();
    expect(index).not.toBeNull();
    expect(index!.getAuthorizedPartialOrder({
      progress: {},
      bookScope: SINGLE_TFE,
    })).toEqual({ status: "unavailable", reason: "invalid-progress" });
    expect(index!.getAuthorizedPartialOrder({
      progress: progressSnapshot(),
      bookScope: { mode: "single-work", bookIds: ["unknown-work"] },
    })).toEqual({ status: "unavailable", reason: "invalid-scope" });
  });

  it("rejects a provider-bearing or unbranded adapter configuration", () => {
    const index = simpleGraph();
    expect(index).not.toBeNull();
    expect(createHoidNarrativeTemporalChronologyAdapter({
      index: {},
      refreshCurrentProgress: () => progressSnapshot(),
    })).toBeNull();
    expect(createHoidNarrativeTemporalChronologyAdapter({
      index,
      refreshCurrentProgress: () => progressSnapshot(),
      provider: "external",
    })).toBeNull();
  });

  it("discards the result if durable progress changes during retrieval", async () => {
    const index = simpleGraph();
    expect(index).not.toBeNull();
    let refreshes = 0;
    const adapter = createHoidNarrativeTemporalChronologyAdapter({
      index,
      refreshCurrentProgress: () => {
        refreshes += 1;
        return progressSnapshot(8, 8, refreshes === 1 ? 1 : 2);
      },
    });
    expect(adapter).not.toBeNull();
    const result = await adapter!.build({
      progress: progressSnapshot(8, 8, 1),
      bookScope: SINGLE_TFE,
    });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
  });

  it("honours cancellation before reading the temporal index", async () => {
    const index = simpleGraph();
    expect(index).not.toBeNull();
    const adapter = createHoidNarrativeTemporalChronologyAdapter({
      index,
      refreshCurrentProgress: () => progressSnapshot(),
    });
    expect(adapter).not.toBeNull();
    const controller = new AbortController();
    controller.abort();
    const result = await adapter!.build({
      progress: progressSnapshot(),
      bookScope: SINGLE_TFE,
    }, { signal: controller.signal });
    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
  });
});
