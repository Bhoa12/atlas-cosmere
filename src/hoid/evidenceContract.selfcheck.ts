import { isUsableEvidence } from "./evidenceContract";

const progress = { bookId: "mistborn-final-empire", chapter: 10 };
const safe = { id: "e-1", bookId: progress.bookId, chapter: 10, summary: "Resumen original.", accessible: true };
const future = { ...safe, id: "e-2", chapter: 11 };
const inaccessible = { ...safe, id: "e-3", accessible: false };

if (!isUsableEvidence(safe, progress)) throw new Error("safe evidence rejected");
if (isUsableEvidence(future, progress)) throw new Error("future evidence accepted");
if (isUsableEvidence(inaccessible, progress)) throw new Error("inaccessible evidence accepted");
