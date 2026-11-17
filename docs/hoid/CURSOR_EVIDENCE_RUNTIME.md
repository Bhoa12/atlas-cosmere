# Runtime de evidencias con progreso por cursores

## Objetivo

Conectar el snapshot v2 de progreso por cursores con el runtime estricto de evidencias. CosmereContext y HoidScreen utilizan ahora el mismo snapshot v2 que devuelve el coordinador persistente; los mapas numéricos quedan limitados a presentación heredada.

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

## Integración de producción

HoidScreen llama a esta fachada con `hoidCursorProgressSnapshot` proporcionado por CosmereContext. No reconstruye el progreso de autorización a partir de `capituloActualPorLibro` ni `librosLeidos`. El adaptador SQLite v2 realiza la migración transaccional desde v1, conserva el payload de origen y bloquea el progreso si detecta divergencias.

El registro editorial continúa vacío hasta que existan afirmaciones originales revisadas contra pasajes accesibles. Por ello, el runtime se abstiene correctamente ante preguntas narrativas. La integración usa cursores en producción, pero todavía requiere pruebas de reinicio e interrupción sobre SQLite nativo en Android/iOS.

## Fuentes

El módulo utiliza los manifiestos de metadatos y los contratos existentes. `canonicalEvidenceScope()` exige ahora que el `locatorId` coincida exactamente con el localizador del capítulo en el manifiesto de esa edición, y que tanto el capítulo de origen como el umbral de desbloqueo existan en la misma secuencia verificada. Los localizadores disponibles se derivan solo de los TOC de Roshar inspeccionados; no incorporan títulos ni prosa. Las obras de `cosmere.epub` no reciben localizadores de procedencia hasta que ese EPUB esté disponible en el entorno.

## Verificación de composición

La suite específica debe ejecutarse en CI junto con el contrato de snapshots v2, el manifiesto de lectura y el runtime estricto existente. La prueba de integración usa únicamente afirmaciones y evidencias sintéticas; no representa contenido narrativo extraído de los EPUB privados.
