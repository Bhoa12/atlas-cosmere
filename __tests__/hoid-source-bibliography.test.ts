import { isKnownHoidSource } from "../hoid/bibliography";
import { isUsableVerifiedSourceRef } from "../hoid/sourcePolicy";

describe("Hoid source bibliography", () => {
  it("contains the supplied Cosmere and Roshar works as metadata", () => {
    expect(isKnownHoidSource("tfe")).toBe(true);
    expect(isKnownHoidSource("sawt")).toBe(true);
    expect(isKnownHoidSource("unknown-work")).toBe(false);
  });

  it("fails closed for unknown or invalid source references", () => {
    expect(isUsableVerifiedSourceRef({ sourceId: "unknown-work", chapter: 1 })).toBe(false);
    expect(isUsableVerifiedSourceRef({ sourceId: "tfe", chapter: 0 })).toBe(false);
    expect(isUsableVerifiedSourceRef({ sourceId: "tfe", chapter: 1 })).toBe(true);
  });
});
