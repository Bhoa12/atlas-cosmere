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


## Referencia editorial española inicial (2026-11-04)

Se confirma el alcance lingüístico inicial: **español**. El inglés no forma parte del primer inventario de unidades; podrá añadirse después como variante editorial independiente.

Para evitar que la paginación de una edición contamine el progreso, cada unidad tendrá un ID semántico estable (obra + tipo + ordinal) y los localizadores físicos se asociarán a una variante editorial identificada por ISBN/formato. La selección de ISBN de referencia sirve para cotejar títulos y estructura; no convierte el número de página en clave de progreso.

ISBN españoles localizados para iniciar el cotejo:

| ID | Título | Edición española de referencia para el primer cotejo | ISBN | Estado |
|---|---|---|---|---|
| `twok` | El camino de los reyes | Ediciones B, 2012, castellano | `9788466647946` | Identificada; existen ediciones posteriores con distinta paginación |
| `wor` | Palabras radiantes | Nova, 2015, castellano | `9788466657549` | Identificada |
| `edgedancer` | Danzante del Filo | Nova, 2026, castellano | `9788410466678` | Identificada |
| `o` | Juramentada | Nova, 2018, castellano | `9788417347000` | Identificada |
| `dawnshard` | Esquirla del Amanecer | Nova, 2021, castellano | `9788418037238` | Identificada |
| `row` | El ritmo de la guerra | Nova, 2020, castellano | `9788417347932` | Identificada |
| `wat` | Viento y verdad | — | — | ISBN/formato español pendiente de cotejo |
| `elsecaller` | Elsecaller | — | — | Edición española independiente no verificada |
| `king-lopen` | King Lopen: The First of Alethkar | — | — | Edición española independiente no verificada |

Los ISBN anteriores se usan como **referencias de cotejo inicial**, no como afirmación de que sean las únicas ediciones válidas. En particular, El camino de los reyes tiene ediciones españolas posteriores (incluida B de Bolsillo, ISBN `9788413143941`) con paginación diferente. La aplicación deberá permitir declarar otra edición sin alterar el progreso semántico.

Antes de dar por cerrado el inventario de una obra, hay que cotejar el índice y la secuencia de secciones del ejemplar/edición de referencia. Cuando no se disponga de evidencia editorial suficiente, la unidad queda pendiente; no se completa por analogía con el original inglés o con una wiki.


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
