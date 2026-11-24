# Run 274 — auditoría estructural de EPUBs de Roshar

## Alcance y método

El 24 de noviembre de 2026 se inspeccionaron tres EPUB privados disponibles en la Library:

- El EPUB recopilatorio **El Archivo de las Tormentas 1–5**.
- **Danzante del Filo**.
- **Esquirla del amanecer**.

La inspección se limitó a `META-INF/container.xml`, metadatos OPF, manifiesto/spine y documento de navegación (`nav.xhtml` o `toc.ncx`). Se comprobó la integridad ZIP y que cada referencia del spine apunta a un elemento del manifiesto. No se abrieron cuerpos de capítulos, no se extrajo prosa, no se generaron resúmenes y no se copiaron títulos de capítulos al repositorio.

## Resultados estructurales

| Edición | Tamaño | Idioma OPF | Elementos spine | Referencias spine ausentes | SHA-256 de navegación |
|---|---:|---|---:|---:|---|
| Archivo de las Tormentas 1–5 | 97.318.466 bytes | es-ES | 849 | 0 | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` |
| Danzante del Filo | 2.176.643 bytes | es | 30 | 0 | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` |
| Esquirla del amanecer | 2.062.124 bytes | es | 31 | 0 | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` |

Las tres pruebas de integridad ZIP finalizaron sin errores. Los tres hashes de navegación coinciden exactamente con los valores ya registrados en `editionStructure.ts` y `verifiedChapterLocators.ts`.

## Comprobación de capítulos numerados

El TOC del EPUB recopilatorio contiene cinco secciones de novela con estas secuencias numéricas:

| Obra | Números de capítulo distintos | Entradas numéricas del TOC | Estado |
|---|---:|---:|---|
| El camino de los reyes | 75 | 75 | Completo |
| Palabras radiantes | 89 | 89 | Completo |
| Juramentada | 122 | 122 | Completo |
| El Ritmo de la Guerra | 117 | 117 | Completo |
| Viento y verdad | 147 | 149 | Ambiguo en 12 y 14 |

Las dos entradas adicionales de Viento y verdad corresponden a números repetidos (12 y 14). El manifiesto conserva por tanto solo el prefijo numérico 1–11. No se amplía el progreso más allá de ese límite mientras el modelo de progreso no pueda identificar inequívocamente cada unidad.

Los NCX de las novelas cortas contienen 20 capítulos numerados en Danzante del Filo y 19 en Esquirla del amanecer. Se comprobó también el primer href de cada NCX: `Text/001.xhtml` y `Text/1.xhtml`, respectivamente.

## Cambios de Run 274

- Amplía `verifiedChapterLocators.test.ts` con comprobaciones exactas de los primeros localizadores de Danzante del Filo y Esquirla del amanecer.
- Conserva los recuentos existentes para las cinco novelas y el límite conservador de Viento y verdad.
- No modifica manifiestos de producción, hashes, localizadores, progreso, ledger ni permisos narrativos.
- No incorpora EPUB, XHTML, texto protegido ni rutas privadas.

## Fuente Cosmere no disponible en esta inspección

La búsqueda de archivos EPUB en la Library devolvió las tres ediciones de Roshar anteriores (con entradas duplicadas por nombre), pero no `cosmere.epub`. Por ello, este run no revalida su navegación ni sus capítulos. Se conservan sin cambios el catálogo y los metadatos previamente registrados; no se afirma haber vuelto a abrir ese archivo.

## Consecuencia para la arquitectura de Hoid

Esta auditoría verifica estructura de lectura, no conocimiento narrativo. Un hash de TOC y un localizador demuestran que existe una ruta de navegación de una edición concreta; no prueban el contenido de un capítulo ni autorizan afirmaciones. La autoridad editorial, las evidencias originales revisadas y el desbloqueo independiente por obra/capítulo siguen siendo obligatorios.
