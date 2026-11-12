import {
  validateVerifiedRelations,
  worldsForWork,
  type VerifiedRelation,
} from "./catalogueRelations";

const works = new Set(["work-alpha"]);
const worlds = new Set(["world-alpha"]);
const sources = new Set(["source-alpha"]);

const valid: VerifiedRelation[] = [{
  id: "relation-alpha",
  kind: "work-to-world",
  workId: "work-alpha",
  worldId: "world-alpha",
  sourceId: "source-alpha",
}];

validateVerifiedRelations(valid, works, worlds, sources);

if (worldsForWork("work-alpha", valid)[0] !== "world-alpha") {
  throw new Error("Expected explicit relation to resolve");
}

let rejected = false;
try {
  validateVerifiedRelations([{ ...valid[0], id: "relation-alpha", sourceId: "missing-source" }], works, worlds, sources);
} catch {
  rejected = true;
}
if (!rejected) throw new Error("Unknown sources must be rejected");

if (worldsForWork("invalid id", valid).length !== 0) {
  throw new Error("Malformed lookup must fail closed");
}
