/**
 * Technical registry for reader-visible content gates.
 *
 * This module intentionally stores no narrative text. It models only
 * identifiers and prerequisites so editorial content can remain outside
 * the runtime boundary until it has a verified source.
 */

export type CanonicalId = string;

export interface ReadingGate {
  readonly id: CanonicalId;
  readonly workId: CanonicalId;
  readonly requiredUnitIds: readonly CanonicalId[];
}

export type ReadingGateValidation =
  | { readonly ok: true; readonly gate: ReadingGate }
  | { readonly ok: false; readonly reason: string };

const canonicalId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateReadingGate(gate: ReadingGate): ReadingGateValidation {
  if (!canonicalId.test(gate.id) || !canonicalId.test(gate.workId)) {
    return { ok: false, reason: "non-canonical-id" };
  }

  if (gate.requiredUnitIds.some((id) => !canonicalId.test(id))) {
    return { ok: false, reason: "non-canonical-unit-id" };
  }

  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) {
    return { ok: false, reason: "duplicate-required-unit" };
  }

  return { ok: true, gate };
}
