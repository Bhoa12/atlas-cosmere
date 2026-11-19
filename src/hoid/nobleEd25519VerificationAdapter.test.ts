import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";

function bytesFromHex(value: string): Uint8Array {
  return new Uint8Array(value.match(/.{2}/g)?.map(part => Number.parseInt(part, 16)) ?? []);
}

function hexFromBytes(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

describe("Hoid Noble Ed25519 verification adapter", () => {
  it("verifies the RFC 8032 empty-message vector and rejects a changed message", async () => {
    const verifier = createHoidNobleEd25519VerificationPort();
    const vector = {
      publicKeyHex: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
      signatureHex:
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
        "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    };
    expect(await verifier.verify({ ...vector, message: "" })).toBe(true);
    expect(await verifier.verify({ ...vector, message: "changed" })).toBe(false);
  });

  it("verifies Unicode UTF-8 payloads without WebCrypto or random-number APIs", async () => {
    const seed = bytesFromHex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb");
    const publicKey = ed25519.getPublicKey(seed);
    const message = "Hoid · revisión editorial · capítulo 12";
    const signature = ed25519.sign(new TextEncoder().encode(message), seed);
    const verifier = createHoidNobleEd25519VerificationPort();
    expect(await verifier.verify({
      publicKeyHex: hexFromBytes(publicKey),
      message,
      signatureHex: hexFromBytes(signature),
    })).toBe(true);
  });

  it("rejects malformed lengths, uppercase hex and extra object properties", async () => {
    const verifier = createHoidNobleEd25519VerificationPort();
    const valid = {
      publicKeyHex: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
      signatureHex:
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
        "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
      message: "",
    };
    expect(await verifier.verify({ ...valid, publicKeyHex: valid.publicKeyHex.slice(2) })).toBe(false);
    expect(await verifier.verify({ ...valid, signatureHex: valid.signatureHex.toUpperCase() })).toBe(false);
    expect(await verifier.verify({ ...valid, unexpected: true } as never)).toBe(false);
  });

  it("does not invoke accessor properties while reading verification requests", async () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "publicKeyHex", {
      enumerable: true,
      get() { invoked = true; return "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"; },
    });
    Object.defineProperty(hostile, "message", { enumerable: true, value: "" });
    Object.defineProperty(hostile, "signatureHex", {
      enumerable: true,
      value:
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
        "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    });
    const verifier = createHoidNobleEd25519VerificationPort();
    expect(await verifier.verify(hostile as never)).toBe(false);
    expect(invoked).toBe(false);
  });

  it("fails closed when the injected UTF-8 encoder throws or returns a non-byte value", async () => {
    const seed = bytesFromHex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb");
    const publicKey = ed25519.getPublicKey(seed);
    const message = "payload";
    const signature = ed25519.sign(new TextEncoder().encode(message), seed);
    const request = {
      publicKeyHex: hexFromBytes(publicKey),
      message,
      signatureHex: hexFromBytes(signature),
    };
    expect(await createHoidNobleEd25519VerificationPort(() => {
      throw new Error("encoder unavailable");
    }).verify(request)).toBe(false);
    expect(await createHoidNobleEd25519VerificationPort(() => "invalid" as never).verify(request)).toBe(false);
  });
});
