# Run 178 — El Imperio Final, capítulo 7

## Resultado

Se inspeccionó un único documento de capítulo de `cosmere.epub` y se añadió un resumen editorial original al staging. El documento queda ligado a la edición registrada y al límite de lectura del capítulo siguiente.

## Verificación de la fuente

| Comprobación | Resultado |
|---|---|
| Archivo privado seleccionado | `cosmere.epub` |
| Tamaño del contenedor | 291,827,353 bytes |
| Entradas ZIP | 3,288 |
| CRC del contenedor completo | Correcto |
| Edición | `cosmere-epub-merged-v1` |
| SHA-256 de `EPUB/nav.xhtml` | `85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee` |
| Localizador relativo | `books/b000001/OEBPS/Text/007.xhtml` |
| Etiqueta de navegación | Capítulo 7 |
| Coincidencias en OPF manifest | 1 |
| Presencia en reading spine | Sí |
| Tamaño XHTML | 41,912 bytes |
| SHA-256 del XHTML | `fd79119ff64538b1d9fbe0d5d40ff9db8215afd144a27071c7c35b19b5ed1ac3` |

El digest de navegación coincide exactamente con la edición ya registrada. El destino se resolvió desde la navegación, se confirmó en el manifiesto OPF y en el spine, y solo entonces se calculó la huella de los bytes XHTML originales.

## Registro editorial

- Draft ID: `tfe.chapter-007.marsh-vin-training`
- Tipo: `event`
- Obra: `tfe`
- Capítulo fuente: 7
- Localizador: `nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/007.xhtml`
- Unlock watermark: capítulo 7 completado
- Cursor mínimo: capítulo 8
- SHA-256 del resumen original: `86a081069be4acd3dde6d0cd6ff29eef181a5fcce4b1d71bfefeb5347d132914`
- Estado: `pending-review`

El resumen es prosa editorial original; no se almacenan citas, transcripciones ni pasajes del capítulo. La validación de staging comprueba el digest del resumen y el digest del documento de origen.

## Efecto sobre el conocimiento

El inventario pasa a 54 documentos de capítulo inspeccionados y 54 resúmenes originales pendientes de revisión. Se mantienen las 24 obras del catálogo y los 1,106 localizadores de navegación verificados.

- Afirmaciones aprobadas: 0
- Entradas de conocimiento de producción: 0
- Registro de producción: vacío
- Recibo de activación: `null`

El nuevo resumen no se expone al runtime de respuestas ni a proveedores hasta completar la revisión independiente y la promoción editorial autorizada.

## Privacidad

No se añadió al repositorio el archivo EPUB, el XHTML, texto extraído, imágenes, rutas privadas ni identificadores de archivo de Library. El archivo materializado se utilizó únicamente para esta inspección local.
