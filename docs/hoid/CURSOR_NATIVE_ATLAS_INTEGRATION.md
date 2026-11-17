# Integración cursor-native de Atlas y Hoid

## Objetivo

Esta integración hace que el snapshot v2 de cursores sea la única fuente autoritativa del progreso de lectura. El formato numérico de Atlas se conserva únicamente como proyección de presentación para componentes que todavía muestran capítulos.

## Composición

- `CosmereContext` inicializa `createExpoHoidCursorProgressCoordinator()`.
- El adaptador Expo abre SQLite y compone el store v2.
- `HoidCursorProgressCoordinator` valida y serializa las operaciones.
- `atlasProgressFromCursorSnapshot()` proyecta los cursores validados a mapas numéricos de solo lectura para la interfaz.
- `HoidScreen` entrega el snapshot v2 directamente a `HoidCursorEvidenceRuntime`; no reconstruye autorización desde los mapas de presentación.

## Reglas de escritura

- Marcar una obra como leída llama a `complete()`; nunca se infiere la finalización al llegar al último capítulo.
- Reabrir una obra terminada requiere confirmación explícita en la interfaz y llama a `reopenCompletedWork()`.
- Avanzar un capítulo crea un cursor desde el manifiesto actual y llama a `advance()`.
- Los retrocesos siguen rechazados por la operación ordinaria. Las correcciones deliberadas deben usar una acción separada con confirmación.
- Obras sin una primera unidad numérica verificada no pueden reabrirse mediante un capítulo inventado.

## Seguridad de lectura

El snapshot v2 completo es la única entrada de progreso para el runtime de Hoid. Los mapas `capituloActualPorLibro` y `librosLeidos` son proyecciones para vistas heredadas y no se usan en `HoidScreen` ni en el selector de afirmaciones.

Si falla la migración, la validación, SQLite o la proyección, el contexto pasa a `unavailable`, descarta el snapshot en memoria y bloquea las consultas y los cambios de lectura.

El runtime cursor-native vuelve a validar el snapshot y cada manifiesto antes de invocar al selector. El registro editorial continúa vacío hasta que haya afirmaciones originales revisadas contra pasajes accesibles.

## Compatibilidad y migración

El store v2 migra el registro v1 dentro de una transacción exclusiva y conserva el payload v1 original junto con el justificante de migración. Cualquier divergencia posterior del origen v1 bloquea el acceso v2. No hay fallback automático al progreso antiguo.

La proyección numérica no se persiste ni puede convertirse en una segunda fuente de verdad.

## Limitaciones

- Persistencia local nativa; no hay sincronización entre dispositivos.
- Web permanece bloqueado hasta disponer de un store transaccional independiente.
- El manifiesto actual solo cubre capítulos numéricos verificados. Prólogos, interludios, epílogos, Arena blanca y Arcanum ilimitado siguen sin recibir cursores inventados.
- La integración no incorpora texto de EPUB ni afirmaciones narrativas nuevas.
- El registro editorial vacío implica abstención de Hoid ante preguntas narrativas.

## Verificación

`cursorAtlasAdapter.test.ts` comprueba la proyección de progreso parcial, finalizaciones explícitas, aislamiento entre obras, snapshots corruptos, ausencia de mutaciones y mapas sin prototipo.

La suite de integración debe ejecutar también el coordinador cursor-native, el store SQLite v2, el ledger v2, el runtime de evidencias y la validación de manifiestos. Las pruebas simuladas no sustituyen una prueba en dispositivo Android/iOS.
