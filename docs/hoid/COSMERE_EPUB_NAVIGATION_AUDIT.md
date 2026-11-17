# Auditoría de navegación de `cosmere.epub`

## Alcance y procedencia

Run 106 materializó el EPUB privado disponible en la Library y examinó exclusivamente:

- `META-INF/container.xml`, para localizar el paquete OPF;
- metadatos OPF, para identificar la edición;
- `EPUB/nav.xhtml`, para inspeccionar la tabla de contenidos y sus hrefs relativos.

La huella SHA-256 de `EPUB/nav.xhtml` es:

`85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee`

La navegación contiene 15 grupos principales, 971 entradas enlazadas y 971 hrefs únicos. El catálogo bibliográfico conserva 17 IDs de obras de `cosmere.epub`: Arena blanca aparece como tres volúmenes bibliográficos dentro de un único grupo del índice, mientras que Arcanum ilimitado se conserva como colección.

No se almacenan títulos de capítulos, texto XHTML, pasajes ni EPUBs en el repositorio.

## Localizadores numerados habilitados

Se han incorporado 653 hrefs de capítulos numerados, todos presentes en el archivo y vinculados a `cosmere-epub-merged-v1` y al digest exacto de navegación.

| ID bibliográfico | Localizadores habilitados | Política |
|---|---:|---|
| `tfe` | 38 | Secuencia numérica completa |
| `woa` | 59 | Secuencia numérica completa |
| `hoa` | 82 | Secuencia numérica completa |
| `aol` | 20 | Secuencia numérica completa |
| `sos` | 26 | Secuencia numérica completa |
| `bom` | 31 | Secuencia numérica completa |
| `tlm` | 74 | Secuencia numérica completa; hrefs HTML del índice |
| `warbreaker` | 58 | Secuencia numérica completa |
| `elantris` | 47 | Solo prefijo inequívoco |
| `tress` | 64 | Numeración del índice normalizada a capítulos |
| `yumi` | 41 | Secuencia numérica completa |
| `sunlit` | 52 | Secuencia numérica completa |
| `isles` | 61 | Secuencia numérica completa |
| **Total** | **653** | |

El inventario anterior de Roshar permanece en 453 localizadores. El total estructural combinado es 1.106 localizadores de capítulos, sin que ello implique que esos 1.106 documentos narrativos hayan sido inspeccionados.

## Límites conservadores

### Elantris

El índice contiene 63 valores de capítulo, pero repite los números 48, 51 y 57 en localizadores distintos. Se habilita únicamente el prefijo 1–47. No se inventa una correspondencia para las unidades ambiguas.

### Arena blanca, volúmenes 1–3

El EPUB presenta los tres volúmenes en un único grupo con tres partes y 18 enlaces numerados. El índice no demuestra por sí solo la correspondencia exacta entre esas partes y los tres IDs bibliográficos. Los IDs `white-sand-1`, `white-sand-2` y `white-sand-3` permanecen sin cursores numéricos hasta verificar la segmentación editorial.

### Arcanum ilimitado

Es una colección con secciones y numeraciones locales repetidas. No se crea un contador global. Necesita unidades de lectura por relato/sección antes de permitir progreso parcial.

## Distinción entre estructura y evidencia narrativa

Esta auditoría verifica navegación y existencia de hrefs, no contenido narrativo. No se han añadido hashes de documentos de capítulo para estas obras y no se han creado afirmaciones editoriales nuevas. `verifiedChapterDocuments.ts` conserva únicamente los tres documentos Roshar inspeccionados previamente.

Para incorporar una afirmación narrativa será necesario inspeccionar por separado el documento XHTML exacto, calcular su digest, redactar un resumen original y someterlo a revisión. Un localizador TOC no equivale a una fuente narrativa revisada.

## Archivos relacionados

- `src/hoid/verifiedChapterLocators.ts`
- `src/hoid/editionStructure.ts`
- `src/hoid/verifiedChapterDocuments.ts`
- `src/hoid/cosmereNavigationAudit.test.ts`
