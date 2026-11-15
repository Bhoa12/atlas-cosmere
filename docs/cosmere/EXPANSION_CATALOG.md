# Expansión del catálogo del Cosmere

Esta capa introduce un modelo reutilizable y **orientado a procedencia** para ampliar el Atlas.

## Qué modela

- fuentes bibliográficas;
- mundos prioritarios;
- obras;
- unidades de lectura;
- puertas anti-spoilers.

La lista procedente de `cosmere.epub` se conserva como **metadatos de un índice verificado**. No se convierte por sí sola en capítulos, unidades de lectura, resúmenes ni relaciones narrativas.

## Política de procedencia

Una unidad de lectura solo es válida cuando su fuente está marcada explícitamente como accesible para afirmaciones editoriales. Esto mantiene una política *fail-closed*: si la procedencia es insuficiente, el dato editorial no entra en el modelo.

Las puertas anti-spoilers también se validan contra la obra correspondiente. Un requisito de otra obra o una referencia desconocida invalida el catálogo y mantiene el desbloqueo cerrado.

## Pruebas

`cosmereCatalog.test.ts` utiliza exclusivamente datos sintéticos. Comprueba:

1. que una fuente no accesible no autoriza unidades de lectura;
2. que una unidad respaldada explícitamente puede formar una puerta;
3. que la puerta permanece cerrada hasta completar sus requisitos;
4. que se rechazan requisitos entre obras distintas.

No se incluye texto íntegro de ninguna obra ni se afirma haber consultado pasajes que no estén accesibles.
