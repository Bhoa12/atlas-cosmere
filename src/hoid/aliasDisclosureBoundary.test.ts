import { describe, expect, it, vi } from "vitest";
import { HoidKnowledgeCatalog } from "./catalog";
import {
  authorizeHoidCatalogAliasMentions,
  type HoidAliasDisclosureRequest,
  type HoidAliasDisclosurePort,
} from "./aliasDisclosureBoundary";

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
    authorizedMatches: request.matches.map(match => ({
      id: match.id,
      aliases: [...match.aliases],
    })),
  };
}

describe("Hoid per-alias disclosure boundary", () => {
  it("allows text with no catalogued alias without requiring an alias port", () => {
    expect(authorizeHoidCatalogAliasMentions(
      "Pregunta general",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
    )).toEqual({ status: "allowed" });
  });

  it("blocks a known alias when no host-owned disclosure authority is configured", () => {
    expect(authorizeHoidCatalogAliasMentions(
      "¿Quién es Alias principal?",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
    )).toEqual({ status: "blocked" });
  });

  it("requires a grant for every matched spelling, not only the entity ID", () => {
    const authorize = vi.fn(authorizeAll);
    const port: HoidAliasDisclosurePort = { authorize };
    const result = authorizeHoidCatalogAliasMentions(
      "Alias principal y Nombre alternativo",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
      port,
    );

    expect(result).toEqual({ status: "allowed" });
    expect(authorize).toHaveBeenCalledTimes(1);
    const request = authorize.mock.calls[0][0];
    expect(request.matches).toEqual([{
      id: "synthetic.alias-entity",
      aliases: ["Alias principal", "Nombre alternativo"],
    }]);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.reading)).toBe(true);
    expect(Object.isFrozen(request.matches[0])).toBe(true);
    expect(request.matches[0]).not.toHaveProperty("summary");
    expect(request.matches[0]).not.toHaveProperty("firstSafeAppearance");
  });

  it("rejects a partial alias grant even when the entity ID is correct", () => {
    const port: HoidAliasDisclosurePort = {
      authorize: request => ({
        status: "authorized",
        authorizedMatches: [{ id: request.matches[0].id, aliases: ["Alias principal"] }],
      }),
    };
    expect(authorizeHoidCatalogAliasMentions(
      "Alias principal y Nombre alternativo",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
      port,
    )).toEqual({ status: "unavailable" });
  });

  it("rejects extra entity or alias grants", () => {
    const port: HoidAliasDisclosurePort = {
      authorize: request => ({
        status: "authorized",
        authorizedMatches: [
          ...request.matches.map(match => ({ id: match.id, aliases: [...match.aliases] })),
          { id: "unrequested.entity", aliases: ["Alias inventado"] },
        ],
      }),
    };
    expect(authorizeHoidCatalogAliasMentions(
      "Alias principal",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
      port,
    )).toEqual({ status: "unavailable" });
  });

  it("preserves an explicit blocked decision", () => {
    const port: HoidAliasDisclosurePort = { authorize: () => ({ status: "blocked" }) };
    expect(authorizeHoidCatalogAliasMentions(
      "Alias principal",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
      port,
    )).toEqual({ status: "blocked" });
  });

  it("fails closed when the authority is unavailable or throws", () => {
    const unavailable: HoidAliasDisclosurePort = { authorize: () => ({ status: "unavailable" }) };
    const throwing: HoidAliasDisclosurePort = { authorize: () => { throw new Error("unavailable"); } };
    expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(), unavailable))
      .toEqual({ status: "unavailable" });
    expect(authorizeHoidCatalogAliasMentions("Alias principal", [{ bookId: "tfe", chapter: 2 }], catalog(), throwing))
      .toEqual({ status: "unavailable" });
  });

  it("rejects accessor-backed authority methods without executing them", () => {
    let calls = 0;
    const port = Object.defineProperty({}, "authorize", {
      enumerable: true,
      get() {
        calls += 1;
        return authorizeAll;
      },
    }) as HoidAliasDisclosurePort;

    expect(authorizeHoidCatalogAliasMentions(
      "Alias principal",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
      port,
    )).toEqual({ status: "unavailable" });
    expect(calls).toBe(0);
  });

  it("rejects accessor-backed authorization grants without executing getters", () => {
    let calls = 0;
    const result = Object.defineProperty({ authorizedMatches: [] }, "status", {
      enumerable: true,
      get() {
        calls += 1;
        return "authorized";
      },
    });
    const port: HoidAliasDisclosurePort = { authorize: () => result };

    expect(authorizeHoidCatalogAliasMentions(
      "Alias principal",
      [{ bookId: "tfe", chapter: 2 }],
      catalog(),
      port,
    )).toEqual({ status: "unavailable" });
    expect(calls).toBe(0);
  });

  it("rejects invalid progress snapshots before calling the authority", () => {
    const authorize = vi.fn(authorizeAll);
    const port: HoidAliasDisclosurePort = { authorize };
    expect(authorizeHoidCatalogAliasMentions(
      "Alias principal",
      [{ bookId: "tfe", chapter: -1 }],
      catalog(),
      port,
    )).toEqual({ status: "unavailable" });
    expect(authorize).not.toHaveBeenCalled();
  });
});
