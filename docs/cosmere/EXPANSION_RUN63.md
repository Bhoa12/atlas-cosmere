# Expansión del catálogo del Cosmere — run63

## Objetivo

Esta capa proporciona un modelo reutilizable para **fuentes, mundos, obras, unidades de lectura, progreso y puertas anti-spoilers**. Está diseñada para crecer con Scadrial, Sel, Nalthis, Taldain, Roshar y otros mundos sin acoplar la infraestructura a una obra concreta.

## Procedencia

El catálogo semilla distingue dos niveles:

- `verified-index`: respalda únicamente los metadatos presentes en el índice verificado de `cosmere.epub`.
- `declared-private`: identifica fuentes privadas declaradas por el usuario, pero **no afirma que su texto interno haya sido inspeccionado**.

Los títulos del índice se registran como metadatos. La pertenencia de una obra a un mundo se deja sin asignar hasta disponer de una relación explícita y respaldada; nunca se deduce automáticamente a partir del título.

## Anti-spoilers

`evaluateSpoilerGate` aplica una política **fail-closed**. El contenido queda bloqueado cuando falta progreso, el progreso pertenece a otra obra, los requisitos están vacíos o duplicados, una unidad es inválida o queda alguna unidad pendiente.

La decisión devuelve razones estructurales e IDs de unidades pendientes, sin incorporar texto editorial.

## Límites editoriales

Este módulo no almacena EPUBs, capítulos, pasajes ni citas. Tampoco inventa capítulos, unidades de lectura, relaciones narrativas o hechos de pasajes no accesibles.

Las futuras tarjetas o resúmenes deben ser texto original y estar respaldados por información accesible. Si una fuente privada no puede consultarse en el entorno, debe mantenerse como referencia de catálogo sin afirmar que se haya leído su contenido.

## Pruebas

`sourceSafeCosmereCatalog.test.ts` usa únicamente datos sintéticos y verifica:

1. validación de un catálogo estructuralmente correcto;
2. normalización de progreso duplicado o desconocido;
3. bloqueo por lectura incompleta;
4. desbloqueo tras completar todos los requisitos;
5. rechazo de puertas con requisitos duplicados;
6. ausencia de asignaciones de mundo inferidas en el catálogo semilla.
