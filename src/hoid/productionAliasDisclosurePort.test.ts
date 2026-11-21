import { describe, expect, it, vi } from "vitest";
import {
  createHoidProductionAliasDisclosurePort,
  type HoidProductionAliasDisclosurePortOptions,
} from "./productionAliasDisclosurePort";
import type { HoidAliasDisclosureRequest } from "./aliasDisclosureBoundary";
import type { HoidCursorProgressSnapshot } from "./cursorProgressLedger";
import type { HoidEntityResolutionResult } from "./entityResolver";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

const NOW = "2026-11-21T15:00:00.000Z";
const ENTITY_ID = "synthetic.alias-entity";
const ALIAS = "Alias principal";

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

function readyResolver(options: { wrongRevision?: boolean; blockedAlias?: string } = {}) {
  const calls: string[] = [];
  const resolver: NonNullable<HoidProductionAliasDisclosurePortOptions["resolveEntity"]> = (snapshot, query) => {
    const projection = projectHoidCursorProgressSnapshot(snapshot);
    if (projection.status !== "ready") return { status: "unavailable", reason: "invalid-progress" };
    const text = (query as { text?: unknown }).text;
    if (typeof text !== "string") return { status: "unavailable", reason: "invalid-query" };
    calls.push(text);
    if (text === options.blockedAlias) {
      return {
        status: "ready",
        resolution: "not-found",
        progressRevision: projection.revision,
        progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
        matches: [],
        truncated: false,
      };
    }
    return {
      status: "ready",
      resolution: "matched",
      progressRevision: options.wrongRevision ? projection.revision + 1 : projection.revision,
      progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
      matches: [{
        id: ENTITY_ID,
        kind: "character",
        matchedAlias: text,
        entitySource: {},
        aliasEvidence: [],
      }],
      truncated: false,
    } as unknown as HoidEntityResolutionResult;
  };
  return { resolver, calls };
}

function optionsFor(
  snapshot: HoidCursorProgressSnapshot,
  resolver: HoidProductionAliasDisclosurePortOptions["resolveEntity"],
): HoidProductionAliasDisclosurePortOptions {
  return {
    progressStore: {
      load: async () => ({ status: "ready", snapshot, migratedFromV1: false }),
    },
    resolveEntity: resolver,
  };
}

describe("production SQLite-backed alias disclosure adapter", () => {
  it("grants only exact aliases resolved against the current durable progress snapshot", async () => {
    const snapshot = progress();
    const { resolver, calls } = readyResolver();
    const port = createHoidProductionAliasDisclosurePort(optionsFor(snapshot, resolver));
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
  });

  it("blocks when request reading differs from the authoritative SQLite snapshot", async () => {
    const { resolver, calls } = readyResolver();
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress(), resolver));
    expect(await port.authorize(request([ALIAS], [{ bookId: "tfe", chapter: 2 }]))).toEqual({ status: "blocked" });
    expect(calls).toEqual([]);
  });

  it("blocks aliases without an independently approved production record", async () => {
    const { resolver } = readyResolver({ blockedAlias: ALIAS });
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress(), resolver));
    expect(await port.authorize(request())).toEqual({ status: "blocked" });
  });

  it("rejects resolver results authorized under a different progress revision", async () => {
    const { resolver } = readyResolver({ wrongRevision: true });
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress(), resolver));
    expect(await port.authorize(request())).toEqual({ status: "blocked" });
  });

  it("fails closed when the durable cursor store is unavailable", async () => {
    const port = createHoidProductionAliasDisclosurePort({
      progressStore: { load: async () => ({ status: "unavailable", reason: "storage-error" }) },
      resolveEntity: readyResolver().resolver,
    });
    expect(await port.authorize(request())).toEqual({ status: "unavailable" });
  });

  it("captures a revision witness even when the request contains no known aliases", async () => {
    const snapshot = progress();
    const { resolver, calls } = readyResolver();
    const port = createHoidProductionAliasDisclosurePort(optionsFor(snapshot, resolver));
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
    expect(calls).toEqual([]);
  });

  it("requires every alias in a multi-alias request to resolve independently", async () => {
    const { resolver, calls } = readyResolver({ blockedAlias: "Alias posterior" });
    const port = createHoidProductionAliasDisclosurePort(optionsFor(progress(), resolver));
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
    const { resolver } = readyResolver();
    const port = createHoidProductionAliasDisclosurePort({
      progressStore: { load },
      resolveEntity: resolver,
    });
    const first = await port.authorize(request());
    const second = await port.authorize(request());
    expect(first).toMatchObject({ status: "authorized", progressRevision: 1 });
    expect(second).toMatchObject({ status: "authorized", progressRevision: 2 });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
