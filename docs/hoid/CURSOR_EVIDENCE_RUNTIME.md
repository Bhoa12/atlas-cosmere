# Runtime de evidencias con progreso por cursores

## Objetivo

Conectar el snapshot v2 de progreso por cursores con el runtime estricto de evidencias sin activar todavía una migración de SQLite ni cambiar la fuente autoritativa de progreso de Atlas.

HoidCursorEvidenceRuntime es una fachada de compatibilidad: valida primero el snapshot v2 completo, vuelve a validar cada cursor contra el manifiesto de la edición y solo entonces proyecta las posiciones a la forma numérica que consume el runtime de evidencias existente.

## Flujo

1. La aplicación entrega un snapshot v2 completo.
2. validateHoidCursorProgressSnapshot valida forma, revisión, timestamp, catálogo, unicidad y cursores.
3. Cada cursor parcial se vuelve a resolver mediante cursorToLegacyReadingPosition.
4. Las finalizaciones explícitas permanecen como completed=true; nunca se convierten en un capítulo ficticio.
5. La fachada entrega únicamente posiciones canónicas al HoidEvidenceRuntime.
6. El runtime existente vuelve a validar el progreso, filtra evidencias y exige que todas las fuentes cruzadas estén desbloqueadas.
7. El selector recibe exclusivamente candidatos autorizados y la respuesta se renderiza desde el registro editorial local.

Un cursor con manifiesto obsoleto, unidad inexistente o capítulo ambiguo se rechaza antes de invocar al selector.

## API

- projectHoidCursorProgressSnapshot(value): conversión pura y validada a ReadingPosition[].
- HoidCursorEvidenceRuntime.answer({ question, progress, intent? }): respuesta con progreso v2.
- HoidCursorEvidenceRuntime.recommend(progress, limit?): recomendaciones basadas en progreso v2 y metadatos del catálogo.
- createHoidCursorEvidenceRuntime(runtime): composición mediante inyección de dependencias.

La solicitud de respuesta acepta únicamente question, progress e intent. Se rechazan propiedades adicionales, getters, setters, símbolos y objetos con prototipos no canónicos. No se acepta un reading numérico junto con el snapshot para evitar fuentes de progreso contradictorias.

## Garantías

- El progreso de una obra no desbloquea otra obra.
- Las relaciones entre obras requieren que cada evidencia citada esté desbloqueada.
- Las afirmaciones editoriales no verificadas siguen excluidas.
- El proveedor nunca redacta la prosa final.
- El proveedor no se invoca cuando el snapshot o cualquier cursor es inválido.
- Las recomendaciones siguen siendo metadatos; no se infiere orden canónico ni dependencia argumental.
- Ante cualquier discrepancia, la fachada se abstiene o bloquea.

## Límite de esta iteración

Esta fachada no convierte SQLite v1 en v2, no realiza migración en disco y no se conecta todavía a HoidScreen. El coordinador y la interfaz existentes continúan usando el formato v1 hasta que se implemente y pruebe el adaptador SQLite v2, el marcador transaccional, la lectura dual y la recuperación ante interrupciones.

La fachada demuestra y prueba la frontera de autorización por cursor, lista para conectarse cuando la persistencia v2 sea autoritativa.

## Fuentes

El módulo utiliza únicamente los manifiestos de metadatos y los contratos existentes. No incorpora títulos de capítulos, localizadores, resúmenes narrativos ni texto de los EPUB privados.
