import { describe, expect, it, vi } from "vitest";
import { HoidKnowledgeCatalog } from "./catalog";
import {
  authorizeHoidCatalogAliasMentions,
  type HoidAliasDisclosureRequest,
  type HoidAliasDisclosurePort,
} from "./aliasDisclosureBoundary";

const WITNESS = Object.freeze({ revision: 7, fingerprint: "a".repeat(64) });

function catalog() {
  return new HoidKnowledgeCatalog([{
    id: "synthetic.alias-entity",
    aliases: ["Alias principal", "Nombre alternativo"],
    kind: "character",
    firstSafeAppearance: { bookId: "tfe", chapter: 1 },
  }]);
}

function authorizeAll(request: HoidAliasDisclosureRequest) {
  return {
    status: "authorized" as const,
    authorizedMatches: request.matches.map(match => ({ id: match.id, aliases: [...match.aliases] })),
    progressRevision: WITNESS.revision,
    progressFingerprint: WITNESS.fingerprint,
  };
}

describe("Hoid per-alias disclosure boundary", () => {
  it("allows text with no catalogued alias without a port", async () => {
    await expect(authorizeHoidCatalogAliasMentions("Pregunta general", [{ bookId: "tfe", chapter: 2 }], catalog()))
      .resolves.toEqual({ status: "allowed", progressWitness: null });
  });

  it("blocks a known alias when no host authority is configured", async () => {
    await expect(authorizeHoidCatalogAliasMentions("¿Quién es Alias principal?", [{ bookId: "tfe", chapter: 2 }], catalog()))
      .resolves.toEqual({ status: "blocked" });
  });

  it("requires an exact grant for every matched spelling", async () => {
    const authorize = vi.fn(authorizeAll);
    const result = await authorizeHoidCatalogAliasMentions(
      "Alias principal y Nombre alternativo", [{ bookId: "tfe", chapter: 2 }], catalog(), { authorize },
    );
    expect(result).toEqual({ status: "allowed", progressWitness: WITNESS });
    expect(authorize).toHaveBeenCalledTimes(1);
    const request = authorize.mock.calls[0][0];
    expect(request.matches).toEqual([{ id: "synthetic.alias-entity", aliases: ["Alias principal", "Nombre alternativo"] }]);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.reading)).toBe(true);
    expect(request.matches[0]).not.toHaveProperty("summary");
    expect(request.matches[0]).not.toHaveProperty("firstSafeAppearance");
  });

  it("rejects partial and extra grants", async () => {
    const partial: HoidAliasDisclosurePort = {
      authorize: request => ({
        status: "authorized",
        authorizedMatches: [{ id: request.matches[0].id, aliases: ["Alias principal"] }],
        progressRevision: WITNESS.revision,
        progressFingerprint: WITNESS.fingerprint,
      }),
    };
    await expect(authorizeHoidCatalogAliasMentions("Alias principal y Nombre alternativo", [{ bookId: "tfe", chapter: 2 }], catalog(), partial))
      .resolves.toEqual({ status: "unavailable" });

    const extra: HoidAliasDisclosurePort = {
      authorize: request => ({
        status: "authorized",
        authorizedMatches: [...request.matches.map(item => ({ id: item.id, aliases: [...item.aliases] })), { id: "extra.entity", aliases: ["Inventado"] }],
        progressRevision: WITNESS.revision,
        progressFingerprint: WITNESS.fingerprint,
      }),
    };
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(), extra))
      .resolves.toEqual({ status: "unavailable" });
  });

  it("preserves blocked and unavailable host decisions", async () => {
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(),
      { authorize: () => ({ status: "blocked" }) })).resolves.toEqual({ status: "blocked" });
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(),
      { authorize: () => ({ status: "unavailable" }) })).resolves.toEqual({ status: "unavailable" });
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(),
      { authorize: () => { throw new Error("unavailable"); } })).resolves.toEqual({ status: "unavailable" });
  });

  it("rejects accessor-backed authority methods and results without executing getters", async () => {
    let calls = 0;
    const port = Object.defineProperty({}, "authorize", {
      enumerable: true,
      get() { calls += 1; return authorizeAll; },
    }) as HoidAliasDisclosurePort;
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(), port))
      .resolves.toEqual({ status: "unavailable" });
    expect(calls).toBe(0);

    const result = Object.defineProperty({ authorizedMatches: [] }, "status", {
      enumerable: true,
      get() { calls += 1; return "authorized"; },
    });
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(),
      { authorize: () => result })).resolves.toEqual({ status: "unavailable" });
    expect(calls).toBe(0);
  });

  it("rejects invalid and duplicate progress positions before calling the authority", async () => {
    const authorize = vi.fn(authorizeAll);
    const port = { authorize };
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: -1 }], catalog(), port))
      .resolves.toEqual({ status: "unavailable" });
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [
      { bookId: "tfe", chapter: 2 }, { bookId: "tfe", chapter: 3 },
    ], catalog(), port)).resolves.toEqual({ status: "unavailable" });
    expect(authorize).not.toHaveBeenCalled();
  });

  it("captures a witness for alias-free text and supports native asynchronous ports", async () => {
    const authorize = vi.fn(authorizeAll);
    await expect(authorizeHoidCatalogAliasMentions("Pregunta general", [{ bookId: "tfe", chapter: 2 }], catalog(), { authorize }))
      .resolves.toEqual({ status: "allowed", progressWitness: WITNESS });
    expect(authorize.mock.calls[0][0].matches).toEqual([]);

    const asyncPort: HoidAliasDisclosurePort = { authorize: async request => authorizeAll(request) };
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(), asyncPort))
      .resolves.toEqual({ status: "allowed", progressWitness: WITNESS });
  });

  it("rejects custom thenables and lookalike catalog objects without executing them", async () => {
    let calls = 0;
    const thenable = Object.defineProperty({}, "then", {
      get() { calls += 1; return () => undefined; },
    });
    await expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(),
      { authorize: () => thenable })).resolves.toEqual({ status: "unavailable" });

    const lookalike = { findMatches() { calls += 1; return []; } };
    await expect(authorizeHoidCatalogAliasMentions("Pregunta general", [], lookalike as unknown as HoidKnowledgeCatalog))
      .resolves.toEqual({ status: "unavailable" });
    expect(calls).toBe(0);
  });
});
