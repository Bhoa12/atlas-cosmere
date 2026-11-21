import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHoidProductionAliasDisclosurePort,
  type HoidProductionAliasDisclosurePortOptions,
} from "./productionAliasDisclosurePort";
import type { HoidAliasDisclosureRequest } from "./aliasDisclosureBoundary";
import type { HoidCursorProgressSnapshot } from "./cursorProgressLedger";
import {
  resolveProductionHoidEntities,
  type HoidEntityResolutionResult,
} from "./entityResolver";
import { createHoidReadingCursor, getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

vi.mock("./entityResolver", async importOriginal => {
  const actual = await importOriginal<typeof import("./entityResolver")>();
  return {
    ...actual,
    resolveProductionHoidEntities: vi.fn(),
  };
});

const NOW = "2026-11-21T15:00:00.000Z";
const ENTITY_ID = "synthetic.alias-entity";
const ALIAS = "Alias principal";
const productionResolver = vi.mocked(resolveProductionHoidEntities);

function progress(revision = 1, chapter = 2): HoidCursorProgressSnapshot {
  const cursor = createHoidReadingCursor("tfe", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor de fixture no disponible");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([Object.freeze({ bookId: "tfe", cursor: cursor.cursor })]),
    updatedAt: NOW,
  });
}

function request(
  aliases: readonly string[] = [ALIAS],
  reading: readonly { bookId: string; chapter?: number; completed?: boolean }[] = [{ bookId: "tfe", chapter: 1 }],
): HoidAliasDisclosureRequest {
  return Object.freeze({
    text: aliases.join(" y "),
    reading,
    matches: Object.freeze([Object.freeze({ id: ENTITY_ID, aliases })]),
  });
}

