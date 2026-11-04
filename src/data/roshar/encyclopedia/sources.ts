import { SourceReference } from '../model';

/**
 * Source registry for the user-supplied EPUB variants inspected during the
 * catalog audit. These references establish provenance; they are not a claim
 * that a digital file matches any printed ISBN edition.
 */
export const ROSHAR_SOURCE_REFERENCES: SourceReference[] = [
  {
    id: 'epub-stormlight-15',
    sourceType: 'novel',
    editionId: 'epub-stormlight-15',
    notes: 'User-supplied Spanish EPUB containing five Stormlight Archive works; use exact NCX/XHTML locators for editorial claims.'
  },
  {
    id: 'epub-edgedancer',
    sourceType: 'novel',
    workId: 'edgedancer',
    editionId: 'epub-edgedancer',
    notes: 'User-supplied Spanish EPUB; provenance only until individual claims are reviewed against their exact locator.'
  },
  {
    id: 'epub-dawnshard',
    sourceType: 'novel',
    workId: 'dawnshard',
    editionId: 'epub-dawnshard',
    notes: 'User-supplied Spanish EPUB; provenance only until individual claims are reviewed against their exact locator.'
  }
];

export const ROSHAR_ENCYCLOPEDIA_EDITORIAL_POLICY = {
  language: 'es',
  publishOnlyReviewedClaims: true,
  requireSourceLocatorForPublishedNovelClaims: true,
  allowEntityWithoutPublishedClaims: false,
  notes: 'Do not create canonical encyclopedia facts from a table of contents. Published claims require an exact source reference and spoiler gate.'
} as const;
