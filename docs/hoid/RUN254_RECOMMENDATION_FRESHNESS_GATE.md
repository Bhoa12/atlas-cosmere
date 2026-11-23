# Run 254 — Validación reutilizable de frescura de recomendaciones

## Objetivo

Centralizar la comparación entre una presentación de recomendaciones y la proyección de progreso que está viva en el host. Antes, HoidScreen repetía comparaciones directas de revisión y fingerprint tanto al terminar la preparación como al decidir si el panel podía seguir visible.

## Contrato

`validateHoidEditionBoundRecommendationFreshness(presentation, currentProjection)` recibe:

- Una presentación no confiable (`unknown`), que puede ser `ready` o `selection-required`.
- Una proyección obtenida por `projectHoidCursorProgressSnapshot()`.

Devuelve uno de cuatro estados:

- `current`: revisión y SHA-256 coinciden exactamente.
- `stale`: la presentación está bien formada, pero pertenece a otra revisión o proyección.
- `invalid-presentation`: la forma de la presentación es inválida, contiene accesores, claves adicionales, arrays dispersos o un fingerprint malformado.
- `invalid-progress`: no existe una proyección actual verificable.

## Integración en HoidScreen

La pantalla utiliza la misma función en dos puntos:

1. Después de la segunda lectura durable, justo antes de guardar la presentación en el estado React.
2. Durante cada render, antes de mostrar recomendaciones ya almacenadas.

Esto elimina comparaciones ad hoc entre `progressRevision` y `progressFingerprint` y mantiene una única definición de frescura para el panel.

Si el progreso cambia, el panel deja de mostrarse. Si la presentación o la proyección no se pueden verificar, también se oculta y no se intenta reparar el objeto.

## Límites de confianza

Esta función valida frescura y estructura mínima del recibo; no autentica títulos, capítulos, localizadores, afirmaciones ni autoridad editorial. Esos controles pertenecen a `createHoidEditionBoundRecommendationPresentation()`, `explainEditionBoundRecommendationResult()`, el ledger validado y `prepareHoidRecommendationNavigationHandoff()`.

El fingerprint es un identificador determinista de la proyección, no una firma ni un permiso. El llamador debe obtener la proyección del runtime local; nunca debe aceptar una proyección proporcionada por un modelo o proveedor.

La navegación continúa revalidando el destino inmediatamente antes del handoff. La comprobación de frescura no abre capítulos, no modifica SQLite y no amplía el conjunto de información desbloqueada.

## Pruebas

La suite `editionBoundRecommendationFreshness.test.ts` cubre:

- Presentación `ready` y selección múltiple vigentes.
- Cambio de cursor manteniendo la misma revisión.
- Cambio de revisión manteniendo el cursor.
- Fingerprints malformados, claves adicionales y arrays dispersos.
- Getters sin ejecutarlos.
- Trampas de Proxy con excepciones.
- Proyección actual no disponible.

El workflow de integración de HoidScreen ejecuta esta suite y aplica TypeScript estricto al nuevo módulo junto con la pantalla.

## Privacidad y spoilers

La validación solo utiliza el ledger de progreso y su proyección canónica, IDs bibliográficos y manifiestos de navegación ya incluidos. No lee EPUB, XHTML ni pasajes protegidos; tampoco genera resúmenes o afirmaciones narrativas. No cambia el progreso ni concede permisos de lectura.
