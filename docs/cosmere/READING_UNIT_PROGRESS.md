# Progreso por unidades de lectura

`hasConsistentReadingUnitProgress` valida coordenadas de progreso sobre una lista de unidades **ya declaradas**.

## Reglas

- Cada unidad debe tener un identificador único y un orden entero positivo único.
- Las unidades completadas deben existir exactamente una vez.
- La completitud solo puede formar un prefijo contiguo del orden declarado.
- Una estructura vacía o ambigua falla de forma segura.

## Límites editoriales

Esta utilidad no crea capítulos ni otras unidades, no deduce estructura desde el texto y no lee ni almacena contenido de EPUB. Su resultado solo expresa consistencia técnica del progreso respecto de metadatos ya proporcionados.
