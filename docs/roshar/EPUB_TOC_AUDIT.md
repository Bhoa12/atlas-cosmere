# Auditoría de índices EPUB aportados por el usuario

Fecha de inspección: 2026-11-04. Alcance: metadatos EPUB y tabla de contenidos (NCX/OPF) exclusivamente. No se ha utilizado el texto narrativo para crear resúmenes, afirmaciones de canon ni contenido de enciclopedia.

## Fuentes digitales recibidas

Los tres archivos identifican Epublibre como distribuidor/editor del EPUB, no una editorial comercial ni un ISBN de edición impresa. Se registran como variantes digitales de referencia, sin atribuirles ISBN que no aparecen en sus metadatos.

| Archivo aportado | Obras | Autor | Traducción declarada en OPF | Identificador editorial |
|---|---|---|---|---|
| `El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub` | El camino de los reyes; Palabras radiantes; Juramentada; El ritmo de la guerra; Viento y verdad | Brandon Sanderson | Rafael Marín Trechera | Sin ISBN en los metadatos inspeccionados; Epublibre |
| `4 Danzante del Filo Brandon Sanderson.epub` | Danzante del Filo | Brandon Sanderson | Manu Viciano y Rafael Marín Trechera | Sin ISBN en los metadatos inspeccionados; Epublibre |
| `6 Esquirla del amanecer Brandon Sanderson.epub` | Esquirla del amanecer | Brandon Sanderson | Manu Viciano | Sin ISBN en los metadatos inspeccionados; Epublibre |

## Inventario extraído de las tablas de contenido

Los recuentos siguientes describen entradas del índice EPUB, no una certificación editorial de equivalencia con un ISBN impreso. Los IDs de progreso deberán seguir siendo semánticos y no depender de estos archivos.

| Obra | Partes/días | Capítulos numerados en la secuencia principal | Interludios listados | Otras secciones visibles |
|---|---:|---:|---:|---|
| El camino de los reyes | 5 partes | 75 | 9 | Preludio, prólogo, agradecimientos, epílogo, Ars Arcanum |
| Palabras radiantes | 5 partes | 89 | 14 | Prólogo, agradecimientos, epílogo, Ars Arcanum |
| Juramentada | 5 partes | 122 | 14 | Dos entradas rotuladas como prólogo, agradecimientos, epílogo, Ars Arcanum |
| El ritmo de la guerra | 5 partes | 117 | 12 | Prólogo, agradecimientos, epílogo, nota final, Ars Arcanum |
| Viento y verdad | 10 días | 147 capítulos en la secuencia principal | 16 | Prólogo, agradecimientos, epílogo, postludio, nota final |
| Danzante del Filo | No se muestran partes | 20 | 0 | Prólogo, nota final |
| Esquirla del amanecer | No se muestran partes | 19 | 0 | Prólogo, epílogo |

### Observaciones de calidad del índice

- **Viento y verdad:** la tabla contiene dos entradas numéricas ("12. El dios divino" y "14. La lección equivocada") dentro de bloques de interludios. Se mantienen como anomalías del índice de origen y no se reclasifican ni renumeran por inferencia. El recuento de 147 capítulos se refiere a la secuencia principal visible; hay 149 entradas con aspecto numérico si se incluyen esas dos anomalías.
- **Juramentada:** el índice presenta una entrada genérica "Prólogo" y otra "Prólogo: Sollozar". No se fusionan ni se elimina ninguna sin cotejar el contenido editorial correspondiente.
- **Viento y verdad:** el índice incluye los encabezados "Primer día" a "Décimo día", que deben conservarse como divisiones estructurales, no como capítulos.
- **El camino de los reyes, Palabras radiantes, Juramentada y El ritmo de la guerra:** los títulos de partes e interludios se conservan tal como aparecen en el EPUB. La normalización ortográfica o editorial requiere cotejo, no corrección silenciosa.
- **Danzante del Filo y Esquirla del amanecer:** sus NCX incluyen prólogo, capítulos, notas/epílogo y biografía. La biografía y la cubierta no son unidades de lectura. Las notas finales se conservan como material complementario separado si el producto decide permitir marcarlas como leídas.
- Los agradecimientos y Ars Arcanum aparecen en los índices de algunas novelas. Su tratamiento como unidad de progreso debe ser una decisión de producto uniforme y documentada; no deben confundirse con capítulos narrativos.

