import {
  PRIORITY_WORLDS,
  VERIFIED_INDEX_WORKS,
  canPublishDescriptor,
  validateBibliography,
  worksFromSource,
} from "./cosmereExpansionRun82";

if (PRIORITY_WORLDS.map((world) => world.id).join(",") !== "scadrial,sel,nalthis,taldain,roshar") {
  throw new Error("priority worlds changed");
}
if (VERIFIED_INDEX_WORKS.length !== 17) throw new Error("verified index count changed");

const sources = [
  { id: "cosmere-index", kind: "verified-index" as const, accessible: true },
  { id: "private-roshar", kind: "declared-private" as const, accessible: false },
  { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
];

if (worksFromSource("cosmere-index", VERIFIED_INDEX_WORKS).length !== 17) {
  throw new Error("source catalog view should retain all verified titles");
}
if (validateBibliography(sources, VERIFIED_INDEX_WORKS).length !== 0) {
  throw new Error("verified bibliography should be structurally valid");
}

const work = VERIFIED_INDEX_WORKS[0];
if (canPublishDescriptor({ id: "meta", workId: work.id, sourceId: "cosmere-index", kind: "metadata" }, sources, VERIFIED_INDEX_WORKS) !== true) {
  throw new Error("metadata should be publishable");
}
if (canPublishDescriptor({ id: "summary", workId: work.id, sourceId: "cosmere-index", kind: "original-summary" }, sources, VERIFIED_INDEX_WORKS) !== false) {
  throw new Error("index must not authorize editorial summary");
}
if (canPublishDescriptor({ id: "summary", workId: work.id, sourceId: "editorial", kind: "original-summary" }, sources, VERIFIED_INDEX_WORKS) !== true) {
  throw new Error("accessible editorial source should authorize summary");
}
