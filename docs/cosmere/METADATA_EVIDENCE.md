# Evidencia para metadatos

Esta capa separa los **metadatos utilizables** de la mera existencia de una fuente privada.

## Estados

- `declared`: la fuente o referencia existe en el catálogo, pero el dato concreto no se considera comprobado.
- `verified`: existe un registro de evidencia con identificador, fuente y localizador estructural no vacíos.

## Regla de seguridad

`resolveVerifiedMetadata` solo devuelve valores respaldados por **exactamente un** registro de evidencia verificado. Los identificadores ausentes, duplicados, declarados sin verificar o mal formados fallan de forma segura.

La capa no almacena texto de EPUB, no interpreta pasajes y no convierte una fuente declarada en contenido narrativo. El localizador es deliberadamente estructural y puede representar, por ejemplo, una entrada de índice o un identificador editorial accesible; no debe contener una copia del pasaje protegido.

Esto permite incorporar en el futuro metadatos de Scadrial, Sel, Nalthis, Taldain, Roshar y otros mundos manteniendo una trazabilidad explícita antes de exponer información que pueda afectar al sistema anti-spoilers.
