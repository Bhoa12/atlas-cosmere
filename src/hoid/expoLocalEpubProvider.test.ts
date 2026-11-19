import { describe, expect, it } from "vitest";
import {
  createHoidExpoLocalEpubProvider,
  HOID_EXPO_EPUB_SOURCE_LIMITS,
} from "./expoLocalEpubProvider";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    output += ALPHABET[a >>> 2];
    output += ALPHABET[((a & 3) << 4) | (b >>> 4)];
    output += hasB ? ALPHABET[((b & 15) << 2) | (c >>> 6)] : "=";
    output += hasC ? ALPHABET[c & 63] : "=";
  }
  return output;
}

function makeProvider(bytes: Uint8Array, overrides: Readonly<Record<string, unknown>> = {}) {
  let pickerOptions: unknown;
  const reads: Array<Readonly<{ position: number; length: number }>> = [];
  let deleted = false;
  let currentModificationTime = 100;
  const picker = {
    async getDocumentAsync(options: unknown) {
      pickerOptions = options;
      return overrides.pickerResult ?? {
        canceled: false,
        assets: [{ name: "cosmere.epub", uri: "file:///cache/cosmere.epub", size: bytes.byteLength }],
      };
    },
  };
  const fileSystem = {
    cacheDirectory: "file:///cache/",
    async getInfoAsync() {
      return overrides.fileInfo ?? {
        exists: true,
        isDirectory: false,
        size: bytes.byteLength,
        modificationTime: currentModificationTime,
      };
    },
    async readAsStringAsync(_uri: string, options: { position: number; length: number }) {
      reads.push(Object.freeze({ position: options.position, length: options.length }));
      return encodeBase64(bytes.slice(options.position, options.position + options.length));
    },
    async deleteAsync() {
      deleted = true;
    },
  };
  const provider = createHoidExpoLocalEpubProvider({
    picker,
    fileSystem,
    createSourceId: () => "fixture-source",
  });
  return {
    provider,
    getPickerOptions: () => pickerOptions,
    reads,
    isDeleted: () => deleted,
    changeModificationTime: () => { currentModificationTime += 1; },
  };
}

describe("Expo local EPUB source provider", () => {
  it("picks one EPUB into the app cache and exposes metadata without its URI", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fixture = makeProvider(bytes);
    const result = await fixture.provider.pickEpub();
    expect(result).toEqual({
      status: "selected",
      source: { sourceId: "fixture-source", displayName: "cosmere.epub", byteLength: 4 },
    });
    expect(fixture.getPickerOptions()).toEqual({
      type: "*/*",
      multiple: false,
      copyToCacheDirectory: true,
    });
    expect(JSON.stringify(result)).not.toContain("file://");
  });

  it("returns cancellation without registering a source", async () => {
    const fixture = makeProvider(new Uint8Array([1]), {
      pickerResult: { canceled: true, assets: null },
    });
    await expect(fixture.provider.pickEpub()).resolves.toEqual({ status: "cancelled" });
    await expect(fixture.provider.resolveRangeSource("fixture-source")).resolves.toBeNull();
  });

  it("rejects non-EPUB extensions", async () => {
    const fixture = makeProvider(new Uint8Array([1]), {
      pickerResult: {
        canceled: false,
        assets: [{ name: "book.pdf", uri: "file:///cache/book.pdf", size: 1 }],
      },
    });
    await expect(fixture.provider.pickEpub()).resolves.toEqual({
      status: "rejected",
      reason: "unsupported-file",
    });
    expect(fixture.isDeleted()).toBe(true);
  });

  it("rejects files larger than the configured archive bound", async () => {
    const fixture = makeProvider(new Uint8Array([1]), {
      fileInfo: {
        exists: true,
        isDirectory: false,
        size: HOID_EXPO_EPUB_SOURCE_LIMITS.maxArchiveBytes + 1,
        modificationTime: 100,
      },
    });
    await expect(fixture.provider.pickEpub()).resolves.toEqual({
      status: "rejected",
      reason: "file-too-large",
    });
  });

  it("reads large ranges in bounded Base64 chunks", async () => {
    const bytes = new Uint8Array(100_000);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
    const fixture = makeProvider(bytes);
    const picked = await fixture.provider.pickEpub();
    expect(picked.status).toBe("selected");
    if (picked.status !== "selected") return;
    const source = await fixture.provider.resolveRangeSource(picked.source.sourceId);
    expect(source).not.toBeNull();
    const range = await source!.readRange(0, bytes.length);
    expect(range).toEqual(bytes);
    expect(fixture.reads.length).toBeGreaterThan(1);
    expect(Math.max(...fixture.reads.map(read => read.length))).toBeLessThanOrEqual(
      HOID_EXPO_EPUB_SOURCE_LIMITS.readChunkBytes,
    );
  });

  it("detects a file changed after selection", async () => {
    const fixture = makeProvider(new Uint8Array([1, 2, 3]));
    const picked = await fixture.provider.pickEpub();
    expect(picked.status).toBe("selected");
    if (picked.status !== "selected") return;
    fixture.changeModificationTime();
    await expect(fixture.provider.resolveRangeSource(picked.source.sourceId)).rejects.toThrow("source-changed");
  });

  it("releases source mappings and only deletes cache-owned copies", async () => {
    const fixture = makeProvider(new Uint8Array([1, 2, 3]));
    const picked = await fixture.provider.pickEpub();
    expect(picked.status).toBe("selected");
    if (picked.status !== "selected") return;
    await fixture.provider.release(picked.source.sourceId);
    expect(fixture.isDeleted()).toBe(true);
    await expect(fixture.provider.resolveRangeSource(picked.source.sourceId)).resolves.toBeNull();
  });

  it("does not delete an external provider URI on release", async () => {
    const fixture = makeProvider(new Uint8Array([1, 2, 3]), {
      pickerResult: {
        canceled: false,
        assets: [{ name: "cosmere.epub", uri: "content://provider/document/1", size: 3 }],
      },
    });
    const picked = await fixture.provider.pickEpub();
    expect(picked.status).toBe("selected");
    if (picked.status !== "selected") return;
    await fixture.provider.release(picked.source.sourceId);
    expect(fixture.isDeleted()).toBe(false);
  });
});
