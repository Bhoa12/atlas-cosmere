/**
 * Deterministic validation for bibliographic manifests.
 *
 * The validator only checks metadata integrity. It deliberately does not infer
 * narrative facts, chapter boundaries, world assignments or other editorial
 * content from titles.
 */
import type { SourceProcessingStatus, SourceWorkManifest } from './privateSourceManifest';

const ALLOWED_STATUSES: readonly SourceProcessingStatus[] = [
  'catalogued',
  'structure_pending',
  'structure_verified',
];

export interface SourceManifestValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSourceManifest(
  entries: readonly SourceWorkManifest[],
): SourceManifestValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    const label = `entry ${index + 1}`;
    const id = entry.id?.trim();
    const title = entry.title?.trim();

    if (!id) errors.push(`${label}: id is required`);
    else if (ids.has(id)) errors.push(`${label}: duplicate id "${id}"`);
    else ids.add(id);

    if (!title) errors.push(`${label}: title is required`);

    if (!ALLOWED_STATUSES.includes(entry.status)) {
      errors.push(`${label}: unsupported processing status`);
    }

    if (entry.sourceCollection !== 'cosmere.epub' &&
        entry.sourceCollection !== 'roshar-private-epubs') {
      errors.push(`${label}: unsupported source collection`);
    }
  }

  return { valid: errors.length === 0, errors };
}
