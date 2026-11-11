import {
  resolveSpoilerGate,
  type SpoilerContent,
  type SpoilerGateResult,
} from './antiSpoilerPolicy';
import { validateReadingUnitRegistry } from './readingUnitRegistry';

/**
 * Resolves generic gated content against a validated technical reading-unit
 * registry. This boundary validates IDs only and deliberately knows nothing
 * about narrative facts or editorial structure.
 */
export type RegistrySpoilerGateResult<T> =
  | SpoilerGateResult<T>
  | { status: 'blocked'; reason: 'invalid_registry' | 'unknown_required_unit' };

export function resolveRegistrySpoilerGate<T>(
  content: unknown,
  completedUnitIds: unknown,
  registry: unknown,
): RegistrySpoilerGateResult<T> {
  const registryResult = validateReadingUnitRegistry(registry);
  if (registryResult.status !== 'valid') {
    return { status: 'blocked', reason: 'invalid_registry' };
  }

  if (!content || typeof content !== 'object') {
    return { status: 'blocked', reason: 'invalid_content' };
  }

  const candidate = content as Partial<SpoilerContent<T>>;
  if (!Array.isArray(candidate.requiredUnitIds)) {
    return { status: 'blocked', reason: 'invalid_content' };
  }

  const knownUnitIds = new Set(registryResult.units.map((unit) => unit.id));
  for (const unitId of candidate.requiredUnitIds) {
    if (typeof unitId !== 'string' || unitId.length === 0 || unitId.trim() !== unitId) {
      return { status: 'blocked', reason: 'invalid_content' };
    }
    if (!knownUnitIds.has(unitId)) {
      return { status: 'blocked', reason: 'unknown_required_unit' };
    }
  }

  return resolveSpoilerGate<T>(content, completedUnitIds);
}
