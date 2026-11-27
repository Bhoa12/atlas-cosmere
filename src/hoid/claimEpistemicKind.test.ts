import { describe, expect, it } from "vitest";
import {
  classifyHoidClaimEpistemicKind,
  labelHoidClaimEpistemicKind,
} from "./claimEpistemicKind";

describe("Hoid claim epistemic classification", () => {
  it("distinguishes evidence-backed editorial assertions from interpretations", () => {
    expect(classifyHoidClaimEpistemicKind("explain", "event"))
      .toBe("evidence-backed-assertion");
    expect(classifyHoidClaimEpistemicKind("context", "interpretation"))
      .toBe("editorial-interpretation");
  });

  it("treats recommendation intent as a recommendation, not a factual assertion", () => {
    expect(classifyHoidClaimEpistemicKind("recommend", "event"))
      .toBe("reader-recommendation");
    expect(classifyHoidClaimEpistemicKind("recommend", undefined))
      .toBe("reader-recommendation");
  });

  it("does not silently classify legacy claims without assertionKind as facts", () => {
    expect(classifyHoidClaimEpistemicKind("explain", undefined))
      .toBe("unclassified");
    expect(classifyHoidClaimEpistemicKind(undefined, undefined))
      .toBe("unclassified");
  });

  it("rejects unknown intent or assertion metadata", () => {
    expect(classifyHoidClaimEpistemicKind("invent", "event")).toBeNull();
    expect(classifyHoidClaimEpistemicKind("explain", "rumour")).toBeNull();
  });

  it("uses explicit Spanish labels that do not overstate factual certainty", () => {
    expect(labelHoidClaimEpistemicKind("evidence-backed-assertion"))
      .toBe("AFIRMACIÓN EDITORIAL CON EVIDENCIAS");
    expect(labelHoidClaimEpistemicKind("editorial-interpretation"))
      .toBe("INTERPRETACIÓN EDITORIAL");
    expect(labelHoidClaimEpistemicKind("reader-recommendation"))
      .toBe("RECOMENDACIÓN PARA EL LECTOR");
    expect(labelHoidClaimEpistemicKind("unclassified"))
      .toBe("TIPO DE AFIRMACIÓN SIN CLASIFICAR");
  });
});
