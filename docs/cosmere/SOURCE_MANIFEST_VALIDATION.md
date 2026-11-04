# Validación del catálogo de fuentes privadas

## Objetivo

`validateSourceManifest` comprueba únicamente la integridad técnica de los
metadatos bibliográficos:

- IDs presentes y únicos.
- Títulos presentes.
- Colecciones de origen conocidas.
- Estados de procesamiento permitidos.

La validación **no interpreta títulos** para deducir mundo, trama, capítulos o
cualquier otro hecho editorial. Esto mantiene separado el catálogo de fuentes
de la investigación y evita que la aplicación convierta inferencias en datos.

## Uso previsto

La validación debe ejecutarse antes de incorporar cambios al manifiesto. Cuando
se configure el runner de pruebas del proyecto, sus casos deben cubrir también
manifiestos vacíos, IDs duplicados y estados no permitidos.

## Estados

- `catalogued`: la obra aparece en la bibliografía aportada.
- `structure_pending`: la fuente está catalogada, pero su estructura de
  lectura aún no ha sido verificada desde una fuente accesible.
- `structure_verified`: estructura comprobada y registrada con procedencia.

Cambiar un estado no sustituye la revisión de la fuente. Ningún estado autoriza
copiar texto protegido al repositorio.
