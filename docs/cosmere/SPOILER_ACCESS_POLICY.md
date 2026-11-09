# Política de acceso anti-spoilers

`resolveSpoilerAccessPolicy` es la frontera final de política entre decisiones de
puntos de control y contenido que la interfaz puede mostrar.

## Modos

- `always-safe`: contenido declarado explícitamente como seguro sin requisito de
  lectura.
- `checkpoint-gated`: requiere exactamente una decisión procedente de la capa de
  puntos de control.

## Fail-closed

La resolución se bloquea ante identificadores duplicados, modos desconocidos,
decisiones de checkpoint ausentes, duplicadas o que no correspondan a ninguna
política declarada. No se descartan decisiones sobrantes ni se habilita contenido
por defecto.

Esta capa no contiene texto editorial, no interpreta EPUBs y no determina por sí
misma qué contenido es seguro. La clasificación debe llegar como metadato
respaldado. Su función es aplicar una política estructural y conservar la
separación:

`estructura de lectura → progreso → checkpoint → política → divulgación`.

Por ello puede reutilizarse para Scadrial, Sel, Nalthis, Taldain, Roshar y futuros
mundos sin incorporar conocimiento narrativo no respaldado.
