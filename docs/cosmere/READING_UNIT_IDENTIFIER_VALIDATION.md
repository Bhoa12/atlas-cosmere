# Validación de identificadores de unidades de lectura

La validación de progreso por unidades es deliberadamente **fail-closed**. Además de exigir una estructura única y un prefijo contiguo de unidades completadas, los identificadores deben ser cadenas no vacías.

Esto evita que valores malformados procedentes de almacenamiento, migraciones o integraciones puedan compararse accidentalmente con la estructura declarada y producir un estado de progreso aparentemente válido.

Esta regla es técnica y estructural: no crea capítulos, no interpreta EPUB ni afirma que una obra o pasaje haya sido consultado. Las unidades siguen teniendo que existir previamente en una estructura declarada y respaldada.
