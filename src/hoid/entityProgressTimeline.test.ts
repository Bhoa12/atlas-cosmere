import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
  type HoidApprovedClaimIntent,
} from "./approvedClaimIntegrity";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import { createHoidEntityDossierGateway } from "./entityDossierGateway";
import { createHoidEntityProgressTimelineAdapter } from "./entityProgressTimeline";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-27T02:30:00.000Z";
const CROSS_SCOPE = Object.freeze({
  mode: "cross-work" as const,
  bookIds: Object.freeze(["tfe", "twok"]),
});

function makeEntry(
  id: string,
  alias: string,
  bookId: string,
  chapter: number,
  unlockChapter: number,
  kind: HoidKnowledgeKind = "character",
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
    summary: "Resumen editorial original y sintético para " + alias + ".",
    provenance: "verified" as const,
  });
}

function aliasRecord(entry: HoidKnowledgeEntry): HoidEntityAliasRecord {
  if (!entry.evidenceSource || !entry.evidenceUnlock) throw new Error("Expected source metadata");
  return Object.freeze({
    id: "alias." + entry.id,
    entityId: entry.id,
    alias: entry.aliases[0],
    evidence: Object.freeze([Object.freeze({
      id: "alias-evidence." + entry.id,
      source: entry.evidenceSource,
      unlock: entry.evidenceUnlock,
    })]),
    review: Object.freeze({
      status: "approved" as const,
      origin: "original-editorial" as const,
      reviewerId: "reviewer.alpha",
      reviewedAt: NOW,
    }),
  });
}

function approvedClaim(
  id: string,
  text: string,
  knowledge: readonly HoidKnowledgeEntry[],
  evidenceIds: readonly string[],
  entityId: string,
  intent: HoidApprovedClaimIntent = "explain",
): HoidApprovedClaim {
  const core = Object.freeze({
    id,
    text,
    intent,
    evidenceIds: Object.freeze([...evidenceIds]),
    entityIds: Object.freeze([entityId]),
  });
  const result = createHoidApprovedClaimAttestation(core, knowledge, {
    reviewerId: "reviewer.alpha",
    reviewedAt: NOW,
  });
  if (result.status !== "valid") {
    throw new Error("Expected a valid synthetic timeline attestation: " + result.reason);
  }
  return Object.freeze({ ...core, integrity: result.integrity, review: result.review });
}

