# Persistencia cursor-native de Atlas

## Fuente autoritativa

El snapshot v2 de cursores es ahora la única fuente autoritativa del progreso. `CosmereContext` mantiene mapas numéricos únicamente como proyección de presentación para componentes heredados. HoidScreen recibe el snapshot v2 completo y nunca reconstruye la autorización desde esos mapas.

## Secuencia de inicio

1. El contexto empieza con mapas vacíos y estado `loading`; esos mapas no se consideran progreso autorizado.
2. `createExpoHoidCursorProgressCoordinator()` abre `atlas-cosmere-hoid.db`.
3. `ExpoSqliteHoidCursorProgressStore` crea las tablas necesarias y lee v1, v2 y el justificante dentro de una transacción exclusiva.
4. Si todavía no existe v2, valida el snapshot v1 completo, convierte todas las posiciones inequívocas a cursores y escribe snapshot v2 y justificante en una misma transacción.
5. Conserva el payload v1 exacto como origen de migración y comprueba que no haya divergido.
6. `HoidCursorProgressCoordinator` valida el snapshot y lo expone a Atlas.
7. `atlasProgressFromCursorSnapshot()` genera los mapas de presentación. Hoid recibe el snapshot original, no la proyección.

Si falla la migración, el snapshot, el manifiesto, la proyección o SQLite, el contexto pasa a `unavailable`, elimina el snapshot en memoria y bloquea las consultas y los cambios. No hay fallback automático a v1 ni a progreso vacío.

## Operaciones de escritura

- Marcar una obra como leída registra `completed: true`; no se infiere al llegar al último capítulo.
- Reabrir una obra terminada exige una confirmación explícita de la interfaz y utiliza `reopenCompletedWork()`.
- Avanzar capítulos crea un cursor desde el manifiesto actual y utiliza `advance()`.
- Los retrocesos están bloqueados por la operación ordinaria. Las correcciones deben utilizar `correctCursor()` con confirmación diferenciada.
- Obras sin primera unidad verificada no se reabren mediante un capítulo inventado.
- El coordinador serializa operaciones locales y el store aplica compare-and-swap dentro de SQLite.

## Migración y protección de versiones antiguas

El snapshot v2 y el marcador se insertan en la misma transacción exclusiva. El marcador conserva versión, revisión y payload exacto del origen v1. Cada lectura y escritura v2 comprueba que el registro v1 conservado siga coincidiendo con el marcador. Cualquier divergencia bloquea v2. El registro v1 se conserva para trazabilidad, pero no vuelve a ser una fuente alternativa tras el corte.

## Plataforma y alcance

- Android/iOS nativos.
- Expo SDK 51 y `expo-sqlite ~14.0.6`.
- La API de transacciones exclusivas no está soportada en web; web permanece bloqueado hasta disponer de otro adaptador transaccional verificado.
- Persistencia local de un solo dispositivo. No hay sincronización en la nube.
- La base almacena metadatos de lectura, no EPUBs ni pasajes protegidos.

Referencias oficiales:
- [Expo SDK 51](https://expo.dev/changelog/2024-05-07-sdk-51)
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## Verificación y limitaciones

La CI cubre el contrato del coordinador, el ledger v2, el adaptador SQLite simulado, la migración y el runtime. Esas pruebas no equivalen a una prueba física de Android/iOS. Antes de publicar debe verificarse en dispositivo el cierre y reapertura de la app, una migración interrumpida, un rollback transaccional y la detección de una escritura v1 concurrente.

El registro editorial sigue vacío hasta que haya pasajes accesibles y afirmaciones originales revisadas. Por tanto, Hoid debe abstenerse de responder preguntas narrativas.
