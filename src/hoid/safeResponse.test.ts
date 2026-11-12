import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_RESPONSE_CLAIMS,
  verifyHoidResponse,
} from "./safeResponse";

describe("verifyHoidResponse", () => {
  const authorized = new Set(["mistborn:1:summary", "roshar:2:summary"]);

  it("accepts only claims backed by authorized evidence", () => {
    const result = verifyHoidResponse({
      claims: [{ text: "Una explicación respaldada.", evidenceIds: ["mistborn:1:summary"] }],
    }, authorized);

    expect(result.status).toBe("authorized");
    expect(result.text).toBe("Una explicación respaldada.");
    expect(result.acceptedEvidenceIds).toEqual(["mistborn:1:summary"]);
  });

  it("limits a mixed proposal instead of exposing unsupported prose", () => {
    const result = verifyHoidResponse({
      claims: [
        { text: "Contenido respaldado.", evidenceIds: ["mistborn:1:summary"] },
        { text: "Contenido no respaldado.", evidenceIds: ["future:event"] },
      ],
    }, authorized);

    expect(result.status).toBe("limited");
    expect(result.text).toBe("Contenido respaldado.");
    expect(result.text).not.toContain("no respaldado");
  });

  it("blocks a proposal when every claim lacks authorized evidence", () => {
    const result = verifyHoidResponse({
      claims: [{ text: "No debe mostrarse.", evidenceIds: ["future:event"] }],
    }, authorized);

    expect(result.status).toBe("blocked");
    expect(result.text).toBe("");
  });

  it("fails closed for oversized claim batches", () => {
    const result = verifyHoidResponse({
      claims: Array.from({ length: DEFAULT_MAX_RESPONSE_CLAIMS + 1 }, () => ({
        text: "x", evidenceIds: ["mistborn:1:summary"],
      })),
    }, authorized);

    expect(result.status).toBe("abstain");
    expect(result.text).toBe("");
  });
});