function progressSnapshot(
  tfeCursor = 5,
  twokCursor = 3,
  revision = 1,
) {
  const tfe = createHoidReadingCursor("tfe", tfeCursor);
  const twok = createHoidReadingCursor("twok", twokCursor);
  if (tfe.status !== "ready" || twok.status !== "ready") {
    throw new Error("Expected verified multi-work cursors");
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

function fixture(options: Readonly<{
  knowledge: readonly HoidKnowledgeEntry[];
  claims?: readonly HoidApprovedClaim[];
  aliases?: readonly HoidEntityAliasRecord[];
  current?: unknown;
  refresh?: () => unknown | Promise<unknown>;
}>): Readonly<{
  adapter: NonNullable<ReturnType<typeof createHoidEntityProgressTimelineAdapter>>;
  gateway: NonNullable<ReturnType<typeof createHoidEntityDossierGateway>>;
  current: unknown;
}> {
  const current = options.current ?? progressSnapshot();
  const gateway = createHoidEntityDossierGateway({
    knowledge: options.knowledge,
    claims: options.claims ?? [],
    aliasEvidence: options.aliases ?? options.knowledge.map(aliasRecord),
    getCurrentProgress: () => current,
  });
  if (!gateway) throw new Error("Expected a branded dossier gateway");
  const adapter = createHoidEntityProgressTimelineAdapter({
    gateway,
    refreshCurrentProgress: options.refresh ?? (async () => current),
  });
  if (!adapter) throw new Error("Expected a timeline adapter");
  return Object.freeze({ adapter, gateway, current });
}

function query(current: unknown, question = "¿Cuál es la evolución de Vin?") {
  return {
    question,
    progress: current,
    bookScope: CROSS_SCOPE,
  };
}

describe("Hoid progress-bound entity timeline", () => {
  it("builds independent per-work tracks in evidence-availability order", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const later = makeEntry("evidence.vin.later", "Contexto posterior", "tfe", 4, 4, "concept");
    const earlier = makeEntry("evidence.vin.earlier", "Contexto anterior", "tfe", 2, 2, "concept");
    const knowledge = Object.freeze([entity, later, earlier]);
    const claims = Object.freeze([
      approvedClaim("claim.vin.later", "Afirmación sintética posterior.", knowledge, [entity.id, later.id], entity.id),
      approvedClaim("claim.vin.earlier", "Afirmación sintética anterior.", knowledge, [entity.id, earlier.id], entity.id),
    ]);
    const { adapter, current } = fixture({
      knowledge,
      claims,
      aliases: [aliasRecord(entity)],
    });

    const result = await adapter.answer(query(current));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.semantics).toBe("reading-order-evidence");
    expect(result.crossWorkOrdering).toBe("unordered");
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].ordering).toBe("availability-order");
    expect(result.tracks[0].items.map(item => item.text)).toEqual([
      "Afirmación sintética anterior.",
      "Afirmación sintética posterior.",
    ]);
    expect(result.presentation.text).toContain("no representa una cronología canónica");
    expect(result.presentation.citations.map(item => item.chapter)).toContain(4);
    expect(JSON.stringify(result)).not.toContain("evidenceId");
    expect(JSON.stringify(result)).not.toContain("locatorId");
    expect(JSON.stringify(result)).not.toContain("unlockChapter");
    expect(JSON.stringify(result)).not.toContain("providerEgress");
  });

  it("keeps multi-work claims separate and explicitly unordered", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const crossWork = makeEntry("evidence.vin.twok", "Contexto Roshar", "twok", 2, 2, "concept");
    const knowledge = Object.freeze([entity, crossWork]);
    const claim = approvedClaim(
      "claim.vin.cross-work",
      "Conexión sintética respaldada por dos obras.",
      knowledge,
      [entity.id, crossWork.id],
      entity.id,
    );
    const { adapter, current } = fixture({
      knowledge,
      claims: [claim],
      aliases: [aliasRecord(entity)],
    });

    const result = await adapter.answer(query(current));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.tracks).toHaveLength(0);
    expect(result.crossWorkItems).toHaveLength(1);
    expect(result.crossWorkItems[0].ordering).toBe("unordered");
    expect(result.crossWorkItems[0].citations.map(item => item.sourceBookId).sort())
      .toEqual(["tfe", "twok"]);
  });

  it("does not expose evidence from the chapter currently open", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const currentChapter = makeEntry("evidence.vin.current", "Contexto del capítulo abierto", "tfe", 3, 3, "concept");
    const knowledge = Object.freeze([entity, currentChapter]);
    const claim = approvedClaim(
      "claim.vin.current",
      "Afirmación sintética del capítulo todavía abierto.",
      knowledge,
      [entity.id, currentChapter.id],
      entity.id,
    );
    const current = progressSnapshot(3, 1);
    const { adapter } = fixture({
      knowledge,
      claims: [claim],
      aliases: [aliasRecord(entity)],
      current,
    });

    const result = await adapter.answer(query(current));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.tracks.flatMap(track => track.items).map(item => item.text))
      .not.toContain("Afirmación sintética del capítulo todavía abierto.");
  });

  it("returns the same neutral result for a locked entity and an unknown entity", async () => {
    const lockedEntity = makeEntry("entity.vin", "Vin", "tfe", 1, 4);
    const current = progressSnapshot(3, 1);
    const { adapter } = fixture({
      knowledge: [lockedEntity],
      aliases: [aliasRecord(lockedEntity)],
      current,
    });

    const locked = await adapter.answer(query(current));
    const unknown = await adapter.answer(query(current, "Evolución de Entidad Fantasma"));
    expect(locked).toEqual({ status: "not-found" });
    expect(unknown).toEqual(locked);
  });

  it("discards the timeline when durable progress changes during retrieval", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const current = progressSnapshot(5, 3, 1);
    const changed = progressSnapshot(6, 3, 2);
    let reads = 0;
    const { adapter } = fixture({
      knowledge: [entity],
      aliases: [aliasRecord(entity)],
      current,
      refresh: async () => {
        reads += 1;
        return reads === 1 ? current : changed;
      },
    });
    expect(await adapter.answer(query(current))).toEqual({
      status: "unavailable",
      reason: "progress-changed",
    });
  });

  it("rejects provider-bearing and unbranded configurations", () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const { gateway, current } = fixture({ knowledge: [entity] });
    expect(createHoidEntityProgressTimelineAdapter({
      gateway,
      refreshCurrentProgress: () => current,
      provider: { invoke: () => "not allowed" },
    })).toBeNull();
    expect(createHoidEntityProgressTimelineAdapter({
      gateway: { getDossier: () => ({ status: "not-found" }) },
      refreshCurrentProgress: () => current,
    })).toBeNull();
  });

  it("handles cancellation, missing names and invalid scopes without fallback", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const { adapter, current } = fixture({ knowledge: [entity] });
    const controller = new AbortController();
    controller.abort();
    expect(await adapter.answer(query(current), { signal: controller.signal })).toEqual({
      status: "unavailable",
      reason: "cancelled",
    });
    expect(await adapter.answer(query(current, "¿Cuál es la evolución de?")))
      .toEqual({ status: "needs-name" });
    expect(await adapter.answer({
      ...query(current),
      bookScope: { mode: "cross-work", bookIds: ["tfe", "tfe"] },
    })).toEqual({ status: "unavailable", reason: "invalid-scope" });
  });

  it("excludes recommendation claims from the evolution timeline", async () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe", 1, 2);
    const supporting = makeEntry("evidence.vin.recommend", "Contexto recomendado", "tfe", 2, 2, "concept");
    const knowledge = Object.freeze([entity, supporting]);
    const recommendation = approvedClaim(
      "claim.vin.recommend",
      "Recomendación sintética que no es un cambio del personaje.",
      knowledge,
      [entity.id, supporting.id],
      entity.id,
      "recommend",
    );
    const { adapter, current } = fixture({
      knowledge,
      claims: [recommendation],
      aliases: [aliasRecord(entity)],
    });
    const result = await adapter.answer(query(current));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.tracks).toHaveLength(0);
    expect(result.crossWorkItems).toHaveLength(0);
    expect(result.presentation.text).not.toContain("Recomendación sintética");
  });
});
