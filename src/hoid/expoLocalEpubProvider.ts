import { HOID_EPUB_INGESTION_LIMITS } from "./epubIngestion";
import type { HoidEpubRandomAccessSource } from "./epubRangeRuntimeAdapters";

export const HOID_EXPO_EPUB_SOURCE_LIMITS = Object.freeze({
  maxArchiveBytes: HOID_EPUB_INGESTION_LIMITS.maxArchiveBytes,
  readChunkBytes: 48 * 1024,
  maxRangeBytes: 16 * 1024 * 1024,
});

export type HoidExpoPickedSource = Readonly<{
  sourceId: string;
  displayName: string;
  byteLength: number;
}>;

export type HoidExpoPickResult =
  | Readonly<{ status: "selected"; source: HoidExpoPickedSource }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{
      status: "rejected";
      reason: "picker-failed" | "invalid-selection" | "unsupported-file" | "file-unavailable" | "file-too-large";
    }>;

export interface HoidExpoDocumentPickerPort {
  getDocumentAsync(options: Readonly<{
    type: string;
    multiple: false;
    copyToCacheDirectory: true;
  }>): Promise<unknown>;
}

export interface HoidExpoFileSystemPort {
  readonly cacheDirectory: string | null;
  getInfoAsync(uri: string, options: Readonly<{ size: true }>): Promise<unknown>;
  readAsStringAsync(uri: string, options: Readonly<{
    encoding: "base64";
    position: number;
    length: number;
  }>): Promise<string>;
  deleteAsync(uri: string, options: Readonly<{ idempotent: true }>): Promise<void>;
}

type RegisteredSource = Readonly<{
  uri: string;
  displayName: string;
  size: number;
  modificationTime: number | null;
}>;

function exactInfo(value: unknown): value is Readonly<{
  exists: true;
  isDirectory: false;
  size: number;
  modificationTime?: number;
}> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.exists === true &&
    record.isDirectory === false &&
    Number.isSafeInteger(record.size) &&
    (record.size as number) > 0 &&
    (record.modificationTime === undefined ||
      (typeof record.modificationTime === "number" && Number.isFinite(record.modificationTime)));
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function throwIfAborted(signal?: AbortSignal): void {
  try {
    if (signal?.aborted === true) throw new Error("cancelled");
  } catch {
    throw new Error("cancelled");
  }
}

function decodeBase64(value: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) throw new Error("Local file returned malformed Base64 data");

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputOffset = 0;
  for (let offset = 0; offset < value.length; offset += 4) {
    const a = BASE64_ALPHABET.indexOf(value[offset]);
    const b = BASE64_ALPHABET.indexOf(value[offset + 1]);
    const c = value[offset + 2] === "=" ? 0 : BASE64_ALPHABET.indexOf(value[offset + 2]);
    const d = value[offset + 3] === "=" ? 0 : BASE64_ALPHABET.indexOf(value[offset + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error("Local file returned malformed Base64 data");
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputOffset < output.length) output[outputOffset++] = (combined >>> 16) & 0xff;
    if (outputOffset < output.length) output[outputOffset++] = (combined >>> 8) & 0xff;
    if (outputOffset < output.length) output[outputOffset++] = combined & 0xff;
  }
  return output;
}

export interface HoidExpoLocalEpubProvider {
  pickEpub(): Promise<HoidExpoPickResult>;
  resolveRangeSource(sourceId: string, signal?: AbortSignal): Promise<HoidEpubRandomAccessSource | null>;
  release(sourceId: string): Promise<void>;
  releaseAll(): Promise<void>;
}

