import { HoidPipeline, ContextualHoidProvider } from "../src/hoid/pipeline";

test("el filtro final bloquea una filtración del proveedor", async () => {
  const provider: ContextualHoidProvider = {
    answer: async () => "Thaidakar",
    answerWithContext: async () => "Thaidakar",
  };

  const pipeline = new HoidPipeline(provider, []);
  const answer = await pipeline.answer({
    question: "Explícame un misterio sin spoilers",
    reading: [],
  });

  expect(answer.blocked).toBe(true);
  expect(answer.reason).toBe("provider-output");
});

test("sin proveedor configurado no se intenta una llamada externa", async () => {
  const pipeline = new HoidPipeline(null, []);
  const answer = await pipeline.answer({
    question: "¿Qué es la Investidura?",
    reading: [],
  });

  expect(answer.blocked).toBe(false);
  expect(answer.reason).toBe("provider-unavailable");
});
