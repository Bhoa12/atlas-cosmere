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
  await pipeline.answer({ question: "permitido bloqueado", reading: [{ bookId: "mistborn-1", chapter: 2 }] });
  expect(received.map(item => item.id)).toEqual(["allowed"]);
});
