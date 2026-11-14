import { strict as assert } from "node:assert";
import { CATALOG_WORKS, COSMERE_INDEX_SOURCE, PRIORITY_WORLDS, acceptedProgress, validateCatalog } from "./cosmereExpansionRun70";

assert.equal(CATALOG_WORKS.length, 17);
assert.ok(CATALOG_WORKS.every(work => work.worldIds.length === 0));
assert.deepEqual(validateCatalog([COSMERE_INDEX_SOURCE], PRIORITY_WORLDS, CATALOG_WORKS), []);

const units=[{id:"u1",workId:"w",position:1,label:"Unidad"}];
assert.deepEqual(acceptedProgress({workId:"w",completedUnitIds:["u1","u1","unknown"]}, units), ["u1"]);
assert.deepEqual(acceptedProgress({workId:"other",completedUnitIds:["u1"]}, units), []);
