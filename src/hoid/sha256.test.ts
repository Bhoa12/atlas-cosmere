import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256";

describe("portable SHA-256", () => {
  it("matches the standard empty-string vector", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("matches the standard ASCII vector", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("encodes Spanish accents and supplementary Unicode as UTF-8", () => {
    expect(sha256Hex("Hoid — Cosmere 🌌")).toBe("bc1034f38b7a2591b42e8bfc920caedec37424fc507c27ee427d4dba3e5b7254");
  });
});
