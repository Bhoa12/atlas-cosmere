import { canReveal, validateCatalogue } from "./cosmereExpansionRun45";

const sources=[{id:"cosmere-index",provenance:"verified-index" as const,label:"Índice verificado"}];
const worlds=[{id:"scadrial",label:"Scadrial"}];
const works=[{id:"work-1",title:"Obra sintética",sourceId:"cosmere-index"}];
const units=[{id:"unit-1",workId:"work-1",position:1,label:"Unidad 1"}];

if(validateCatalogue(sources,worlds,works,units).length!==0) throw new Error("valid catalogue rejected");
if(!canReveal({workId:"work-1",requiredUnitIds:["unit-1"]},{workId:"work-1",completedUnitIds:["unit-1"]},units)) throw new Error("completed gate stayed locked");
if(canReveal({workId:"work-1",requiredUnitIds:["unit-1","unit-1"]},{workId:"work-1",completedUnitIds:["unit-1"]},units)) throw new Error("duplicate requirements opened gate");