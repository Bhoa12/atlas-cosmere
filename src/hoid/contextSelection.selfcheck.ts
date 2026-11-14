import { selectSafeContext, type HoidEvidence } from "./contextSelection";

const evidence: HoidEvidence[] = [
  { evidenceId: "a", sourceId: "private", bookId: "book-a", chapter: 2, summary: "Original summary." },
  { evidenceId: "b", sourceId: "private", bookId: "book-a", chapter: 3, summary: "Future summary." },
  { evidenceId: "c", sourceId: "private", bookId: "book-b", chapter: 1, summary: "Other book." },
];

const result = selectSafeContext([{ bookId: "book-a", chapter: 2 }], evidence);

if (result.allowed.length !== 1 || result.allowed[0].evidenceId !== "a") {
  throw new Error("Safe context selection accepted unauthorized evidence.");
}

if (result.rejected.length !== 2) {
  throw new Error("Safe context selection did not reject future or cross-book evidence.");
}
