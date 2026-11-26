import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry, HoidKnowledgeKind } from "./catalog";
import {
  createHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import type { HoidEntityAliasRecord } from "./entityAliasRegistry";
import {
  buildHoidAuthorizedEntityDossier,
  createHoidEntityDossierGateway,
  createProductionHoidEntityDossierGateway,
} from "./entityDossierGateway";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";

const NOW = "2026-11-26T22:30:00.000Z";

function makeEntry(
  id: string,
  alias: string,
  bookId: string,
  kind: HoidKnowledgeKind = "character",
  chapter = 1,
  unlockChapter = 2,
): HoidKnowledgeEntry {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Expected a fixture manifest");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Expected a fixture locator");
  return Object.freeze({
    id,
    aliases: Object.freeze([alias]) as unknown as string[],
    kind,
    firstSafeAppearance: Object.freeze({ bookId, chapter }),
    evidenceSource: Object.freeze({ bookId, chapter, locatorId: unit.locatorId }),
    evidenceUnlock: Object.freeze({ bookId, chapter: unlockChapter }),
    summary: "Resumen editorial original y sintético para " + alias + ".",
    provenance: "verified",
  });
}

function aliasRecord(entry: HoidKnowledgeEntry, unlockOverride?: number): HoidEntityAliasRecord {
  if (!entry.evidenceSource || !entry.evidenceUnlock) throw new Error("Expected source metadata");
  const alias = entry.aliases[0];
  return Object.freeze({
    id: "alias." + entry.id,
    entityId: entry.id,
    alias,
    evidence: Object.freeze([Object.freeze({
      id: "alias-evidence." + entry.id,
      source: entry.evidenceSource,
      unlock: Object.freeze({
        bookId: entry.evidenceUnlock.bookId,
        chapter: unlockOverride ?? entry.evidenceUnlock.chapter,
      }),
    })]),
    review: Object.freeze({
      status: "approved",
      origin: "original-editorial",
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
  entityIds: readonly string[],
): HoidApprovedClaim {
  const core = Object.freeze({
    id,
    text,
    intent: "explain" as const,
    evidenceIds: Object.freeze([...evidenceIds]),
    entityIds: Object.freeze([...entityIds]),
  });
  const result = createHoidApprovedClaimAttestation(core, knowledge, {
    reviewerId: "reviewer.alpha",
    reviewedAt: NOW,
  });
  if (result.status !== "valid") throw new Error("Expected a valid synthetic claim attestation");
  return Object.freeze({
    ...core,
    integrity: result.integrity,
    review: result.review,
  });
}

function progress(
  positions: readonly Readonly<{ bookId: string; chapter: number }>[],
  revision = 1,
) {
  const canonical = positions.map(position => {
    const result = createHoidReadingCursor(position.bookId, position.chapter);
    if (result.status !== "ready") throw new Error("Expected a fixture cursor");
    return Object.freeze({ bookId: position.bookId, cursor: result.cursor });
  });
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze(canonical),
    updatedAt: NOW,
  });
}

function baseFixture() {
  const entity = makeEntry("entity.vin", "Vin", "tfe");
  const knowledge = Object.freeze([entity]);
  const aliases = Object.freeze([aliasRecord(entity)]);
  return { entity, knowledge, aliases };
}

describe("Hoid progress-bound entity dossier", () => {
  it("returns only the summary whose entity and summary watermarks have both been reached", () => {
    const fixture = baseFixture();
    const locked = buildHoidAuthorizedEntityDossier(
      fixture.knowledge,
      [],
      fixture.aliases,
      progress([{ bookId: "tfe", chapter: 2 }]),
      { text: "Vin" },
    );
    expect(locked.status).toBe("not-found");

    const ready = buildHoidAuthorizedEntityDossier(
      fixture.knowledge,
      [],
      fixture.aliases,
      progress([{ bookId: "tfe", chapter: 3 }]),
      { text: "Vin" },
    );
    expect(ready.status).toBe("ready");
    if (ready.status !== "ready") return;
    expect(ready.dossier.entity.label).toBe("Vin");
    expect(ready.dossier.summary.text).toContain("Resumen editorial original");
    expect(ready.dossier.summary.source.sourceBookId).toBe("tfe");
    expect(ready.dossier.claims).toHaveLength(0);
    expect(ready.dossier.sourceTextIncluded).toBe(false);
    expect(ready.dossier.providerEgress).toBe("none");
  });

  it("withholds an approved claim until every evidence chapter is complete", () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe");
    const supporting = makeEntry("evidence.context", "Contexto", "twok", "concept");
    const knowledge = Object.freeze([entity, supporting]);
    const claim = approvedClaim(
      "claim.vin.cross-work-context",
      "Afirmación sintética de prueba respaldada por dos documentos verificados.",
      knowledge,
      [entity.id, supporting.id],
      [entity.id],
    );
    const aliases = Object.freeze([aliasRecord(entity)]);

    const partial = buildHoidAuthorizedEntityDossier(
      knowledge,
      [claim],
      aliases,
      progress([
        { bookId: "tfe", chapter: 3 },
        { bookId: "twok", chapter: 2 },
      ]),
      { text: "Vin" },
    );
    expect(partial.status).toBe("ready");
    if (partial.status !== "ready") return;
    expect(partial.dossier.claims).toHaveLength(0);

    const complete = buildHoidAuthorizedEntityDossier(
      knowledge,
      [claim],
      aliases,
      progress([
        { bookId: "tfe", chapter: 3 },
        { bookId: "twok", chapter: 3 },
      ]),
      { text: "Vin" },
    );
    expect(complete.status).toBe("ready");
    if (complete.status !== "ready") return;
    expect(complete.dossier.claims).toHaveLength(1);
    expect(complete.dossier.claims[0].claimId).toBe(claim.id);
    expect(complete.dossier.claims[0].sources.map(source => source.sourceBookId).sort())
      .toEqual(["tfe", "twok"]);
  });

  it("keeps a locked alias indistinguishable from an unknown alias", () => {
    const fixture = baseFixture();
    const snapshot = progress([{ bookId: "tfe", chapter: 2 }]);
    const locked = buildHoidAuthorizedEntityDossier(
      fixture.knowledge, [], fixture.aliases, snapshot, { text: "Vin" },
    );
    const unknown = buildHoidAuthorizedEntityDossier(
      fixture.knowledge, [], fixture.aliases, snapshot, { text: "Nombre desconocido" },
    );
    expect(locked.status).toBe("not-found");
    expect(unknown.status).toBe("not-found");
    expect(locked).toEqual(unknown);
  });

  it("does not disclose a claim while one named participant is still locked", () => {
    const first = makeEntry("entity.first", "Primero", "tfe");
    const second = makeEntry("entity.second", "Segundo", "twok");
    const knowledge = Object.freeze([first, second]);
    const claim = approvedClaim(
      "claim.two-participants",
      "Afirmación sintética sobre dos participantes de prueba.",
      knowledge,
      [first.id, second.id],
      [first.id, second.id],
    );
    const aliases = Object.freeze([aliasRecord(first), aliasRecord(second)]);
    const partial = buildHoidAuthorizedEntityDossier(
      knowledge,
      [claim],
      aliases,
      progress([
        { bookId: "tfe", chapter: 3 },
        { bookId: "twok", chapter: 2 },
      ]),
      { text: "Primero" },
    );
    expect(partial.status).toBe("ready");
    if (partial.status !== "ready") return;
    expect(partial.dossier.claims).toHaveLength(0);

    const complete = buildHoidAuthorizedEntityDossier(
      knowledge,
      [claim],
      aliases,
      progress([
        { bookId: "tfe", chapter: 3 },
        { bookId: "twok", chapter: 3 },
      ]),
      { text: "Primero" },
    );
    expect(complete.status).toBe("ready");
    if (complete.status !== "ready") return;
    expect(complete.dossier.claims[0].participants.map(item => item.id).sort())
      .toEqual(["entity.first", "entity.second"]);
  });

  it("returns an opaque ambiguous result when two safe entities share an alias", () => {
    const first = makeEntry("entity.shared-a", "Compartido", "tfe");
    const second = makeEntry("entity.shared-b", "Compartido", "twok");
    const result = buildHoidAuthorizedEntityDossier(
      [first, second],
      [],
      [aliasRecord(first), aliasRecord(second)],
      progress([
        { bookId: "tfe", chapter: 3 },
        { bookId: "twok", chapter: 3 },
      ]),
      { text: "Compartido" },
    );
    expect(result.status).toBe("ambiguous");
    expect(result).not.toHaveProperty("dossier");
  });


  it("withholds an entity summary that mentions a separately locked alias", () => {
    const base = makeEntry("entity.vin", "Vin", "tfe");
    const vin = Object.freeze({
      ...base,
      summary: "Resumen original sintético sobre Vin que menciona a Kelsier.",
    });
    const kelsier = makeEntry("entity.kelsier", "Kelsier", "tfe");
    const knowledge = Object.freeze([vin, kelsier]);
    const aliases = Object.freeze([
      aliasRecord(vin),
      aliasRecord(kelsier, 4),
    ]);

    const beforeAliasUnlock = buildHoidAuthorizedEntityDossier(
      knowledge,
      [],
      aliases,
      progress([{ bookId: "tfe", chapter: 3 }]),
      { text: "Vin" },
    );
    expect(beforeAliasUnlock.status).toBe("not-found");

    const afterAliasUnlock = buildHoidAuthorizedEntityDossier(
      knowledge,
      [],
      aliases,
      progress([{ bookId: "tfe", chapter: 5 }]),
      { text: "Vin" },
    );
    expect(afterAliasUnlock.status).toBe("ready");
  });

  it("withholds claim prose until every named alias is independently disclosed", () => {
    const vin = makeEntry("entity.vin", "Vin", "tfe");
    const kelsier = makeEntry("entity.kelsier", "Kelsier", "tfe");
    const knowledge = Object.freeze([vin, kelsier]);
    const claim = approvedClaim(
      "claim.vin-kelsier.context",
      "Vin y Kelsier aparecen juntos en esta afirmación sintética de prueba.",
      knowledge,
      [vin.id, kelsier.id],
      [vin.id, kelsier.id],
    );
    const aliases = Object.freeze([
      aliasRecord(vin),
      aliasRecord(kelsier, 4),
    ]);

    const locked = buildHoidAuthorizedEntityDossier(
      knowledge,
      [claim],
      aliases,
      progress([{ bookId: "tfe", chapter: 3 }]),
      { text: "Vin" },
    );
    expect(locked.status).toBe("ready");
    if (locked.status !== "ready") return;
    expect(locked.dossier.claims).toHaveLength(0);

    const unlocked = buildHoidAuthorizedEntityDossier(
      knowledge,
      [claim],
      aliases,
      progress([{ bookId: "tfe", chapter: 5 }]),
      { text: "Vin" },
    );
    expect(unlocked.status).toBe("ready");
    if (unlocked.status !== "ready") return;
    expect(unlocked.dossier.claims).toHaveLength(1);
    expect(unlocked.dossier.claims[0].participants.map(item => item.id).sort())
      .toEqual(["entity.kelsier", "entity.vin"]);
  });

  it("rejects a tampered approved claim instead of presenting it", () => {
    const entity = makeEntry("entity.vin", "Vin", "tfe");
    const knowledge = Object.freeze([entity]);
    const claim = approvedClaim(
      "claim.vin.tamper",
      "Afirmación sintética de prueba con integridad original.",
      knowledge,
      [entity.id],
      [entity.id],
    );
    const tampered = Object.freeze({ ...claim, text: "Texto alterado sin nueva aprobación." });
    const result = buildHoidAuthorizedEntityDossier(
      knowledge,
      [tampered],
      [aliasRecord(entity)],
      progress([{ bookId: "tfe", chapter: 3 }]),
      { text: "Vin" },
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-claims" });
  });

  it("rejects provider-bearing gateway configuration", () => {
    const fixture = baseFixture();
    const snapshot = progress([{ bookId: "tfe", chapter: 3 }]);
    expect(createHoidEntityDossierGateway({
      knowledge: fixture.knowledge,
      claims: [],
      aliasEvidence: fixture.aliases,
      getCurrentProgress: () => snapshot,
      provider: { invoke: () => "must-not-run" },
    })).toBeNull();
  });

  it("discards a dossier if authoritative progress changes during construction", () => {
    const fixture = baseFixture();
    const first = progress([{ bookId: "tfe", chapter: 3 }], 1);
    const second = progress([{ bookId: "tfe", chapter: 4 }], 2);
    let reads = 0;
    const gateway = createHoidEntityDossierGateway({
      knowledge: fixture.knowledge,
      claims: [],
      aliasEvidence: fixture.aliases,
      getCurrentProgress: () => {
        reads += 1;
        return reads === 1 ? first : second;
      },
    });
    expect(gateway).not.toBeNull();
    if (!gateway) return;
    const result = gateway.getDossier({ progress: first, query: { text: "Vin" } });
    expect(result).toEqual({ status: "unavailable", reason: "progress-changed" });
    expect(reads).toBe(2);
  });

  it("fails closed on a malformed query and on an unknown knowledge kind", () => {
    const fixture = baseFixture();
    const snapshot = progress([{ bookId: "tfe", chapter: 3 }]);
    expect(buildHoidAuthorizedEntityDossier(
      fixture.knowledge, [], fixture.aliases, snapshot, { text: " Vin " },
    )).toEqual({ status: "unavailable", reason: "invalid-query" });
    expect(buildHoidAuthorizedEntityDossier(
      fixture.knowledge, [], fixture.aliases, snapshot, { text: "Vin", kind: "unknown" },
    )).toEqual({ status: "unavailable", reason: "invalid-query" });
  });

  it("production composition remains bound to empty trusted registries until promotion", () => {
    const snapshot = progress([{ bookId: "tfe", chapter: 3 }]);
    const gateway = createProductionHoidEntityDossierGateway(() => snapshot);
    expect(gateway).not.toBeNull();
    if (!gateway) return;
    expect(gateway.getDossier({ progress: snapshot, query: { text: "Vin" } }).status)
      .toBe("not-found");
  });
});
