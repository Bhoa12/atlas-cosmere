import { SourceProcessingStatus, SourceWorkManifest } from '../data/privateSourceManifest';

/**
 * Validation for bibliographic source manifests.
 *
 * This deliberately validates metadata only. A successful result never means
 * that a private EPUB was opened, that its chapter structure was inspected, or
 * that editorial facts were extracted.
 */
const ALLOWED_STATUSES: readonly SourceProcessingStatus[] = [
  'catalogued',
  'structure_pending',
  'structure_verified',
];

export interface SourceManifestValidationIssue {
  index: number;
  field: 'id' | 'title' | 'status' | 'sourceCollection';
  message: string;
}

export function validateSourceManifest(
  entries: readonly SourceWorkManifest[],
): SourceManifestValidationIssue[] {
  const issues: SourceManifestValidationIssue[] = [];
  const ids = new Set<string>();

  entries.forEach((entry, index) => {
    if (!entry.id.trim()) {
      issues.push({ index, field: 'id', message: 'id must not be empty' });
    } else if (ids.has(entry.id)) {
      issues.push({ index, field: 'id', message: 'id must be unique' });
    } else {
      ids.add(entry.id);
    }

    if (!entry.title.trim()) {
      issues.push({ index, field: 'title', message: 'title must not be empty' });
    }

    if (!ALLOWED_STATUSES.includes(entry.status)) {
      issues.push({ index, field: 'status', message: 'status is not recognised' });
    }

    if (!entry.sourceCollection) {
      issues.push({
        index,
        field: 'sourceCollection',
        message: 'sourceCollection must be declared',
      });
    }
  });

  return issues;
}
