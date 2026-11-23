# Run 245 — trazabilidad de capítulos por afirmación

## Objetivo

Hacer que una comparación entre obras explique no solo qué libros participan en la respuesta, sino qué capítulos concretos respaldan cada afirmación individual.

## Contrato de datos

`HoidCrossBookEvidenceSummary` conserva el resumen agregado por obra y amplía cada segmento con `works`:

- `sourceBookId`: identificador de catálogo.
- `title`: título canónico de la bibliografía.
- `chapters`: capítulos numéricos exactos citados por esa afirmación y esa obra.
- `evidenceIds`: IDs internos de evidencia asociados a esos capítulos.

`sourceBookIds` se conserva por compatibilidad y se deriva del mismo arreglo `works`, en orden de bibliografía.

## Reglas de construcción

1. La función consume la presentación canónica que ya ha superado el presentador confiable.
2. Cada cita de segmento debe coincidir con la cita global por ID, obra, título, capítulo y localizador.
3. La agrupación por afirmación se construye solo con las citas de ese segmento.
4. Las obras se ordenan por la bibliografía oficial.
5. Los capítulos se ordenan numéricamente y los IDs de evidencia lexicográficamente.
6. Las evidencias globales huérfanas o las citas inconsistentes invalidan la matriz completa.
7. No se vuelve a leer el snapshot de progreso ni el objeto de respuesta original.

## Presentación

En respuestas transversales, HoidScreen muestra bajo cada afirmación los títulos y capítulos agrupados por obra. Las respuestas de una sola obra mantienen la presentación ordinaria de citas. Los IDs internos y localizadores opacos nunca se muestran al lector.

## Seguridad y privacidad

La traza es una proyección metadata-only. No concede permisos, no altera el umbral de desbloqueo, no lee EPUB/XHTML y no incorpora contenido protegido. La autorización continúa en el presentador confiable; esta capa únicamente explica la procedencia ya autorizada.

## Pruebas

La suite `crossBookEvidence.test.ts` cubre:

- Correspondencia exacta por afirmación.
- Una afirmación respaldada por varios capítulos de una obra.
- Una afirmación respaldada por varias obras.
- Orden determinista de obras, capítulos e IDs.
- Separación entre capítulos de afirmaciones diferentes.
- Rechazo de evidencia no autorizada o con mapeo inconsistente.
- Equivalencia entre resumen de presentación canónica y la ruta de conveniencia.

No se han incorporado fuentes privadas, resúmenes nuevos ni texto protegido.
