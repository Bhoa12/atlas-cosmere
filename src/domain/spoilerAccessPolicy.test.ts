import { describe, expect, it } from "vitest";
import { resolveSpoilerAccessPolicy } from "./spoilerAccessPolicy";

describe("resolveSpoilerAccessPolicy", () => {
  it("keeps safe content visible and follows explicit checkpoint decisions", () => {
    expect(resolveSpoilerAccessPolicy(
      [
        { contentId: "intro", mode: "always-safe" },
        { contentId: "detail", mode: "checkpoint-gated" },
      ],
      [{ contentId: "detail", allowed: false }],
    )).toEqual({
      status: "valid",
      decisions: [
        { contentId: "intro", allowed: true },
        { contentId: "detail", allowed: false },
      ],
    });
  });

  it("blocks missing checkpoint decisions instead of widening access", () => {
    expect(resolveSpoilerAccessPolicy(
      [{ contentId: "detail", mode: "checkpoint-gated" }],
      [],
    )).toEqual({ status: "blocked", decisions: [] });
  });

  it("blocks duplicate or unconsumed checkpoint decisions", () => {
    expect(resolveSpoilerAccessPolicy(
      [{ contentId: "detail", mode: "checkpoint-gated" }],
      [
        { contentId: "detail", allowed: true },
        { contentId: "detail", allowed: false },
      ],
    )).toEqual({ status: "blocked", decisions: [] });

    expect(resolveSpoilerAccessPolicy(
      [{ contentId: "intro", mode: "always-safe" }],
      [{ contentId: "orphan", allowed: true }],
    )).toEqual({ status: "blocked", decisions: [] });
  });
});
