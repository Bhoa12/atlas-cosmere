import { describe, expect, it } from "vitest";
import {
  buildHoidAnswerScopeSelection,
  fingerprintHoidAnswerScopeSelection,
  toggleHoidAnswerScopeBook,
} from "./answerScopeSelection";

describe("Hoid answer-scope screen selection", () => {
  it("keeps automatic mode unscoped", () => {
    const result = buildHoidAnswerScopeSelection("automatic", []);
    expect(result).toEqual({ status: "unscoped" });
    expect(fingerprintHoidAnswerScopeSelection(result)).toBe("automatic");
  });

  it("requires exactly one known work for single-work mode", () => {
    expect(buildHoidAnswerScopeSelection("single-work", []).status).toBe("incomplete");
    expect(buildHoidAnswerScopeSelection("single-work", ["tfe", "woa"]).status).toBe("incomplete");
    expect(buildHoidAnswerScopeSelection("single-work", ["tfe"])).toEqual({
      status: "ready",
      scope: { mode: "single-work", bookIds: ["tfe"] },
    });
  });

  it("requires two to four known works for cross-work mode", () => {
    const tooFew = buildHoidAnswerScopeSelection("cross-work", ["twok"]);
    expect(tooFew).toEqual({ status: "incomplete", reason: "two-to-four-works-required" });
    const tooMany = buildHoidAnswerScopeSelection("cross-work", ["twok", "edgedancer", "tfe", "elantris", "woa"]);
    expect(tooMany).toEqual({ status: "incomplete", reason: "two-to-four-works-required" });
    expect(buildHoidAnswerScopeSelection("cross-work", ["edgedancer", "twok"])).toEqual({
      status: "ready",
      scope: { mode: "cross-work", bookIds: ["edgedancer", "twok"] },
    });
  });

  it("rejects duplicate and unknown work IDs", () => {
    expect(buildHoidAnswerScopeSelection("cross-work", ["twok", "twok"]))
      .toEqual({ status: "incomplete", reason: "invalid-selection" });
    expect(buildHoidAnswerScopeSelection("single-work", ["unknown-work"]))
      .toEqual({ status: "incomplete", reason: "invalid-selection" });
  });

  it("rejects sparse and accessor-backed selections without executing getters", () => {
    expect(buildHoidAnswerScopeSelection("single-work", new Array(1)))
      .toEqual({ status: "incomplete", reason: "invalid-selection" });
    let invoked = false;
    const ids = ["tfe"];
    Object.defineProperty(ids, "0", {
      enumerable: true,
      configurable: true,
      get: () => { invoked = true; return "tfe"; },
    });
    expect(buildHoidAnswerScopeSelection("single-work", ids))
      .toEqual({ status: "incomplete", reason: "invalid-selection" });
    expect(invoked).toBe(false);
  });

  it("replaces the previous choice in single-work mode", () => {
    const first = toggleHoidAnswerScopeBook({ mode: "single-work", bookIds: [] }, "tfe");
    expect(first.bookIds).toEqual(["tfe"]);
    const second = toggleHoidAnswerScopeBook(first, "elantris");
    expect(second.bookIds).toEqual(["elantris"]);
  });

  it("toggles cross-work choices and preserves canonical order at build time", () => {
    let selection = toggleHoidAnswerScopeBook({ mode: "cross-work", bookIds: [] }, "twok");
    selection = toggleHoidAnswerScopeBook(selection, "edgedancer");
    expect(selection.bookIds).toEqual(["twok", "edgedancer"]);
    expect(buildHoidAnswerScopeSelection(selection.mode, selection.bookIds)).toEqual({
      status: "ready",
      scope: { mode: "cross-work", bookIds: ["edgedancer", "twok"] },
    });
    selection = toggleHoidAnswerScopeBook(selection, "twok");
    expect(selection.bookIds).toEqual(["edgedancer"]);
  });

  it("caps cross-work selection at four works", () => {
    let selection = { mode: "cross-work" as const, bookIds: [] as readonly string[] };
    for (const id of ["tfe", "woa", "hoa", "aol", "sos"]) {
      selection = toggleHoidAnswerScopeBook(selection, id);
    }
    expect(selection.bookIds).toEqual(["tfe", "woa", "hoa", "aol"]);
  });

  it("does not mutate the supplied selection", () => {
    const ids = Object.freeze(["twok"]);
    const selection = Object.freeze({ mode: "cross-work" as const, bookIds: ids });
    const next = toggleHoidAnswerScopeBook(selection, "edgedancer");
    expect(ids).toEqual(["twok"]);
    expect(next.bookIds).toEqual(["twok", "edgedancer"]);
  });

  it("binds a stable identity to the selected scope", () => {
    const result = buildHoidAnswerScopeSelection("cross-work", ["twok", "edgedancer"]);
    expect(fingerprintHoidAnswerScopeSelection(result)).toBe("cross-work:edgedancer,twok");
  });
});
