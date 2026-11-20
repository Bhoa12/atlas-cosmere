# Run 189 — Recomendaciones de lectura conscientes del progreso

## Objetivo

Añadir una recomendación de siguiente paso que priorice reanudar una obra en curso sin inferir cuál está activa cuando el progreso contiene varias obras. La política usa únicamente metadatos de bibliografía y manifiestos de edición verificados; no infiere orden narrativo, dependencias de canon ni contenido de capítulos no inspeccionados.

## Contrato

`recommendReadingNextSteps(reading, limit, activeBookId?)` devuelve recomendaciones metadata-only:

- `resume-current-work`: obra en curso y capítulo actual validado contra el manifiesto exacto de la edición.
- `unread-source`: obra del catálogo en la que no consta progreso.

La función valida el progreso mediante `validEditionBoundReadingPositions()`. Un capítulo fuera de rango, un capítulo ambiguo de una edición con localizadores duplicados o un cursor numérico de una obra no segmentada invalida la recomendación completa.

## Selección de la obra activa

1. Si la interfaz proporciona `activeBookId`, se usa únicamente si es un identificador exacto de la bibliografía.
2. Si no se proporciona y existe exactamente una obra numérica en curso, se puede proponer reanudar esa obra.
3. Si hay varias obras en curso y no se proporciona `activeBookId`, Hoid no adivina cuál es la activa; devuelve solo fuentes no iniciadas.
4. Una obra marcada `completed: true` nunca se propone como reanudación.
5. Una obra sin manifiesto numérico seguro nunca recibe una recomendación de capítulo.

## Semántica del cursor

`ReadingPosition.chapter` representa el capítulo actual/abierto, igual que la proyección de `HoidReadingCursor` a la posición compatible. Por ello:

- `currentChapter` es el capítulo del cursor actual.
- `completedThroughChapter` es `currentChapter - 1`.
- En el capítulo 1, `completedThroughChapter` es `null`.
- `completed: true` representa la finalización de la obra y no se convierte en un cursor numérico.

Esta semántica coincide con el umbral de evidencia: un resumen cuya fuente es el capítulo N se desbloquea cuando el cursor está en N+1.

## Límites y garantías

- El límite total se aplica después de colocar la recomendación de reanudación, si existe.
- El límite se acota al número de obras del catálogo.
- La función no altera progreso, manifiestos, permisos, resúmenes ni registros editoriales.
- No utiliza títulos de capítulos, pasajes, sinopsis no verificadas ni texto de proveedor.
- `recommendUnstartedSources()` se conserva para consumidores que necesitan exclusivamente obras no iniciadas.

## Integración

`HoidEvidenceRuntime.recommend(reading, limit, activeBookId?)` expone la nueva política. La interfaz puede proporcionar el libro que el lector tiene abierto. Los consumidores anteriores pueden seguir pasando únicamente progreso y límite; si hay una sola obra en curso, se prioriza reanudarla.

## Pruebas

`recommendations.test.ts` cubre:
- reanudación de una única obra en curso;
- cálculo de capítulos completados antes del cursor;
- ausencia de inferencia con varias obras activas;
- selección explícita mediante `activeBookId`;
- exclusión de obras completadas;
- rechazo de capítulos fuera de rango o ambiguos;
- rechazo de progreso numérico para volúmenes sin segmentación;
- aplicación del límite global;
- rechazo de un identificador activo desconocido.

## Integridad editorial

Run 189 no inspecciona EPUBs ni incorpora resúmenes, afirmaciones o pasajes. La bibliografía sigue siendo un catálogo de fuentes, no evidencia narrativa. No se modifica el progreso del lector ni el registro de conocimiento de producción.
