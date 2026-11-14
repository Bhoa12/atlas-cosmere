# Hoid IA: presupuesto mínimo de contexto

## Objetivo

Antes de llamar a cualquier proveedor, Hoid IA construye un **presupuesto de contexto**: la lista exacta de posiciones narrativas que una solicitud puede utilizar.

El presupuesto no se deriva del conocimiento general del modelo ni de la mera presencia de una obra en el catálogo.

## Reglas

Una posición `workId + chapter` solo entra si:

1. la obra tiene progreso verificable en la instantánea de la solicitud;
2. el capítulo es un entero positivo;
3. el capítulo no supera el progreso registrado;
4. la posición fue solicitada explícitamente;
5. no duplica otra posición del presupuesto.

Por tanto, haber llegado al capítulo 10 no concede automáticamente acceso a todos los hechos que un proveedor pueda conocer sobre esa obra. La capa de evidencia sigue siendo responsable de aportar contenido respaldado para cualquier posición autorizada.

## Invariantes de seguridad

- **Mínimo privilegio:** no se añaden capítulos anteriores o de otras obras por inferencia.
- **Aislamiento por obra:** el progreso en una obra no autoriza contenido de otra.
- **Fallo cerrado:** obras desconocidas, capítulos futuros y posiciones malformadas se excluyen.
- **Inmutabilidad:** el resultado se congela para que una solicitud no pueda ampliar silenciosamente su contexto durante la ejecución.

## Integración

La secuencia recomendada es:

`progreso normalizado → presupuesto mínimo → selección de evidencia respaldada → contexto del proveedor → verificación final`

El proveedor recibe únicamente contexto que ya haya superado estas fronteras y no puede ampliar el presupuesto.

## Fuentes privadas

Los EPUB privados sirven como catálogo y, cuando exista acceso verificable, como respaldo para resúmenes originales. No se copia ni se publica texto íntegro protegido. Si una posición no dispone de contenido accesible y respaldado, el presupuesto no autoriza inventar ni atribuir hechos a esa fuente.
