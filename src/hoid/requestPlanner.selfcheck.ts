import { planHoidRequest } from "./requestPlanner";

const expect = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const progress = [{ workId: "mistborn-final-empire", chapter: 12 }] as const;

const allowed = planHoidRequest(
  { question: "Resume lo ocurrido hasta aquí", requestedWorkId: "mistborn-final-empire", requestedChapter: 12 },
  progress,
);
expect(allowed.ok, "Debe aceptar una consulta dentro del progreso");

const future = planHoidRequest(
  { question: "¿Qué pasa después?", requestedWorkId: "mistborn-final-empire", requestedChapter: 13 },
  progress,
);
expect(!future.ok && future.reason === "CHAPTER_BEYOND_PROGRESS", "Debe bloquear capítulos futuros");

const unscoped = planHoidRequest({ question: "¿Quién es este personaje?" }, progress);
expect(!unscoped.ok && unscoped.reason === "NO_WORK_SCOPE", "No debe conceder acceso narrativo sin obra");

console.log("Hoid request planner self-check passed");
