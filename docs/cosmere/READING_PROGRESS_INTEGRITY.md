# Integridad de unidades y progreso de lectura

`resolveReadingProgressIntegrity` valida metadatos estructurales antes de que el progreso se use para desbloquear contenido.

## Contrato

La entrada declara explícitamente:

- unidades de lectura con `id`, `workId` y posición positiva;
- progreso por obra con unidades completadas.

La capa bloquea el conjunto completo cuando encuentra:

- identificadores de unidad duplicados;
- posiciones duplicadas dentro de una obra;
- progreso duplicado para la misma obra;
- unidades completadas desconocidas;
- una unidad completada perteneciente a otra obra;
- identificadores o posiciones inválidos.

## Límite editorial

Esta validación **no crea unidades de lectura** ni deduce capítulos, partes o posiciones a partir de títulos o conocimiento externo. Las unidades deben proceder de estructura verificable.

Un resultado válido tampoco demuestra que se haya leído texto privado ni autoriza por sí mismo contenido con spoilers. La evidencia narrativa y la autorización anti-spoilers siguen siendo capas independientes.

El comportamiento es *fail-closed*: ante incoherencias no se devuelve una instantánea parcial utilizable.
