# Validación del catálogo privado

El manifiesto de fuentes privadas contiene únicamente metadatos bibliográficos. La validación comprueba IDs únicos, títulos no vacíos y estados de procesamiento permitidos.

Estas comprobaciones **no leen, extraen ni almacenan texto de los EPUB**. Antes de incorporar límites de capítulos o resúmenes narrativos, la estructura correspondiente debe verificarse desde una fuente accesible y quedar marcada como verificada.

## Ejecución

La función `validatePrivateSourceManifest` es determinista y puede integrarse en la futura suite de pruebas o en CI. No se afirma que exista una suite ejecutada hasta que el repositorio incorpore un runner y un script reproducible.
