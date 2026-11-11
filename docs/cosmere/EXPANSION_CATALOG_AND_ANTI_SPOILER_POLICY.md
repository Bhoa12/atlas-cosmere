# Catálogo de expansión y política anti-spoilers

Esta capa separa tres responsabilidades técnicas:

1. **Catálogo de fuentes**: registra únicamente títulos e identificadores presentes en la bibliografía verificada del proyecto.
2. **Asignación a mundos**: se mantiene vacía hasta que exista una fuente o una decisión editorial verificable. El catálogo no deduce mundos a partir del título.
3. **Visibilidad anti-spoilers**: desbloquea contenido mediante IDs de unidades de lectura, sin conocer ni almacenar hechos narrativos.

## Regla de seguridad

Las entradas con IDs vacíos, espacios de relleno, duplicados o estructuras incompatibles se bloquean. La política es *fail-closed*: un error de progreso nunca debe revelar contenido.

## Límites

Esta arquitectura no copia EPUBs, no guarda pasajes protegidos, no inventa capítulos ni resúmenes y no afirma haber inspeccionado una estructura editorial que no esté accesible. Las futuras fichas de Scadrial, Sel, Nalthis, Taldain y otros mundos pueden reutilizar estas interfaces cuando sus metadatos estén verificados.
