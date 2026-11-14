import { buildProgressBoundary, isWithinProgress } from "./readingProgressContract";

const boundary = buildProgressBoundary([
  { workId: "mistborn-1", chapter: 12 },
  { workId: "mistborn-1", chapter: 9 },
]);

if (!isWithinProgress(boundary, "mistborn-1", 12)) throw new Error("Reached chapter rejected");
if (isWithinProgress(boundary, "mistborn-1", 13)) throw new Error("Future chapter admitted");
if (isWithinProgress(boundary, "unknown-work", 1)) throw new Error("Unknown work admitted");

let rejected = false;
try { buildProgressBoundary([{ workId: "", chapter: 1 }]); } catch { rejected = true; }
if (!rejected) throw new Error("Invalid progress did not fail closed");
