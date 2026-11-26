/**
 * UI-lifecycle fence for asynchronous local reader-preference operations.
 *
 * It is deliberately not a trust or authorization boundary. It only prevents
 * results from an obsolete screen/store generation from updating current UI.
 */
export type HoidReaderPreferenceOperationToken = object;

type OperationKind = "read" | "write";
type OperationMetadata = Readonly<{
  generation: number;
  id: number;
  kind: OperationKind;
}>;

export type HoidReaderPreferenceOperationFence = Readonly<{
  beginRead(): HoidReaderPreferenceOperationToken;
  tryBeginWrite(): HoidReaderPreferenceOperationToken | null;
  isCurrent(token: unknown): boolean;
  finishWrite(token: unknown): boolean;
  invalidate(): void;
}>;

export function createHoidReaderPreferenceOperationFence():
HoidReaderPreferenceOperationFence {
  let generation = 0;
  let nextId = 0;
  let activeWriteId: number | null = null;
  const metadata = new WeakMap<object, OperationMetadata>();

  const issue = (kind: OperationKind): HoidReaderPreferenceOperationToken => {
    const token = Object.freeze(Object.create(null)) as object;
    const id = ++nextId;
    metadata.set(token, Object.freeze({ generation, id, kind }));
    return token;
  };

  return Object.freeze({
    beginRead(): HoidReaderPreferenceOperationToken {
      return issue("read");
    },

    tryBeginWrite(): HoidReaderPreferenceOperationToken | null {
      if (activeWriteId !== null) return null;
      const token = issue("write");
      const entry = metadata.get(token);
      if (!entry) return null;
      activeWriteId = entry.id;
      return token;
    },

    isCurrent(token: unknown): boolean {
      if (token === null || typeof token !== "object") return false;
      const entry = metadata.get(token);
      return entry !== undefined && entry.generation === generation;
    },

    finishWrite(token: unknown): boolean {
      if (token === null || typeof token !== "object") return false;
      const entry = metadata.get(token);
      if (
        entry === undefined ||
        entry.kind !== "write" ||
        activeWriteId !== entry.id
      ) return false;
      activeWriteId = null;
      return true;
    },

    invalidate(): void {
      generation += 1;
    },
  });
}
