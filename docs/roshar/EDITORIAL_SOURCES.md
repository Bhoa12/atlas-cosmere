# Fuentes editoriales y alcance del catálogo de Roshar

Última revisión: 2026-11-04.

## Jerarquía de fuentes

1. **Brandon Sanderson / Dragonsteel**: autoridad primaria para denominación de obras, numeración oficial de la serie, descripciones editoriales y anuncios de publicación.
2. **Editoriales** (Macmillan/Tor y editoriales de traducción): autoridad para ediciones concretas, ISBN, formato y estructura de la edición.
3. **Índices de capítulos de Coppermind / 17th Shard**: índice secundario útil para localizar prólogos, capítulos, interludios, epílogos y diferencias entre ediciones. No se importará como dato definitivo sin contraste con el índice de la edición que Atlas vaya a soportar.
4. Catálogos comerciales y bibliografías generales: solo corroboración, nunca fuente única para unidades de lectura.

## Obras principales y novelas cortas

La página oficial de [The Stormlight Archive](https://www.brandonsanderson.com/pages/the-stormlight-archive-series) numera las obras principales como libros 1 a 5 y sitúa Edgedancer como 2.5 y Dawnshard como 3.5. También incluye Elsecaller (2.6) y King Lopen (2.7), relatos escritos para Story Deck con coautores. La página oficial describe Dawnshard como situada entre Oathbringer y Rhythm of War. La página de [Macmillan](https://us.macmillan.com/series/thestormlightarchive) corrobora las cinco novelas y lista Edgedancer y Dawnshard como parte de la serie.

| ID | Obra | Clasificación | Estado de catálogo |
|---|---|---|---|
| `twok` | El Camino de los Reyes / The Way of Kings | Novela | ID legado conservado |
| `wor` | Palabras Radiantes / Words of Radiance | Novela | ID legado conservado |
| `edgedancer` | Danzante del Filo / Edgedancer | Novela corta | ID legado conservado |
| `elsecaller` | Elsecaller | Relato corto | Obra adicional oficial, edición dual 2025 |
| `king-lopen` | King Lopen: The First of Alethkar | Relato corto | Obra adicional oficial, edición dual 2025 |
| `o` | Juramentada / Oathbringer | Novela | ID legado conservado |
| `dawnshard` | Esquirla del Amanecer / Dawnshard | Novela corta | ID legado conservado |
| `row` | El Ritmo de la Guerra / Rhythm of War | Novela | ID legado conservado |
| `wat` | Viento y Verdad / Wind and Truth | Novela | ID legado conservado |

Elsecaller y King Lopen se mantienen como relatos separados aunque se publicaran en un volumen doble: el autor los numera por separado como 2.6 y 2.7. La fuente oficial indica que Elsecaller fue escrito con Dan Wells y King Lopen con Isaac Stewart. La actualización de estado de 2025 señala que la versión publicada de Elsecaller coincide palabra por palabra con la versión de Story Deck.

**Horneater no se incluye como obra publicada ni se inventan unidades.** En el State of the Sanderson 2025, Dan Wells indica que una posible ampliación de Elsecaller a novela corta no está en el calendario. El estado de 2024 situaba Horneater como proyecto futuro; los anuncios de planificación no equivalen a una edición publicada ni autorizan crear unidades de lectura.

## Índices y estructura de lectura

Fuentes secundarias de localización:
- [El Camino de los Reyes — índice de capítulos (Coppermind ES)](https://es.coppermind.net/wiki/El_camino_de_los_reyes/%C3%8Dndice_de_cap%C3%ADtulos)
- [Palabras Radiantes — índice de capítulos (Coppermind ES)](https://es.coppermind.net/wiki/Palabras_radiantes/%C3%8Dndice_de_cap%C3%ADtulos)

Estos índices muestran que las ediciones y formatos pueden tener localizadores diferentes (páginas impresas y marcas de audiolibro). Se usarán como pista de inventario, no como prueba única. Para cada obra, la unidad de lectura debe tener ID estable independiente del localizador físico; `editionVariant` y los localizadores deben conservar la variante de edición. Los títulos de unidades y sus números deben cotejarse con una edición concreta antes de publicar.

## Política de orden

- `publicationOrder`: orden de primera publicación de cada obra individual; no es el orden de lectura y no se infiere de la numeración interna.
- `recommendedReadingOrder`: orden editorial recomendado para lectura. La numeración oficial 1, 2, 2.5, 2.6, 2.7, 3, 3.5, 4, 5 sirve como guía de agrupación, pero los relatos 2.6 y 2.7 están ambientados durante Palabras Radiantes. Se conserva esta diferencia y no se fuerza una cronología de eventos.
- Cronología interna: dimensión independiente; no se asignará sin una fuente clara y específica.
- Los IDs legados `twok`, `wor`, `edgedancer`, `o`, `dawnshard`, `row`, `wat` no se renombrarán.

## Fuentes oficiales consultadas

- Brandon Sanderson, [The Stormlight Archive Series](https://www.brandonsanderson.com/pages/the-stormlight-archive-series): numeración de libros y relatos, introducciones y descripciones de las obras.
- Macmillan, [The Stormlight Archive](https://us.macmillan.com/series/thestormlightarchive): catálogo editorial de novelas y novelas cortas.
- Brandon Sanderson, [State of the Sanderson 2025](https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2025): estado editorial de Elsecaller.
- Brandon Sanderson, [State of the Sanderson 2024](https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2024): estado y planificación de Horneater.

## Pendiente antes de publicar unidades

- Confirmar la edición española de referencia (editorial, ISBN y formato) y decidir si se ofrecerán variantes inglesa/española desde el primer lanzamiento.
- Contrastar la estructura completa de cada obra contra su índice editorial/ejemplar: partes, prólogos, capítulos, interludios, epílogos, apéndices y Ars Arcanum.
- Verificar qué elementos son unidades independientes de lectura y cuáles son material preliminar/final opcional.
- Añadir referencias con localizador de sección por cada afirmación de enciclopedia; un índice de capítulos no es una fuente de canon.
