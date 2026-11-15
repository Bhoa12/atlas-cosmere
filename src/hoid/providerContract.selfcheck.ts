import { validateProviderResponse } from "./providerContract";

const context = {
  bookId: "mistborn-the-final-empire",
  maxChapter: 10,
  evidence: [
    { id: "safe-10", chapter: 10, summary: "Resumen original autorizado." },
    { id: "future-11", chapter: 11, summary: "No debe autorizarse." },
  ],
} as const;

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

expect(
  validateProviderResponse(
    { claims: [{ text: "Explicación respaldada.", evidenceIds: ["safe-10"] }] },
    context,
  ).ok,
  "La evidencia dentro del progreso debe aceptarse.",
);

expect(
  !validateProviderResponse(
    { claims: [{ text: "Spoiler.", evidenceIds: ["future-11"] }] },
    context,
  ).ok,
  "La evidencia futura debe rechazarse.",
);

expect(
  !validateProviderResponse(
    { claims: [{ text: "Sin procedencia.", evidenceIds: [] }] },
    context,
  ).ok,
  "Toda afirmación debe declarar evidencia.",
);
