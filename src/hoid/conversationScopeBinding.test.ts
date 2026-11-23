import { describe, expect, it } from "vitest";
import { getHoidReadingManifest, createHoidReadingCursor } from "./readingManifest";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import {
  createHoidConversationScopeBinding,
  validateHoidConversationScopeBinding,
} from "./conversationScopeBinding";

const UPDATED_AT = "2026-11-23T20:00:00.000Z";

function progress(bookIds: readonly string[], chapter = 3, revision = 7) {
  const positions = bookIds.map(bookId => {
    const cursor = createHoidReadingCursor(bookId, chapter);
    if (cursor.status !== "ready") throw new Error("Synthetic cursor unavailable");
    return { bookId, cursor: cursor.cursor };
  });
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze(positions),
    updatedAt: UPDATED_AT,
  });
}

function source(bookId: string, sourceChapter = 1, unlockChapter = 1, evidenceId = `evidence.${bookId}`) {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Synthetic manifest unavailable");
  const unit = manifest.manifest.units.find(candidate => candidate.chapterNumber === sourceChapter);
  if (!unit?.locatorId) throw new Error("Synthetic chapter locator unavailable");
  return Object.freeze({
    evidenceId,
    sourceBookId: bookId,
    sourceChapter,
    locatorId: unit.locatorId,
    unlockBookId: bookId,
    unlockChapter,
  });
}

function authorizedAnswer(sources: readonly ReturnType<typeof source>[]): HoidEvidenceAnswer {
  return Object.freeze({
    status: "authorized",
    text: "Explicación sintética respaldada para pruebas.",
    claimIds: Object.freeze(["claim.synthetic"]),
    evidenceIds: Object.freeze(sources.map(item => item.evidenceId)),
    sources: Object.freeze([...sources]),
  });
}

describe("Hoid evidence-bound conversation scope", () => {
  it("derives a single-work binding from the exact cited work and chapter", () => {
    const current = progress(["tfe"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe", 1)]),
      current,
    );

    expect(binding).toMatchObject({
      schemaVersion: 1,
      kind: "evidence-work-scope",
      scope: { mode: "single-work", bookIds: ["tfe"] },
      works: [{ bookId: "tfe", chapters: [1] }],
      progressRevision: 7,
    });
    expect(JSON.stringify(binding)).not.toContain("locatorId");
    expect(JSON.stringify(binding)).not.toContain("Explicación sintética");
    expect(JSON.stringify(binding)).not.toContain("El Imperio Final");
  });

  it("derives a deterministic cross-work scope from every cited work", () => {
    const current = progress(["twok", "tfe"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([
        source("twok", 2, 2, "evidence.twok"),
        source("tfe", 1, 1, "evidence.tfe"),
      ]),
      current,
    );

    expect(binding).toMatchObject({
      scope: { mode: "cross-work", bookIds: ["tfe", "twok"] },
      works: [
        { bookId: "tfe", chapters: [1] },
        { bookId: "twok", chapters: [2] },
      ],
    });
  });

  it("keeps an explicit single-work scope and rejects evidence outside it", () => {
    const current = progress(["tfe", "twok"]);
    const allowed = createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe")]),
      current,
      { mode: "single-work", bookIds: ["tfe"] },
    );
    expect(allowed?.scope).toEqual({ mode: "single-work", bookIds: ["tfe"] });

    expect(createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe"), source("twok", 1, 1, "evidence.twok")]),
      current,
      { mode: "single-work", bookIds: ["tfe"] },
    )).toBeNull();
  });

  it("does not create a binding for locked evidence or an abstaining answer", () => {
    const current = progress(["tfe"]);
    expect(createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe", 1, 3)]),
      current,
    )).toBeNull();

    expect(createHoidConversationScopeBinding({
      status: "abstain",
      reason: "no-authorized-evidence",
      text: "No autorizado",
      claimIds: [],
      evidenceIds: [],
      sources: [],
    }, current)).toBeNull();
  });

  it("validates an unchanged binding and returns its canonical scope", () => {
    const current = progress(["tfe", "twok"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([
        source("tfe", 1, 1, "evidence.tfe"),
        source("twok", 1, 1, "evidence.twok"),
      ]),
      current,
    );
    expect(binding).not.toBeNull();
    expect(validateHoidConversationScopeBinding(binding, current)).toMatchObject({
      status: "ready",
      scope: { mode: "cross-work", bookIds: ["tfe", "twok"] },
    });
  });

  it("rejects a stale progress revision or fingerprint", () => {
    const original = progress(["tfe"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe")]),
      original,
    );
    expect(validateHoidConversationScopeBinding(binding, progress(["tfe"], 3, 8))).toEqual({
      status: "unavailable",
      reason: "stale-progress",
    });
    expect(validateHoidConversationScopeBinding(binding, progress(["tfe"], 4, 7))).toEqual({
      status: "unavailable",
      reason: "stale-progress",
    });
  });

  it("rejects an explicit scope change instead of widening a follow-up", () => {
    const current = progress(["tfe", "twok"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe")]),
      current,
    );
    expect(validateHoidConversationScopeBinding(
      binding,
      current,
      { mode: "cross-work", bookIds: ["tfe", "twok"] },
    )).toEqual({ status: "unavailable", reason: "scope-mismatch" });
  });

  it("rejects altered chapter metadata and malformed scope records", () => {
    const current = progress(["tfe"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe")]),
      current,
    );
    if (!binding) throw new Error("Synthetic binding unavailable");

    const altered = {
      ...binding,
      works: [{ bookId: "tfe", chapters: [999] }],
    };
    expect(validateHoidConversationScopeBinding(altered, current)).toEqual({
      status: "unavailable",
      reason: "invalid-binding",
    });
    expect(validateHoidConversationScopeBinding({ ...binding, extra: true }, current)).toEqual({
      status: "unavailable",
      reason: "invalid-binding",
    });
  });

  it("rejects accessor-backed bindings without invoking accessors", () => {
    const current = progress(["tfe"]);
    const binding = createHoidConversationScopeBinding(
      authorizedAnswer([source("tfe")]),
      current,
    );
    if (!binding) throw new Error("Synthetic binding unavailable");
    let invoked = false;
    const hostile = { ...binding } as Record<string, unknown>;
    Object.defineProperty(hostile, "scope", {
      enumerable: true,
      configurable: true,
      get() { invoked = true; return binding.scope; },
    });
    expect(validateHoidConversationScopeBinding(hostile, current)).toEqual({
      status: "unavailable",
      reason: "invalid-binding",
    });
    expect(invoked).toBe(false);
  });
});
