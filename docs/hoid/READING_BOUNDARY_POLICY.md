# Límite de lectura seguro para Hoid

## Semántica del cursor

El cursor v2 de Atlas representa el capítulo actualmente abierto/en curso, no una declaración de que ese capítulo se haya terminado. Por tanto, si el cursor apunta al capítulo N, el último capítulo que puede considerarse completado es N-1.

- Cursor en capítulo 1: no hay capítulos completados; no se autoriza ninguna evidencia con umbral de capítulo.
- Cursor en capítulo N (N > 1): solo se autorizan evidencias cuyo umbral sea <= N-1.
- Finalización explícita: se puede autorizar el contenido de toda la obra.
- No se infiere finalización por alcanzar el último cursor numérico.

Esta política es deliberadamente conservadora. Evita mostrar el resumen de un capítulo mientras el lector todavía está en ese capítulo.

## Implementación

- `readingBoundary.ts` convierte una posición v2 validada en un límite explícito.
- `projectHoidCursorPositionToBoundary()` conserva por separado `currentChapter` y `completedThroughChapter`.
- `cursorEvidenceRuntime.ts` proyecta al contrato legado únicamente el prefijo completado.
- El capítulo 1 no se representa como capítulo 0: simplemente no produce una `ReadingPosition`.
- `startedBookIds` conserva la distinción entre una obra iniciada y una obra no empezada para que las recomendaciones no vuelvan a sugerir como inédita una obra cuyo lector está en el capítulo 1.

## Recomendaciones

El motor de recomendaciones sigue utilizando exclusivamente metadatos bibliográficos. Después de generar candidatos, la fachada cursor-native elimina las obras presentes en el snapshot, incluso cuando todavía no existe un capítulo completado. Así una obra iniciada no se etiqueta erróneamente como no empezada.

## Pruebas

Las pruebas cubren:

- capítulo actual N -> completado hasta N-1;
- capítulo 1 -> ningún umbral narrativo desbloqueado;
- finalización explícita -> obra completa;
- discrepancia entre identidad de libro y cursor;
- cursor manipulado u obsoleto;
- no desbloquear una afirmación del capítulo que está abierto;
- excluir obras iniciadas de recomendaciones de obras no empezadas.

## Limitación

La interfaz debe seguir presentando el cursor como «capítulo actual/en curso». Si en el futuro se añade una acción explícita «he terminado este capítulo», debe introducirse como una operación distinta y versionada; no debe reinterpretarse silenciosamente el significado del cursor existente.
