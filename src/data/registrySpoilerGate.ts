import { resolveSpoilerGate, type SpoilerContent, type SpoilerGateResult } from './antiSpoilerPolicy';
import { validateReadingUnitRegistry } from './readingUnitRegistry';

export type RegistrySpoilerGateResult<T> =
  | SpoilerGateResult<T>
  | { status: 'blocked'; reason: 'invalid_registry' | 'unknown_required_unit' | 'invalid_completed_units' | 'unknown_completed_unit' };

export function resolveRegistrySpoilerGate<T>(content: unknown, completedUnitIds: unknown, registry: unknown): RegistrySpoilerGateResult<T> {
  const registryResult = validateReadingUnitRegistry(registry);
  if (registryResult.status !== 'valid') return { status: 'blocked', reason: 'invalid_registry' };
  if (!Array.isArray(completedUnitIds)) return { status: 'blocked', reason: 'invalid_completed_units' };

  const knownUnitIds = new Set(registryResult.units.map((unit) => unit.id));
  const completedIds = new Set<string>();
  for (const unitId of completedUnitIds) {
    if (typeof unitId !== 'string' || unitId.length === 0 || unitId.trim() !== unitId || completedIds.has(unitId)) {
      return { status: 'blocked', reason: 'invalid_completed_units' };
    }
    if (!knownUnitIds.has(unitId)) return { status: 'blocked', reason: 'unknown_completed_unit' };
    completedIds.add(unitId);
  }

  if (!content || typeof content !== 'object') return { status: 'blocked', reason: 'invalid_content' };
  const candidate = content as Partial<SpoilerContent<T>>;
  if (!Array.isArray(candidate.requiredUnitIds)) return { status: 'blocked', reason: 'invalid_content' };

  for (const unitId of candidate.requiredUnitIds) {
    if (typeof unitId !== 'string' || unitId.length === 0 || unitId.trim() !== unitId) return { status: 'blocked', reason: 'invalid_content' };
    if (!knownUnitIds.has(unitId)) return { status: 'blocked', reason: 'unknown_required_unit' };
  }
  return resolveSpoilerGate<T>(content, completedUnitIds);
}
