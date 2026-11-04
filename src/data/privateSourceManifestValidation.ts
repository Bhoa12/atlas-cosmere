/**
 * Deterministic validation helpers for the private bibliographic manifest.
 * These checks intentionally validate metadata only and never inspect or copy
 * protected source text.
 */
import { PRIVATE_SOURCE_MANIFEST, type SourceWorkManifest } from './privateSourceManifest';

export interface ManifestValidationIssue {
  code: 'duplicate-id' | 'missing-title' | 'invalid-status';
  message: string;
  workId?: string;
}

const VALID_STATUSES = new Set(['catalogued', 'structure_pending', 'structure_verified']);

export function validatePrivateSourceManifest(
  works: readonly SourceWorkManifest[] = PRIVATE_SOURCE_MANIFEST,
): ManifestValidationIssue[] {
  const issues: ManifestValidationIssue[] = [];
  const ids = new Set<string>();

  for (const work of works) {
    if (!work.id.trim() || ids.has(work.id)) {
      issues.push({
        code: 'duplicate-id',
        message: `Work id must be unique and non-empty: "${work.id}".`,
        workId: work.id,
      });
    }
    ids.add(work.id);

    if (!work.title.trim()) {
      issues.push({
        code: 'missing-title',
        message: `Work "${work.id}" must have a non-empty title.`,
        workId: work.id,
      });
    }

    if (!VALID_STATUSES.has(work.status)) {
      issues.push({
        code: 'invalid-status',
        message: `Work "${work.id}" has an unsupported processing status.`,
        workId: work.id,
      });
    }
  }

  return issues;
}

export function assertPrivateSourceManifest(
  works: readonly SourceWorkManifest[] = PRIVATE_SOURCE_MANIFEST,
): void {
  const issues = validatePrivateSourceManifest(works);
  if (issues.length) {
    throw new Error(`Invalid private source manifest: ${issues.map((issue) => issue.message).join(' ')}`);
  }
}
