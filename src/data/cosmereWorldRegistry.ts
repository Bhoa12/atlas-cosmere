/**
 * Technical world registry for Atlas del Cosmere expansion.
 *
 * This registry contains stable identifiers and display labels only. It does
 * not assert which works belong to a world, editorial chronology, or canon
 * facts. Those links must be added later from verified project sources.
 */

export type CosmereWorld = {
  id: string;
  label: string;
};

export const COSMERE_WORLD_REGISTRY: readonly CosmereWorld[] = [
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
 * Resolves a world only when the runtime input is canonical.
 */
export function findCosmereWorld(id: unknown): CosmereWorld | undefined {
  if (!isCanonicalId(id)) {
    return undefined;
  }

  return COSMERE_WORLD_REGISTRY.find((world) => world.id === id);
}

/**
 * Runtime boundary for consumers that need a trustworthy registry.
 */
export function hasValidCosmereWorldRegistry(
  registry: unknown = COSMERE_WORLD_REGISTRY,
): registry is readonly CosmereWorld[] {
  if (!Array.isArray(registry)) {
    return false;
  }

  const ids = new Set<string>();
  for (const entry of registry) {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<CosmereWorld>;
    if (!isCanonicalId(candidate.id) || !isCanonicalId(candidate.label) || ids.has(candidate.id)) {
      return false;
    }

    ids.add(candidate.id);
  }

  return true;
}
