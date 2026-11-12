/**
 * Technical registry for Cosmere world identifiers.
 *
 * The registry is intentionally independent from the bibliographic catalog.
 * A world entry is an addressable namespace only: it does not prove that a
 * particular work belongs to that world, establish chronology, or expose
 * narrative facts. Work-to-world links remain unavailable until supported by
 * verified project metadata.
 */

export type WorldRegistryEntry = {
  id: string;
  label: string;
};

export const COSMERE_WORLD_REGISTRY: readonly WorldRegistryEntry[] = [
  { id: 'scadrial', label: 'Scadrial' },
  { id: 'sel', label: 'Sel' },
  { id: 'nalthis', label: 'Nalthis' },
  { id: 'taldain', label: 'Taldain' },
  { id: 'roshar', label: 'Roshar' },
] as const;

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

/**
 * Resolves only an explicitly registered technical world identifier.
 * Unknown or malformed identifiers fail closed with undefined.
 */
export function resolveRegisteredWorld(id: unknown): WorldRegistryEntry | undefined {
  if (!isCanonicalId(id)) return undefined;
  return COSMERE_WORLD_REGISTRY.find((world) => world.id === id);
}

/**
 * Validates a collection of world IDs without inferring assignments.
 *
 * Empty collections are valid: absence of an assignment is distinct from an
 * unknown assignment. Duplicate or unregistered IDs block validation.
 */
export type WorldIdCollectionResult =
  | { status: 'valid'; worldIds: readonly string[] }
  | { status: 'blocked'; reason: 'invalid_world_ids' | 'unknown_world' };

export function validateWorldIdCollection(input: unknown): WorldIdCollectionResult {
  if (!Array.isArray(input)) {
    return { status: 'blocked', reason: 'invalid_world_ids' };
  }

  const seen = new Set<string>();
  for (const value of input) {
    if (!isCanonicalId(value) || seen.has(value)) {
      return { status: 'blocked', reason: 'invalid_world_ids' };
    }
    seen.add(value);

    if (!resolveRegisteredWorld(value)) {
      return { status: 'blocked', reason: 'unknown_world' };
    }
  }

  return { status: 'valid', worldIds: input };
}
