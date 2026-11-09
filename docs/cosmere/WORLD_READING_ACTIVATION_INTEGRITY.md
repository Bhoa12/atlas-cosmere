# Integridad de activación de lectura

`resolveWorldReadingActivationIntegrity` valida los registros estructurales antes de que otra capa cree unidades de lectura, calcule progreso o evalúe visibilidad.

## Garantías

- Cada `worldId` debe aparecer una sola vez.
- `activated` exige `readingReady: true`.
- Cualquier otro motivo exige `readingReady: false`.
- Identificadores vacíos o motivos desconocidos invalidan el conjunto.

La función inspecciona únicamente metadatos ya producidos por la arquitectura. No lee EPUBs, no extrae texto, no verifica hechos narrativos y no autoriza spoilers.

Una respuesta `valid: false` debe tratarse como una frontera de seguridad: las capas posteriores no deben interpretar ninguna activación individual como permiso implícito.
