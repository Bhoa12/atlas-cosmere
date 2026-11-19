import { ed25519 } from "@noble/curves/ed25519.js";
import type {
  HoidEd25519VerificationPort,
  HoidEd25519VerificationRequest,
} from "./editorialReviewSignatures";

export type HoidNobleUtf8EncoderPort = (value: string) => Uint8Array;

function utf8Bytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

function decodeLowerHex(value: string, expectedBytes: number): Uint8Array | null {
  if (value.length !== expectedBytes * 2 || !/^[a-f0-9]+$/.test(value)) return null;
  const output = new Uint8Array(expectedBytes);
  for (let index = 0; index < expectedBytes; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function canonicalRequest(value: unknown): HoidEd25519VerificationRequest | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 3 ||
      !keys.includes("publicKeyHex") ||
      !keys.includes("message") ||
      !keys.includes("signatureHex")
    ) return null;

    const read = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return undefined;
      return descriptor.value;
    };
    const publicKeyHex = read("publicKeyHex");
    const message = read("message");
    const signatureHex = read("signatureHex");
    if (
      typeof publicKeyHex !== "string" ||
      !/^[a-f0-9]{64}$/.test(publicKeyHex) ||
      typeof message !== "string" ||
      message.length > 32_768 ||
      typeof signatureHex !== "string" ||
      !/^[a-f0-9]{128}$/.test(signatureHex)
    ) return null;
    return Object.freeze({ publicKeyHex, message, signatureHex });
  } catch {
    return null;
  }
}

/**
 * Pure-JavaScript Ed25519 verification for React Native/Hermes hosts.
 *
 * This adapter verifies public-key signatures only. It never generates keys,
 * signs payloads, reads secure storage, or accesses a random-number source.
 * The host must still provision the root public key out of band.
 */
export function createHoidNobleEd25519VerificationPort(
  encodeUtf8: HoidNobleUtf8EncoderPort = utf8Bytes,
): HoidEd25519VerificationPort {
  return Object.freeze({
    async verify(requestInput: HoidEd25519VerificationRequest): Promise<boolean> {
      const request = canonicalRequest(requestInput);
      if (!request) return false;
      try {
        const publicKey = decodeLowerHex(request.publicKeyHex, 32);
        const signature = decodeLowerHex(request.signatureHex, 64);
        if (!publicKey || !signature) return false;
        const message = encodeUtf8(request.message);
        if (!(message instanceof Uint8Array)) return false;
        // RFC 8032 strict verification; do not accept ZIP-215 relaxed encodings.
        return ed25519.verify(signature, message, publicKey, { zip215: false });
      } catch {
        return false;
      }
    },
  });
}
