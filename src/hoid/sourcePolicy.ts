import { isKnownHoidSource } from "./bibliography";

export type VerifiedSourceRef = {
  sourceId: string;
  chapter?: number;
};

/**
 * Source references are metadata only. Unknown or unverifiable references fail
 * closed and must not be represented as evidence in a Hoid answer.
 */
export function isUsableVerifiedSourceRef(ref: VerifiedSourceRef): boolean {
  return isKnownHoidSource(ref.sourceId)
    && (ref.chapter === undefined || (Number.isInteger(ref.chapter) && ref.chapter > 0));
}
