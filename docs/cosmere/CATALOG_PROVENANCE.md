# Procedencia del catálogo

La expansión separa deliberadamente el **catálogo estructural** de la **procedencia bibliográfica**.

`catalogProvenance.ts` valida enlaces explícitos entre:

- un identificador técnico de obra del catálogo;
- un identificador de fuente bibliográfica declarada;
- el título declarado en esa fuente.

## Principio anti-invención

Si una fuente no existe, se informa `unknown_source`; el sistema no elige otra fuente. Si la fuente existe pero no declara el título del catálogo, se informa `work_not_declared_by_source`; el sistema no corrige ni inventa una atribución.

Esta capa no lee EPUB, no indexa capítulos y no contiene texto protegido. Una validación satisfactoria demuestra únicamente coherencia entre metadatos declarados.
