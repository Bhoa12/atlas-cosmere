import { admitNarrativeContext } from "./contextAdmission";

export function runContextAdmissionSelfCheck(): void {
  const result = admitNarrativeContext(
    [{ bookId: "mistborn-1", chapter: 2 }],
    [
      { evidenceId: "safe", sourceId: "private", workId: "mistborn-1", chapter: 2, accessible: true, summary: "Resumen original.", summaryOrigin: "original" },
      { evidenceId: "future", sourceId: "private", workId: "mistborn-1", chapter: 3, accessible: true, summary: "Resumen original.", summaryOrigin: "original" },
      { evidenceId: "copy", sourceId: "private", workId: "mistborn-1", chapter: 1, accessible: true, summary: "Texto no admitido.", summaryOrigin: "protected_copy" },
      { evidenceId: "other-book", sourceId: "private", workId: "roshar-1", chapter: 1, accessible: true, summary: "Resumen original.", summaryOrigin: "original" },
    ],
  );

  if (result.allowed.length !== 1 || result.allowed[0].evidenceId !== "safe") {
    throw new Error("expected_only_safe_evidence");
  }
  const reasons = new Map(result.rejected.map((item) => [item.evidenceId, item.reason]));
  if (reasons.get("future") !== "outside_reader_progress") throw new Error("future_not_rejected");
  if (reasons.get("other-book") !== "outside_reader_progress") throw new Error("cross_book_not_rejected");
  if (reasons.get("copy") !== "non_original_summary") throw new Error("protected_copy_not_rejected");
}
