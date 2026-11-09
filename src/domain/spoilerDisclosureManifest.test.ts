import { describe, expect, it } from "vitest";
import { resolveSpoilerDisclosureManifest } from "./spoilerDisclosureManifest";

describe("resolveSpoilerDisclosureManifest", () => {
  it("maps explicit access decisions to metadata-only visibility entries", () => {
    expect(resolveSpoilerDisclosureManifest(
      [
        { contentId: "overview", kind: "summary" },
        { contentId: "detail", kind: "summary" },
      ],
      [
        { contentId: "overview", allowed: true },
        { contentId: "detail", allowed: false },
      ],
    )).toEqual({
      status: "valid",
      entries: [
        { contentId: "overview", kind: "summary", visible: true },
        { contentId: "detail", kind: "summary", visible: false },
      ],
    });
  });

  it("blocks duplicate or incomplete identifiers fail-closed", () => {
    expect(resolveSpoilerDisclosureManifest(
      [{ contentId: "detail", kind: "summary" }],
      [],
    )).toEqual({ status: "blocked", entries: [] });

    expect(resolveSpoilerDisclosureManifest(
      [
        { contentId: "detail", kind: "summary" },
        { contentId: "detail", kind: "note" },
      ],
      [{ contentId: "detail", allowed: true }],
    )).toEqual({ status: "blocked", entries: [] });
  });

  it("blocks orphan and malformed access decisions", () => {
    expect(resolveSpoilerDisclosureManifest(
      [{ contentId: "detail", kind: "summary" }],
      [
        { contentId: "detail", allowed: true },
        { contentId: "orphan", allowed: false },
      ],
    )).toEqual({ status: "blocked", entries: [] });

    expect(resolveSpoilerDisclosureManifest(
      [{ contentId: "detail", kind: "summary" }],
      [{ contentId: "detail", allowed: undefined as unknown as boolean }],
    )).toEqual({ status: "blocked", entries: [] });
  });
});
