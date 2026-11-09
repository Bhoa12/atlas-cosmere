# Cobertura de mundos del catálogo

`resolveWorldCatalogCoverage(...)` conecta el catálogo bibliográfico con identificadores de mundos mediante asignaciones explícitas de metadatos.

## Entrada

- Un catálogo previamente válido.
- Asignaciones `catalogEntryId -> worldId`.
- Una lista explícita de mundos cuya cobertura se desea comprobar.

La función no deduce la pertenencia de una obra a un mundo a partir del título, el nombre de un EPUB, una serie o conocimiento narrativo.

## Resultado

- `complete`: cada mundo esperado tiene al menos una obra asignada explícitamente.
- `incomplete`: se devuelven únicamente los mundos esperados sin cobertura declarada.
- `blocked`: el catálogo o las asignaciones son ambiguos o inválidos.

## Seguridad

El diseño es *fail-closed*. Se bloquea, entre otros casos, ante:

- identificadores de mundo esperados duplicados;
- asignaciones duplicadas para la misma entrada del catálogo;
- entradas asignadas que no existen en el catálogo;
- identificadores vacíos.

Una cobertura completa solo confirma relaciones de metadatos declaradas. No prueba que se haya leído una fuente privada, que se haya verificado un hecho narrativo, que exista una estructura interna de lectura ni que un contenido sea seguro frente a spoilers.

Esta capa puede alimentar la planificación estructural de Scadrial, Sel, Nalthis, Taldain, Roshar y futuros mundos sin transportar texto protegido.