export function createHoidExpoLocalEpubProvider(dependencies: Readonly<{
  picker: HoidExpoDocumentPickerPort;
  fileSystem: HoidExpoFileSystemPort;
  createSourceId?: () => string;
}>): HoidExpoLocalEpubProvider {
  const sources = new Map<string, RegisteredSource>();
  let nextId = 0;

  const createSourceId = dependencies.createSourceId ?? (() => {
    nextId += 1;
    return "hoid-epub-local-" + nextId.toString(36);
  });

  async function readInfo(
    uri: string,
    signal?: AbortSignal,
  ): Promise<Readonly<{ size: number; modificationTime: number | null }>> {
    throwIfAborted(signal);
    const raw = await dependencies.fileSystem.getInfoAsync(uri, { size: true });
    throwIfAborted(signal);
    if (!exactInfo(raw)) throw new Error("Local EPUB file is unavailable");
    return Object.freeze({
      size: raw.size,
      modificationTime: typeof raw.modificationTime === "number" ? raw.modificationTime : null,
    });
  }

  async function deleteCacheOwnedUri(uri: string): Promise<void> {
    const cacheDirectory = dependencies.fileSystem.cacheDirectory;
    if (typeof cacheDirectory !== "string" || cacheDirectory.length === 0) return;
    const prefix = cacheDirectory.endsWith("/") ? cacheDirectory : cacheDirectory + "/";
    if (!uri.startsWith(prefix)) return;
    try {
      await dependencies.fileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // Cache cleanup is best-effort; no URI or file contents are exposed.
    }
  }

  async function release(sourceId: string): Promise<void> {
    const source = sources.get(sourceId);
    if (source === undefined) return;
    sources.delete(sourceId);
    await deleteCacheOwnedUri(source.uri);
  }

  return Object.freeze({
    async pickEpub(): Promise<HoidExpoPickResult> {
      let picked: unknown;
      try {
        picked = await dependencies.picker.getDocumentAsync({
          type: "*/*",
          multiple: false,
          copyToCacheDirectory: true,
        });
      } catch {
        return Object.freeze({ status: "rejected", reason: "picker-failed" });
      }

      if (typeof picked !== "object" || picked === null || Array.isArray(picked)) {
        return Object.freeze({ status: "rejected", reason: "invalid-selection" });
      }
      const result = picked as Record<string, unknown>;
      if (result.canceled === true) return Object.freeze({ status: "cancelled" });
      if (result.canceled !== false || !Array.isArray(result.assets) || result.assets.length !== 1) {
        return Object.freeze({ status: "rejected", reason: "invalid-selection" });
      }

      const asset = result.assets[0] as Record<string, unknown> | null;
      if (asset === null || typeof asset !== "object") {
        return Object.freeze({ status: "rejected", reason: "invalid-selection" });
      }
      const assetUri = typeof asset.uri === "string" && asset.uri.length > 0 && asset.uri.length <= 4096
        ? asset.uri
        : null;
      if (
        typeof asset.name !== "string" ||
        asset.name.length === 0 ||
        asset.name.length > 255 ||
        !/\.epub$/i.test(asset.name) ||
        assetUri === null
      ) {
        if (assetUri !== null) await deleteCacheOwnedUri(assetUri);
        return Object.freeze({ status: "rejected", reason: "unsupported-file" });
      }

      let info: Readonly<{ size: number; modificationTime: number | null }>;
      try {
        info = await readInfo(assetUri);
      } catch {
        await deleteCacheOwnedUri(assetUri);
        return Object.freeze({ status: "rejected", reason: "file-unavailable" });
      }
      if (info.size > HOID_EXPO_EPUB_SOURCE_LIMITS.maxArchiveBytes) {
        await deleteCacheOwnedUri(assetUri);
        return Object.freeze({ status: "rejected", reason: "file-too-large" });
      }
      if (
        asset.size !== undefined &&
        (typeof asset.size !== "number" || !Number.isSafeInteger(asset.size) || asset.size !== info.size)
      ) {
        await deleteCacheOwnedUri(assetUri);
        return Object.freeze({ status: "rejected", reason: "file-unavailable" });
      }

      const sourceId = createSourceId();
      if (typeof sourceId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(sourceId) || sources.has(sourceId)) {
        await deleteCacheOwnedUri(assetUri);
        return Object.freeze({ status: "rejected", reason: "invalid-selection" });
      }
      sources.set(sourceId, Object.freeze({
        uri: assetUri,
        displayName: asset.name,
        size: info.size,
        modificationTime: info.modificationTime,
      }));
      return Object.freeze({
        status: "selected",
        source: Object.freeze({
          sourceId,
          displayName: asset.name,
          byteLength: info.size,
        }),
      });
    },

    async resolveRangeSource(sourceId: string, signal?: AbortSignal): Promise<HoidEpubRandomAccessSource | null> {
      throwIfAborted(signal);
      const registered = sources.get(sourceId);
      if (registered === undefined) return null;

      const initialInfo = await readInfo(registered.uri, signal);
      throwIfAborted(signal);
      if (
        initialInfo.size !== registered.size ||
        (registered.modificationTime !== null &&
          initialInfo.modificationTime !== null &&
          initialInfo.modificationTime !== registered.modificationTime)
      ) throw new Error("source-changed");

      return Object.freeze({
        size: registered.size,
        async readRange(offset: number, length: number, signal?: AbortSignal): Promise<Uint8Array> {
          throwIfAborted(signal);
          if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(length) ||
            offset < 0 ||
            length < 0 ||
            offset + length > registered.size ||
            length > HOID_EXPO_EPUB_SOURCE_LIMITS.maxRangeBytes
          ) throw new Error("Local EPUB range is invalid");

          const currentInfo = await readInfo(registered.uri, signal);
          throwIfAborted(signal);
          if (
            currentInfo.size !== registered.size ||
            (registered.modificationTime !== null &&
              currentInfo.modificationTime !== null &&
              currentInfo.modificationTime !== registered.modificationTime)
          ) throw new Error("source-changed");

          const output = new Uint8Array(length);
          let outputOffset = 0;
          while (outputOffset < length) {
            throwIfAborted(signal);
            if (sources.get(sourceId) !== registered) throw new Error("source-released");
            const chunkLength = Math.min(
              HOID_EXPO_EPUB_SOURCE_LIMITS.readChunkBytes,
              length - outputOffset,
            );
            const encoded = await dependencies.fileSystem.readAsStringAsync(registered.uri, {
              encoding: "base64",
              position: offset + outputOffset,
              length: chunkLength,
            });
            throwIfAborted(signal);
            const decoded = decodeBase64(encoded);
            if (decoded.byteLength !== chunkLength) {
              throw new Error("Local EPUB range returned an unexpected byte count");
            }
            output.set(decoded, outputOffset);
            outputOffset += decoded.byteLength;
          }
          throwIfAborted(signal);
          if (sources.get(sourceId) !== registered) throw new Error("source-released");
          const finalInfo = await readInfo(registered.uri, signal);
          throwIfAborted(signal);
          if (
            finalInfo.size !== registered.size ||
            (registered.modificationTime !== null &&
              finalInfo.modificationTime !== null &&
              finalInfo.modificationTime !== registered.modificationTime)
          ) throw new Error("source-changed");
          throwIfAborted(signal);
          return output;
        },
      });
    },

    release,

    async releaseAll(): Promise<void> {
      for (const sourceId of [...sources.keys()]) await release(sourceId);
    },
  });
}
