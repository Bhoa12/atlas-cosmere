# Normalización de checkpoints

`normalizeCheckpointStates` convierte representaciones técnicas equivalentes del progreso en un formato canónico antes de evaluar puertas anti-spoilers.

## Garantías

- Solo conserva identificadores de obra no vacíos.
- Solo conserva posiciones enteras positivas declaradas por la entrada técnica.
- Fusiona estados repetidos de la misma obra y elimina duplicados.
- Ordena de forma determinista para facilitar pruebas y persistencia.

## Límites editoriales

La normalización no consulta EPUBs ni determina qué posiciones corresponden a capítulos reales. Tampoco añade posiciones intermedias, rellena huecos ni deduce progreso narrativo. Debe combinarse con la validación del catálogo cuando una posición vaya a utilizarse para desbloquear contenido.
