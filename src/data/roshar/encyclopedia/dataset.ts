import {
  EncyclopediaClaim,
  EncyclopediaEntity,
  SourceReference
} from '../model';
import {
  ROSHAR_ENCYCLOPEDIA_EDITORIAL_POLICY,
  ROSHAR_SOURCE_REFERENCES
} from './sources';

/**
 * Intentionally empty publication dataset.
 *
 * The repository currently has verified navigation metadata from the supplied
 * EPUBs, but navigation metadata is not evidence for encyclopedia facts.
 * Claims are added only after reviewing the underlying source passage and
 * assigning its exact reading-unit spoiler gate.
 */
export const ROSHAR_ENCYCLOPEDIA_ENTITIES: EncyclopediaEntity[] = [];
export const ROSHAR_ENCYCLOPEDIA_CLAIMS: EncyclopediaClaim[] = [];
export const ROSHAR_ENCYCLOPEDIA_SOURCES: SourceReference[] = ROSHAR_SOURCE_REFERENCES;

export const ROSHAR_ENCYCLOPEDIA_DATASET = {
  entities: ROSHAR_ENCYCLOPEDIA_ENTITIES,
  claims: ROSHAR_ENCYCLOPEDIA_CLAIMS,
  sources: ROSHAR_ENCYCLOPEDIA_SOURCES,
  policy: ROSHAR_ENCYCLOPEDIA_EDITORIAL_POLICY
} as const;
