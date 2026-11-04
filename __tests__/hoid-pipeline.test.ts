import { HoidPipeline, ContextualHoidProvider } from "../src/hoid/pipeline";
import { HoidKnowledgeEntry } from "../src/hoid/catalog";

const knowledge: HoidKnowledgeEntry[] = [
  { id: "allowed", aliases: ["permitido"], kind: "concept", firstSafeAppearance: { bookId: "mistborn-1", chapter: 2 }, summary: "Resumen original." },
  { id: "locked", aliases: ["bloqueado"], kind: "concept", firstSafeAppearance: { bookId: "mistborn-2", chapter: 1 }, summary: "Nunca debe cruzar la frontera." },
];

test("solo entrega contexto autorizado al proveedor contextual", async () => {
  let received: HoidKnowledgeEntry[] = [];
  const provider: ContextualHoidProvider = {
    answer: async () => "ok",
    answerWithContext: async (_request, context) => {
      received = context;
      return "ok";
    },
  };
  const pipeline = new HoidPipeline(provider, knowledge);
  await pipeline.answer({ question: "permitido", reading: [{ bookId: "mistborn-1", chapter: 2 }] });
  expect(received.map(item => item.id)).toEqual(["allowed"]);
});

test("falla de forma segura si la pregunta mezcla contenido desbloqueado y bloqueado", async () => {
  let called = false;
  const provider: ContextualHoidProvider = {
    answer: async () => "ok",
    answerWithContext: async () => {
      called = true;
      return "ok";
    },
  };
  const pipeline = new HoidPipeline(provider, knowledge);
  const answer = await pipeline.answer({
    question: "permitido bloqueado",
    reading: [{ bookId: "mistborn-1", chapter: 2 }],
  });
  expect(answer.blocked).toBe(true);
  expect(answer.reason).toBe("reading-position");
  expect(called).toBe(false);
});
