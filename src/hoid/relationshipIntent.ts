const RELATIONSHIP_CUES = Object.freeze([
  "relacion entre",
  "relacion hay entre",
  "relacion existe entre",
  "que relacion tiene",
  "que relacion existe",
  "que relacion hay",
  "como se relacionan",
  "como se relaciona",
  "como estan relacionados",
  "como estan relacionadas",
  "que conexion hay entre",
  "que conexion existe entre",
  "conexion entre",
  "vinculo entre",
  "vinculo hay entre",
  "que une a",
  "que tienen en comun",
  "en que se relacionan",
]);

function normalizeRelationshipQuestion(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{Cf}\p{Mn}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Deterministic cue detection only; entity identity is resolved separately against reviewed aliases. */
export function isHoidRelationshipQuestion(value: unknown): boolean {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 4_000 ||
    value !== value.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(value)
  ) return false;

  let normalized: string;
  try {
    normalized = normalizeRelationshipQuestion(value);
  } catch {
    return false;
  }
  if (!normalized) return false;
  const padded = " " + normalized + " ";
  return RELATIONSHIP_CUES.some(cue => padded.includes(" " + cue + " "));
}