function verifiedSource(evidenceId: string) {
  const manifest = getHoidReadingManifest("tfe");
  if (manifest.status !== "ready") throw new Error("Manifiesto sintético no disponible");
  const unit = manifest.manifest.units.find(item => item.chapterNumber === 1);
  if (!unit?.locatorId) throw new Error("Localizador sintético no disponible");
  const documentSha256 = getVerifiedChapterDocumentSha256(
    "tfe",
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    1,
  );
  if (!documentSha256) throw new Error("Digest sintético no disponible");
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

function installResolver(options: { wrongRevision?: boolean; blockedAlias?: string } = {}) {
  const calls: string[] = [];
  productionResolver.mockImplementation((snapshot, query): HoidEntityResolutionResult => {
    const projection = projectHoidCursorProgressSnapshot(snapshot);
    if (projection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" };
    const text = (query as { text?: unknown }).text;
    if (typeof text !== "string") return { status: "unavailable", reason: "invalid-query" };
    calls.push(text);
    const progressFingerprint = fingerprintHoidCursorProgressProjection(projection);
    if (text === options.blockedAlias) {
      return {
        status: "ready",
        resolution: "not-found",
        progressRevision: projection.revision,
        progressFingerprint,
        matches: [],
        truncated: false,
      };
    }
    const entitySource = verifiedSource("synthetic.entity-source");
    const aliasEvidenceId = "synthetic.alias-evidence";
    const aliasSource = verifiedSource(aliasEvidenceId);
    return {
      status: "ready",
      resolution: "matched",
      progressRevision: options.wrongRevision ? projection.revision + 1 : projection.revision,
      progressFingerprint,
      matches: [{
        id: ENTITY_ID,
        kind: "character",
        matchedAlias: text,
        entitySource,
        aliasEvidence: [{ evidenceId: aliasEvidenceId, source: aliasSource }],
      }],
      truncated: false,
    };
  });
  return calls;
}

function optionsFor(snapshot: HoidCursorProgressSnapshot): HoidProductionAliasDisclosurePortOptions {
  return {
    progressStore: {
      load: async () => ({ status: "ready", snapshot, migratedFromV1: false }),
    },
  };
}

beforeEach(() => {
  productionResolver.mockReset();
});

describe("production SQLite-backed alias disclosure adapter", () => {
  it("grants only exact aliases resolved by the fixed production resolver against durable progress", async () => {
    const snapshot = progress();
    const calls = installResolver();
    const port = createHoidProductionAliasDisclosurePort(optionsFor(snapshot));
    const result = await port.authorize(request());
    const projection = projectHoidCursorProgressSnapshot(snapshot);
    if (projection.status !== "ready") throw new Error("Proyección de fixture no disponible");
    expect(result).toEqual({
      status: "authorized",
      authorizedMatches: [{ id: ENTITY_ID, aliases: [ALIAS] }],
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    });
    expect(calls).toEqual([ALIAS]);
    expect(productionResolver).toHaveBeenCalledTimes(1);
  });

  it("blocks when request reading differs from the authoritative SQLite snapshot", async () => {
    const calls = installResolver();
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress()));
    expect(await port.authorize(request([ALIAS], [{ bookId: "tfe", chapter: 2 }]))).toEqual({ status: "blocked" });
    expect(calls).toEqual([]);
  });

  it("blocks aliases without an independently approved production record", async () => {
    const calls = installResolver({ blockedAlias: ALIAS });
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress()));
    expect(await port.authorize(request())).toEqual({ status: "blocked" });
    expect(calls).toEqual([ALIAS]);
  });

  it("rejects resolver results authorized under a different progress revision", async () => {
    installResolver({ wrongRevision: true });
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress()));
    expect(await port.authorize(request())).toEqual({ status: "blocked" });
  });

  it("fails closed when the durable cursor store is unavailable", async () => {
    const port = createHoidProductionAliasDisclosurePort({
      progressStore: { load: async () => ({ status: "unavailable", reason: "storage-error" }) },
    });
    expect(await port.authorize(request())).toEqual({ status: "unavailable" });
    expect(productionResolver).not.toHaveBeenCalled();
  });

  it("captures a revision witness even when the request contains no known aliases", async () => {
    const snapshot = progress();
    installResolver();
    const port = createHoidProductionAliasDisclosurePort(optionsFor(snapshot));
    const result = await port.authorize(Object.freeze({
      text: "Pregunta general",
      reading: [{ bookId: "tfe", chapter: 1 }],
      matches: [],
    }));
    const projection = projectHoidCursorProgressSnapshot(snapshot);
    if (projection.status !== "ready") throw new Error("Proyección de fixture no disponible");
    expect(result).toEqual({
      status: "authorized",
      authorizedMatches: [],
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    });
    expect(productionResolver).not.toHaveBeenCalled();
  });

  it("requires every alias in a multi-alias request to resolve independently", async () => {
    const calls = installResolver({ blockedAlias: "Alias posterior" });
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress()));
    expect(await port.authorize(request([ALIAS, "Alias posterior"]))).toEqual({ status: "blocked" });
    expect(calls).toEqual([ALIAS, "Alias posterior"]);
  });

  it("returns a new witness when SQLite advances while the visible chapter projection is unchanged", async () => {
    const snapshots = [progress(1), progress(2)];
    const load = vi.fn(async () => ({
      status: "ready" as const,
      snapshot: snapshots.shift()!,
      migratedFromV1: false,
    }));
    installResolver();
    const port = createHoidProductionAliasDisclosurePort({ progressStore: { load } });
    const first = await port.authorize(request());
    const second = await port.authorize(request());
    expect(first).toMatchObject({ status: "authorized", progressRevision: 1 });
    expect(second).toMatchObject({ status: "authorized", progressRevision: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("rejects a caller-supplied resolver override instead of invoking it", async () => {
    const forgedResolver = vi.fn(() => ({
      status: "ready",
      resolution: "matched",
      progressRevision: 1,
      progressFingerprint: "a".repeat(64),
      matches: [{ id: ENTITY_ID, matchedAlias: ALIAS }],
      truncated: false,
    }));
    const options = {
      ...optionsFor(progress()),
      resolveEntity: forgedResolver,
    } as unknown as HoidProductionAliasDisclosurePortOptions;
    const port = createHoidProductionAliasDisclosurePort(options);
    expect(await port.authorize(request())).toEqual({ status: "unavailable" });
    expect(forgedResolver).not.toHaveBeenCalled();
    expect(productionResolver).not.toHaveBeenCalled();
  });

  it("rejects accessor-backed progress stores without executing their getter", async () => {
    let getterCalls = 0;
    const store = Object.defineProperty({}, "load", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return async () => ({ status: "ready", snapshot: progress(), migratedFromV1: false });
      },
    });
    const port = createHoidProductionAliasDisclosurePort({
      progressStore: store as unknown as HoidProductionAliasDisclosurePortOptions["progressStore"],
    });
    expect(await port.authorize(request())).toEqual({ status: "unavailable" });
    expect(getterCalls).toBe(0);
  });

  it("rejects a matched resolver result with missing source and alias evidence", async () => {
    const snapshot = progress();
    const projection = projectHoidCursorProgressSnapshot(snapshot);
    if (projection.status !== "ready") throw new Error("Proyección de fixture no disponible");
    productionResolver.mockReturnValue({
      status: "ready",
      resolution: "matched",
      progressRevision: projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      matches: [{
        id: ENTITY_ID,
        kind: "character",
        matchedAlias: ALIAS,
        entitySource: {},
        aliasEvidence: [],
      }],
      truncated: false,
    } as unknown as HoidEntityResolutionResult);
    const port = createHoidProductionAliasDisclosurePort(optionsFor(snapshot));
    expect(await port.authorize(request())).toEqual({ status: "blocked" });
  });
});
