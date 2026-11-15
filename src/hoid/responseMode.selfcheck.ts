import { buildModeContext } from "./responseMode";

const base = {
  workId: "mistborn-final-empire",
  maxChapter: 5,
  evidence: [
    { id: "safe", workId: "mistborn-final-empire", chapter: 5, summary: "Resumen original." },
    { id: "future", workId: "mistborn-final-empire", chapter: 6, summary: "No autorizado." },
    { id: "other", workId: "elantris", chapter: 1, summary: "Otra obra." },
  ],
} as const;

export function selfCheckResponseMode(): void {
  const explain = buildModeContext({ ...base, mode: "explain" });
  if (explain.kind !== "ready" || explain.evidence.map((item) => item.id).join(",") !== "safe") {
    throw new Error("Explanation context must retain only authorized evidence");
  }

  const recommend = buildModeContext({ ...base, mode: "recommend" });
  if (recommend.kind !== "ready" || recommend.mode !== "recommend" || recommend.evidence.length !== 1) {
    throw new Error("Recommendations must use the same authorization boundary");
  }

  const none = buildModeContext({ ...base, mode: "recommend", evidence: [] });
  if (none.kind !== "abstain" || none.reason !== "no-authorized-evidence") {
    throw new Error("Expected fail-closed abstention");
  }
}
