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

### Cotejo de El camino de los reyes (2026-11-04)

- **Edición identificada:** Ediciones B, 2012, castellano, traducción de Rafael Marín Trechera, ISBN `9788466647946`. La ficha editorial de Ediciones B confirma título, autor, fecha, formato e ISBN. Google Books confirma editorial, año, traductor, ISBN y extensión bibliográfica de 1196 páginas.
- **Límite de la evidencia disponible:** no se ha localizado en abierto un índice editorial completo de ese ejemplar español. El índice de Coppermind ES ofrece un inventario secundario de capítulos, pero no constituye por sí solo prueba de correspondencia exacta con el ISBN seleccionado. La vista accesible de Google Books muestra el índice de una edición inglesa, no del ejemplar español.
- **Estructura de referencia no española:** el índice de Open Library para la edición inglesa enumera preludio, prólogo, cinco partes, tres bloques de interludios, epílogo, nota final y Ars Arcanum. Se conserva únicamente como lista de comprobación para el cotejo; **no se ha importado al catálogo español ni se han creado unidades a partir de ella**.
- **Decisión:** mantener `twok` sin unidades de lectura publicadas hasta cotejar un ejemplar o índice verificable de la edición española. No asignar páginas españolas por conversión ni deducirlas de la edición inglesa.
- **Siguiente evidencia necesaria:** fotografías o consulta del índice del ejemplar ISBN `9788466647946`, o una vista digital/editorial que identifique inequívocamente esa edición y muestre su índice completo.

Antes de dar por cerrado el inventario de una obra, hay que cotejar el índice y la secuencia de secciones del ejemplar/edición de referencia. Cuando no se disponga de evidencia editorial suficiente, la unidad queda pendiente; no se completa por analogía con el original inglés o con una wiki.

## Fuentes oficiales consultadas

- Brandon Sanderson, [The Stormlight Archive Series](https://www.brandonsanderson.com/pages/the-stormlight-archive-series): numeración de libros y relatos, introducciones y descripciones de las obras.
- Macmillan, [The Stormlight Archive](https://us.macmillan.com/series/thestormlightarchive): catálogo editorial de novelas y novelas cortas.
- Brandon Sanderson, [State of the Sanderson 2025](https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2025): estado editorial de Elsecaller.
- Brandon Sanderson, [State of the Sanderson 2024](https://www.brandonsanderson.com/blogs/blog/state-of-the-sanderson-2024): estado y planificación de Horneater.
- Ediciones B, [El camino de los reyes: La guerra de las tormentas I](https://www.edicionesb.com.mx/Fondo-Editorial/Ediciones-B/El-camino-de-los-reyes-La-guerra-de-las-tormentas-I.html): ficha editorial española con ISBN y formato.
- Google Books, [El camino de los reyes (Ediciones B, 2012)](https://books.google.com/books/about/El_camino_de_los_reyes.html?id=LcqipwAACAAJ): datos bibliográficos y traductor.
- Open Library, [The Way of Kings — índice de la edición inglesa](https://openlibrary.org/books/OL24383834M/The_Way_of_Kings): estructura inglesa usada solo como lista de cotejo, no como catálogo español.

## Pendiente antes de publicar unidades

- Confirmar la edición española de referencia (editorial, ISBN y formato) y decidir si se ofrecerán variantes inglesa/española desde el primer lanzamiento.
- Contrastar la estructura completa de cada obra contra su índice editorial/ejemplar: partes, prólogos, capítulos, interludios, epílogos, apéndices y Ars Arcanum.
- Verificar qué elementos son unidades independientes de lectura y cuáles son material preliminar/final opcional.
- Añadir referencias con localizador de sección por cada afirmación de enciclopedia; un índice de capítulos no es una fuente de canon.


## Índices de los EPUB aportados por el usuario (2026-11-04)

Se han inspeccionado los metadatos OPF y las tablas de contenido NCX de tres archivos EPUB aportados por el usuario. Los archivos identifican Epublibre como distribuidor/editor digital y no exponen ISBN de edición impresa en los metadatos inspeccionados. Por tanto, se registran como **variantes digitales de referencia**, no como prueba de correspondencia exacta con los ISBN impresos Nova/Ediciones B.

| Archivo | Obras | Traducción declarada |
|---|---|---|
| `El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub` | El camino de los reyes, Palabras radiantes, Juramentada, El ritmo de la guerra, Viento y verdad | Rafael Marín Trechera |
| `4 Danzante del Filo Brandon Sanderson.epub` | Danzante del Filo | Manu Viciano y Rafael Marín Trechera |
| `6 Esquirla del amanecer Brandon Sanderson.epub` | Esquirla del amanecer | Manu Viciano |

Recuentos extraídos del NCX:
- El camino de los reyes: 5 partes, 75 capítulos, 9 interludios, preludio, prólogo, epílogo y Ars Arcanum.
- Palabras radiantes: 5 partes, 89 capítulos, 14 interludios, prólogo, epílogo y Ars Arcanum.
- Juramentada: 5 partes, 122 capítulos, 14 interludios, dos entradas rotuladas como prólogo, epílogo y Ars Arcanum.
- El ritmo de la guerra: 5 partes, 117 capítulos, 12 interludios, prólogo, epílogo, nota final y Ars Arcanum.
- Viento y verdad: 10 días, 147 capítulos en la secuencia principal, 16 interludios, prólogo, epílogo, postludio y nota final. Dos entradas numéricas aparecen dentro de bloques de interludios ("12. El dios divino" y "14. La lección equivocada"); se registran como anomalías sin corregirlas por inferencia.
- Danzante del Filo: prólogo, 20 capítulos y nota final.
- Esquirla del amanecer: prólogo, 19 capítulos y epílogo.

La biografía del autor, la cubierta y otros elementos de producción no se convierten en unidades narrativas. Agradecimientos, Ars Arcanum y notas finales quedan identificados como material complementario cuyo tratamiento en progreso requiere decisión uniforme.

El inventario completo y las anomalías están documentados en [EPUB_TOC_AUDIT.md](EPUB_TOC_AUDIT.md). Los títulos de capítulos se conservarán tal como aparecen en el archivo de origen hasta su cotejo editorial; no se corregirán erratas silenciosamente.

El usuario indica que no dispone de Elsecaller ni King Lopen. Ambas obras permanecen en el catálogo general sin unidades de lectura ni contenido. No bloquean el trabajo con las siete obras cubiertas por los EPUB.
