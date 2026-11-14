import { strict as assert } from "node:assert";
import {
  auditWorldWorkLinks,
  evaluateSpoilerGate,
  worksForWorld,
} from "./cosmereExpansionRun71";

const worlds=[{id:"scadrial",name:"Scadrial"}];
const works=[{id:"work",title:"Metadata title",sourceId:"index",worldIds:[]}];
const sources=[{id:"index",kind:"verified-index" as const,label:"Index",accessible:false}];

assert.deepEqual(
  auditWorldWorkLinks([{worldId:"scadrial",workId:"work",sourceId:"index",relation:"explicit-metadata"}], worlds, works, sources),
  {valid:true,issues:[]},
);
assert.deepEqual(
  worksForWorld("scadrial",[{worldId:"scadrial",workId:"work",sourceId:"index",relation:"explicit-metadata"}],works).map(work=>work.id),
  ["work"],
);
assert.equal(
  auditWorldWorkLinks([{worldId:"missing",workId:"work",sourceId:"index",relation:"explicit-metadata"}],worlds,works,sources).valid,
  false,
);

const units=[
  {id:"u1",workId:"work",position:1,label:"Unidad 1"},
  {id:"u2",workId:"work",position:2,label:"Unidad 2"},
];
assert.deepEqual(
  evaluateSpoilerGate({workId:"work",requiredUnitIds:["u1","u2"]},["u1","unknown"],units),
  {allowed:false,reason:"incomplete-progress",pendingUnitIds:["u2"]},
);
assert.deepEqual(
  evaluateSpoilerGate({workId:"work",requiredUnitIds:["u1","u2"]},["u1","u2"],units),
  {allowed:true,pendingUnitIds:[]},
);
assert.deepEqual(
  evaluateSpoilerGate({workId:"work",requiredUnitIds:["u1","u1"]},["u1"],units),
  {allowed:false,reason:"invalid-requirements",pendingUnitIds:[]},
);
