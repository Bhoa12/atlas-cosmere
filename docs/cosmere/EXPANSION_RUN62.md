# Expansión del Cosmere: Run 62

Esta iteración añade dos utilidades reutilizables sin incorporar contenido narrativo:

1. **Decisiones explicables anti-spoilers.** `evaluateReveal` devuelve un código estructural y las unidades pendientes. No incluye resúmenes, citas ni texto de ninguna obra.
2. **Relaciones mundo–obra respaldadas.** `validateWorldWorkRelations` exige que mundo, obra y fuente existan en el catálogo y detecta relaciones duplicadas. La función no deduce pertenencia a un mundo a partir de títulos.

## Procedencia

La bibliografía proporcionada por el usuario puede seguir utilizándose como catálogo de fuentes. Un índice verificado respalda únicamente los metadatos presentes en ese índice. Una fuente privada declarada no implica que su contenido interno haya sido consultado.

## Política de seguridad

- No almacenar texto íntegro protegido.
- No inventar capítulos, unidades ni hechos narrativos cuando un pasaje no sea accesible.
- Mantener los resúmenes como contenido original y respaldado.
- Aplicar una política **fail-closed**: ante requisitos ambiguos, duplicados, desconocidos o ajenos a la obra, el contenido permanece bloqueado.

Las pruebas de esta iteración usan exclusivamente datos sintéticos.
