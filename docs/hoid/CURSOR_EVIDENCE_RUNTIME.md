# Runtime de evidencias con progreso por cursores

## Objetivo

Conectar el snapshot v2 de progreso por cursores con el runtime estricto de evidencias. CosmereContext y HoidScreen utilizan el snapshot v2 del coordinador persistente; los mapas numéricos quedan limitados a presentación heredada.

HoidCursorEvidenceRuntime valida primero el snapshot v2 completo, vuelve a validar cada cursor contra el manifiesto de la edición y solo entonces proyecta las posiciones a la forma numérica que consume el runtime de evidencias existente.

## Flujo

1. La aplicación entrega un snapshot v2 completo.
2. `validateHoidCursorProgressSnapshot` valida forma, revisión, timestamp, catálogo, unicidad y cursores.
3. Cada cursor parcial se vuelve a resolver mediante la frontera de lectura de la edición.
4. Las finalizaciones explícitas permanecen como `completed=true`; nunca se convierten en un capítulo ficticio.
5. La fachada entrega únicamente posiciones canónicas al `HoidEvidenceRuntime`.
6. El runtime existente vuelve a validar el progreso, filtra evidencias y exige que todas las fuentes cruzadas estén desbloqueadas.
7. El selector recibe exclusivamente candidatos autorizados y la respuesta se renderiza desde el registro editorial local.
8. Si la respuesta queda autorizada, la fachada adjunta un recibo de frescura con la revisión y la huella de la misma proyección validada.
9. El presentador confiable conserva el recibo y lo compara con la proyección usada para mostrar la respuesta. Si no coincide, retiene texto y citas como `stale-progress`.

Un cursor con manifiesto obsoleto, unidad inexistente o capítulo ambiguo se rechaza antes de invocar al selector.

## API

- `projectHoidCursorProgressSnapshot(value)`: conversión pura y validada a `ReadingPosition[]`.
- `HoidCursorEvidenceRuntime.answer({ question, progress, intent?, entityIds?, selectionBudget?, bookScope? })`: respuesta vinculada a la proyección v2 utilizada para autorizarla, cuando queda autorizada.
- `HoidCursorEvidenceRuntime.recommend(progress, limit?)`: recomendaciones basadas en progreso v2 y metadatos del catálogo.
- `createHoidCursorEvidenceRuntime(runtime)`: composición mediante inyección de dependencias.

La solicitud rechaza propiedades adicionales, getters, setters, símbolos y objetos con prototipos no canónicos. No se acepta un `reading` numérico junto con el snapshot para evitar fuentes de progreso contradictorias.

## Garantías

- El progreso de una obra no desbloquea otra obra.
- Las relaciones entre obras requieren que cada evidencia citada esté desbloqueada.
- Las afirmaciones editoriales no verificadas siguen excluidas.
- El proveedor nunca redacta la prosa final.
- El proveedor no se invoca cuando el snapshot o cualquier cursor es inválido.
- Las recomendaciones siguen siendo metadatos; no se infiere orden canónico ni dependencia argumental.
- Ante cualquier discrepancia, la fachada se abstiene o bloquea.
- Una respuesta autorizada del runtime de cursores queda vinculada a la revisión y huella de su proyección; un presentador que reciba otra proyección la retiene.

## Recibo de frescura de respuesta

Run 247 añade `HoidCursorAnswerProgressBinding`. El recibo reutiliza el fingerprint canónico compartido con el gateway conversacional y el grafo autorizado. Se crea desde la misma proyección que se entregó al runtime, se conserva al reconstruir la respuesta desde el registro editorial y se compara con la proyección derivada del snapshot de presentación.

El recibo detecta desajustes de progreso, pero no es una firma ni una autorización. No autentica afirmaciones o proveedores, no sustituye la autoridad editorial, el desbloqueo por capítulo ni la comprobación pre/post del gateway. Las respuestas heredadas sin recibo mantienen compatibilidad; el flujo cursor-native debe conservarlo hasta la presentación confiable.

## Integración de producción

HoidScreen llama a esta fachada con `hoidCursorProgressSnapshot` proporcionado por CosmereContext. No reconstruye el progreso de autorización a partir de `capituloActualPorLibro` ni `librosLeidos`. El adaptador SQLite v2 realiza la migración transaccional desde v1, conserva el payload de origen y bloquea el progreso si detecta divergencias.

El registro editorial continúa vacío hasta que existan afirmaciones originales revisadas contra pasajes accesibles. Por ello, el runtime se abstiene correctamente ante preguntas narrativas. La integración usa cursores en producción, pero todavía requiere pruebas de reinicio e interrupción sobre SQLite nativo en Android/iOS.

## Fuentes

El módulo utiliza los manifiestos de metadatos y los contratos existentes. `canonicalEvidenceScope()` exige que el `locatorId` coincida exactamente con el localizador del capítulo en el manifiesto de esa edición, y que tanto el capítulo de origen como el umbral de desbloqueo existan en la misma secuencia verificada. Los localizadores disponibles se derivan solo de los TOC inspeccionados; no incorporan títulos ni prosa. Las obras de `cosmere.epub` no reciben localizadores de procedencia hasta que ese EPUB esté disponible en el entorno.

## Límite exclusivo del capítulo actual

El cursor v2 identifica el capítulo actualmente abierto/en curso. No declara que ese capítulo haya terminado. La fachada proyecta el capítulo N a un progreso seguro hasta N-1; el capítulo 1 no aporta ninguna posición narrativa completada. Solo la finalización explícita desbloquea la obra completa.

La proyección también conserva `startedBookIds`. Las recomendaciones eliminan obras presentes en el snapshot aunque el lector esté todavía en el capítulo 1 y aún no exista una unidad completada. Así no se recomienda una obra iniciada como si fuera inédita.

Consulta `docs/hoid/READING_BOUNDARY_POLICY.md`. Esta semántica no altera los cursores almacenados ni la migración SQLite: cambia exclusivamente el límite de autorización entregado al motor editorial.
