import { buildSafeRecommendations } from "./recommendationPolicy";

function expect(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

const boundary = { workId: "stormlight-1", maxChapter: 12 };

const ready = buildSafeRecommendations(boundary, [
  { kind: "revisit", workId: "stormlight-1", chapter: 12, text: "Repasa el contexto ya leído antes de continuar." },
  { kind: "continue", workId: "stormlight-1", chapter: 13, text: "Sigue leyendo." },
  { kind: "revisit", workId: "elantris", chapter: 1, text: "Cambia de obra." },
]);
expect(ready.kind === "ready", "Debe conservar recomendaciones seguras");
if (ready.kind === "ready") {
  expect(ready.recommendations.length === 1, "Debe excluir capítulos futuros y otras obras");
}

const noFuture = buildSafeRecommendations(boundary, [
  { kind: "continue", workId: "stormlight-1", chapter: 13, text: "Esto depende de un capítulo futuro." },
]);
expect(noFuture.kind === "abstain", "Una recomendación futura debe fallar cerradamente");

const invalid = buildSafeRecommendations({ workId: "", maxChapter: 0 }, []);
expect(invalid.kind === "abstain", "Un límite inválido debe abstenerse");
