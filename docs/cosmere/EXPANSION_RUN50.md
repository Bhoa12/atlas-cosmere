# Cosmere expansion run 50

Esta capa define infraestructura reutilizable para el catálogo del Atlas sin introducir contenido narrativo.

## Límites editoriales

- `verified-index` respalda únicamente metadatos presentes en un índice verificado.
- `declared-private` registra una fuente privada sin afirmar que se haya inspeccionado su texto.
- Los mundos, incluidas las entradas prioritarias de Scadrial, Sel, Nalthis, Taldain y Roshar, son registros de navegación; esta capa no deduce relaciones obra-mundo.
- Las unidades de lectura son metadatos explícitos. No deben inventarse capítulos ni estructura interna a partir del nombre de un EPUB.
- `canReveal` aplica una política *fail-closed*: ante datos incompletos o inconsistentes, el contenido sigue bloqueado.
- No se almacena texto íntegro, citas extensas ni pasajes protegidos.

## Integración del catálogo

Los títulos procedentes del índice verificado de `cosmere.epub` pueden añadirse como `WorkRecord` con la fuente correspondiente. Las fuentes privadas de Roshar pueden registrarse como `declared-private` hasta disponer de metadatos accesibles y verificables para cualquier estructura más detallada.
