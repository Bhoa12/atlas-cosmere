# Cobertura de colecciones bibliográficas

`resolveBibliographySourceCoverage` verifica que la procedencia a nivel de colección sea explícita antes de usar un catálogo como entrada de capas posteriores.

## Contrato

- Cada fuente del catálogo debe tener un identificador único.
- Cada colección debe tener un identificador único y declarar al menos una fuente.
- Una fuente solo puede pertenecer a una colección declarada dentro de esta resolución.
- Una fuente desconocida o una asignación duplicada bloquean el resultado.

## Estados

- `complete`: todas las fuentes están asignadas explícitamente.
- `incomplete`: la estructura es válida, pero quedan fuentes sin asignar.
- `blocked`: los datos son ambiguos o inválidos.

Esta capa no lee EPUB, no interpreta títulos ni infiere relaciones editoriales. La cobertura de procedencia no demuestra acceso narrativo, no crea evidencia y no autoriza divulgación.
