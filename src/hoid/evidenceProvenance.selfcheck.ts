import { verifyEvidenceProvenance } from "./evidenceProvenance";
const expect=(v:unknown,m:string)=>{if(!v) throw new Error(m);};
const good=verifyEvidenceProvenance({evidenceId:"a",sourceId:"catalog",workId:"book",chapter:1,accessible:true,summary:"Resumen original.",summaryOrigin:"original"});
expect(good.ok,"Debe aceptar evidencia accesible y original.");
const blocked=verifyEvidenceProvenance({evidenceId:"b",sourceId:"catalog",workId:"book",chapter:2,accessible:false,summary:"No accesible.",summaryOrigin:"original"});
expect(!blocked.ok && blocked.reason==="inaccessible_source","Debe rechazar fuentes inaccesibles.");
const copied=verifyEvidenceProvenance({evidenceId:"c",sourceId:"catalog",workId:"book",chapter:1,accessible:true,summary:"Texto no permitido.",summaryOrigin:"protected_copy"});
expect(!copied.ok && copied.reason==="non_original_summary","Debe rechazar copias protegidas.");
