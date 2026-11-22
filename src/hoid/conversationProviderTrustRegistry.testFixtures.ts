import { ed25519 } from "@noble/curves/ed25519.js";
import {
  buildHoidNativeSecurityTrustRegistrySigningMessage,
  createHoidNativeSecurityProviderTrustRegistryPort,
  type HoidNativeSecurityTrustRegistryRootPin,
} from "./conversationProviderTrustRegistry";

const ROOT_SEED = bytesFromHex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");

export const HOID_TEST_TRUST_ROOT_PIN: HoidNativeSecurityTrustRegistryRootPin = Object.freeze({
  trustDomainId: "atlas.hoid.native",
  rootKeyId: "atlas-native-trust-root-2026",
  appIdentifier: "com.tfg.atlascosmere",
  publicKeyHex: hexFromBytes(ed25519.getPublicKey(ROOT_SEED)),
  minimumRevision: 1,
});

export type TestProviderTrustEntry = Readonly<{
  keyId: string;
  providerId: string;
  platform: "ios" | "android";
  appIdentifier: string;
  publicKeyHex: string;
  state: "active" | "revoked";
}>;

export function bytesFromHex(value: string): Uint8Array {
  return new Uint8Array(value.match(/.{2}/g)?.map(part => Number.parseInt(part, 16)) ?? []);
}

export function hexFromBytes(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function sortKey(entry: TestProviderTrustEntry): string {
  return [
    entry.providerId,
    entry.platform,
    entry.appIdentifier,
    entry.keyId,
  ].join("\u0000");
}

export function createSignedHoidTestTrustRegistry(
  entries: readonly TestProviderTrustEntry[],
  revision = 1,
): string {
  const providerKeys = [...entries].sort((left, right) =>
    sortKey(left) < sortKey(right) ? -1 : sortKey(left) > sortKey(right) ? 1 : 0
  );
  const payload = {
    schemaVersion: 1,
    kind: "hoid-native-provider-trust-registry",
    trustDomainId: HOID_TEST_TRUST_ROOT_PIN.trustDomainId,
    rootKeyId: HOID_TEST_TRUST_ROOT_PIN.rootKeyId,
    revision,
    providerKeys,
  };
  const message = buildHoidNativeSecurityTrustRegistrySigningMessage(payload);
  if (!message) throw new Error("Invalid test trust registry payload");
  const signatureHex = hexFromBytes(
    ed25519.sign(new TextEncoder().encode(message), ROOT_SEED),
  );
  return JSON.stringify({ ...payload, signatureHex });
}

export type TestTrustPortOptions = Readonly<{
  entry?: Partial<TestProviderTrustEntry>;
  revision?: number;
  initialMinimumRevision?: number;
  sourceThrows?: boolean;
  revisionReadThrows?: boolean;
  revisionWriteThrows?: boolean;
}>;

export function createHoidTestNativeSecurityTrustPort(
  options: TestTrustPortOptions = {},
) {
  const defaultEntry: TestProviderTrustEntry = {
    keyId: "atlas-native-root-2026",
    providerId: "atlas.hoid.native",
    platform: "ios",
    appIdentifier: HOID_TEST_TRUST_ROOT_PIN.appIdentifier,
    publicKeyHex: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    state: "active",
  };
  const entry = Object.freeze({ ...defaultEntry, ...options.entry });
  const registry = createSignedHoidTestTrustRegistry([entry], options.revision ?? 1);
  let minimumRevision = options.initialMinimumRevision ?? 1;

  const source = Object.freeze({
    readSignedRegistry: async () => {
      if (options.sourceThrows) throw new Error("registry source unavailable");
      return registry;
    },
  });
  const revisionStore = Object.freeze({
    readMinimumRevision: async (input: { trustDomainId: string }) => {
      if (options.revisionReadThrows) throw new Error("revision witness unavailable");
      if (input.trustDomainId !== HOID_TEST_TRUST_ROOT_PIN.trustDomainId) {
        throw new Error("wrong trust domain");
      }
      return minimumRevision;
    },
    compareAndSetMinimumRevision: async (input: {
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
    }) => {
      if (options.revisionWriteThrows) throw new Error("revision witness unavailable");
      if (
        input.trustDomainId !== HOID_TEST_TRUST_ROOT_PIN.trustDomainId ||
        input.expectedRevision !== minimumRevision ||
        input.nextRevision <= minimumRevision
      ) return false;
      minimumRevision = input.nextRevision;
      return true;
    },
  });

  return createHoidNativeSecurityProviderTrustRegistryPort({
    rootPin: HOID_TEST_TRUST_ROOT_PIN,
    source,
    revisionStore,
  });
}
