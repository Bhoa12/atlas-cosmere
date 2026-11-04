import {
  EncyclopediaClaim,
  EncyclopediaEntity,
  SourceReference
} from '../model';
import { validateEncyclopediaContent } from './selectors';

export interface EditorialBatch {
  entities: readonly EncyclopediaEntity[];
  claims: readonly EncyclopediaClaim[];
  sources: readonly SourceReference[];
}

export interface EditorialBatchResult {
  publishable: boolean;
  issues: string[];
  publishedClaimCount: number;
  reviewedClaimCount: number;
}

/**
 * Single entry point for editorial ingestion. Drafts are allowed to be incomplete,
 * but a batch containing invalid published material is never publishable.
 */
export function inspectEditorialBatch(batch: EditorialBatch): EditorialBatchResult {
  const issues = validateEncyclopediaContent(
    batch.entities,
    batch.claims,
    batch.sources
  );
  const publishedClaimCount = batch.claims.filter(claim => claim.editorialStatus === 'published').length;
  const reviewedClaimCount = batch.claims.filter(
    claim => claim.editorialStatus === 'reviewed' || claim.editorialStatus === 'published'
  ).length;

  return {
    publishable: issues.length === 0,
    issues,
    publishedClaimCount,
    reviewedClaimCount
  };
}