## Decisiones de catálogo

1. Se puede usar esta auditoría para construir una primera variante de unidades basada en los tres EPUB recibidos, identificada como fuente digital Epublibre y separada de variantes impresas Nova/Ediciones B.
2. No se asignarán páginas impresas ni ISBN a partir del EPUB.
3. No se corregirán los dos rótulos anómalos de Viento y verdad ni se resolverá el doble prólogo de Juramentada sin evidencia.
4. Las unidades canónicas de progreso tendrán IDs semánticos por obra/tipo/ordinal. La variante de edición solo almacenará etiquetas y localizadores propios de la fuente.
5. Las entradas del índice no autorizan crear contenido de enciclopedia, relaciones, personajes, flora, fauna, clima o datos mágicos. Cada afirmación de canon requiere su propia referencia y gate de spoiler.

## Obras no aportadas

El usuario confirma que no dispone de `Elsecaller` ni `King Lopen: The First of Alethkar`. Se mantienen como obras oficiales en el catálogo general, pero sin unidades de lectura ni contenido hasta conseguir una fuente verificable. No son bloqueantes para avanzar con las siete obras de las que sí hay EPUB o índice.

## Siguiente paso

Crear el catálogo TypeScript de unidades de las siete obras presentes en los EPUB, conservando partes, días, prólogos, capítulos, interludios, epílogos y material complementario en tipos distintos. Antes de conectarlo al progreso o al motor de spoilers, añadir validaciones específicas para anomalías de origen y revisar los datos extraídos frente a la secuencia de lectura de cada EPUB.


## Importación del índice a catálogo ejecutable

Se ha importado el inventario de entradas de lectura desde los tres NCX, preservando orden y rutas de contenido de cada EPUB. El catálogo se encuentra en `src/data/roshar/catalog/readingUnits.ts` y en los módulos por obra bajo `src/data/roshar/catalog/readingUnits/`.

| Obra | Unidades importadas | Capítulos numerados | Secciones estructurales |
|---|---:|---:|---:|
| El camino de los reyes | 89 | 75 | 8 |
| Palabras radiantes | 107 | 89 | 9 |
| Juramentada | 141 | 122 | 9 |
| El ritmo de la guerra | 134 | 117 | 9 |
| Viento y verdad | 170 | 147 | 19 |
| Danzante del Filo | 22 | 20 | 0 |
| Esquirla del amanecer | 21 | 19 | 0 |
| **Total** | **684** | **589** | **54** |

Las unidades incluyen los capítulos y entradas complementarias visibles que se clasificaron de forma explícita: agradecimientos, preludio, prólogos, interludios, epílogos, postludio, Ars Arcanum y notas finales. Los contenedores de partes, días y bloques de interludios son `ReadingSection`, no unidades completables.

### Tratamiento de anomalías

- En Viento y verdad, `12. El dios divino` y `14. La lección equivocada` se importan con tipo `other`, conservan su localizador NCX y siguen dentro de su bloque de interludios. No se les asigna `chapterNumber`.
- En Juramentada se conservan dos unidades de tipo `prologue`, cada una con ID y localizador independientes.
- Los rótulos se copian literalmente del NCX, incluidas posibles erratas de origen. No se normalizan en esta importación.
- Cubiertas, páginas de título y biografías no se importan como progreso de lectura.
- Cada unidad conserva `editionVariantId` y ruta NCX; los ISBN impresos no se asocian a estos EPUB.

La validación automatizada comprueba recuentos de capítulos por obra, ordinales de progreso contiguos, IDs únicos, localizadores, pertenencia a variante editorial, secciones y conservación de las anomalías. La importación es una transcripción estructural del NCX; no constituye cotejo con las ediciones impresas ni revisión del texto narrativo.
