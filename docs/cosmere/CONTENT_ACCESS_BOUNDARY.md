# Frontera de acceso anti-spoilers

`contentAccessBoundary.ts` conecta contenido catalogado con el progreso de lectura sin contener información editorial.

## Regla de acceso

Un elemento solo devuelve `visible` cuando:

1. el contenido y el progreso pertenecen a la misma obra;
2. todos los identificadores técnicos son canónicos;
3. no existen requisitos ni unidades completadas duplicadas;
4. todas las unidades requeridas constan como completadas.

Cualquier inconsistencia devuelve `locked`.

## Límites editoriales

Esta capa no contiene ni deduce hechos narrativos, mundos, cronologías, capítulos, páginas o resúmenes. Tampoco decide qué dato concreto es un spoiler: recibe requisitos ya catalogados por una capa editorial respaldada.

Por tanto, puede reutilizarse para Scadrial, Sel, Nalthis, Taldain, Roshar y otros mundos sin codificar contenido no verificado.

La bibliografía privada solo debe aportar metadatos y estructura previamente verificados; ningún texto íntegro protegido se almacena en este módulo.
