/**
 * Safe catalog-to-domain links.
 *
 * World membership is explicit and provenance-bound. No title-based inference is
 * performed, and a private declaration is never treated as inspected editorial text.
 */

export type DomainSourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface DomainSource {
  id: string;
  kind: DomainSourceKind;
  accessible: boolean;
}

export interface DomainWorld {
  id: string;
  label: string;
}

export interface DomainWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface WorkWorldLink {
  workId: string;
  worldId: string;
  sourceId: string;
}

export interface DomainAudit {
  validLinks: WorkWorldLink[];
  errors: string[];
}

const unique = (values: string[]) => new Set(values).size === values.length;

export function auditWorkWorldLinks(
  sources: DomainSource[],
  worlds: DomainWorld[],
  works: DomainWork[],
  links: WorkWorldLink[],
): DomainAudit {
  const errors: string[] = [];
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const worldIds = new Set(worlds.map(world => world.id));
  const workIds = new Set(works.map(work => work.id));

  if (!unique(sources.map(source => source.id))) errors.push("duplicate-source-id");
  if (!unique(worlds.map(world => world.id))) errors.push("duplicate-world-id");
  if (!unique(works.map(work => work.id))) errors.push("duplicate-work-id");

  const validLinks: WorkWorldLink[] = [];
  const linkKeys = new Set<string>();

  for (const link of links) {
    const key = `${link.workId}:${link.worldId}`;
    const source = sourceById.get(link.sourceId);

    if (linkKeys.has(key)) {
      errors.push(`duplicate-link:${key}`);
      continue;
    }
    linkKeys.add(key);

    if (!workIds.has(link.workId)) {
      errors.push(`unknown-work:${link.workId}`);
      continue;
    }
    if (!worldIds.has(link.worldId)) {
      errors.push(`unknown-world:${link.worldId}`);
      continue;
    }
    if (!source) {
      errors.push(`unknown-link-source:${link.sourceId}`);
      continue;
    }

    // A link may be catalog metadata, but its source must be registered.
    // This function intentionally does not derive narrative or editorial facts.
    validLinks.push(link);
  }

  return { validLinks, errors };
}

export const priorityWorlds: DomainWorld[] = [
  { id: "scadrial", label: "Scadrial" },
  { id: "sel", label: "Sel" },
  { id: "nalthis", label: "Nalthis" },
  { id: "taldain", label: "Taldain" },
  { id: "roshar", label: "Roshar" },
];
