# Hoid IA: frontera de seguridad narrativa

## Objetivo

Esta capa autoriza contexto **antes** de cualquier proveedor de IA. Trabaja con progreso explícito, identificadores de obra y capítulo, disponibilidad y resúmenes originales.

## Regla de fallo cerrado

Una evidencia solo entra en el contexto si:

1. pertenece exactamente a la obra indicada en el progreso;
2. su capítulo es igual o anterior al último capítulo declarado;
3. sus metadatos son válidos;
4. está marcada como accesible;
5. dispone de un resumen original no vacío.

Cualquier evidencia futura, de otra obra o inaccesible se excluye. Si no queda evidencia autorizada, el resultado es una abstención técnica, no una invitación a responder con conocimiento general.

## Catálogo de fuentes

La bibliografía aportada se trata como catálogo de metadatos: Mistborn, Elantris, El aliento de los dioses, Arena blanca, novelas independientes, Arcanum ilimitado y las obras privadas de Roshar, incluidas las cinco novelas principales, *Danzante del Filo* y *Esquirla del amanecer*.

Que una obra esté en el catálogo **no demuestra que un pasaje sea accesible** ni autoriza a afirmar hechos de ese pasaje.

## Copyright y proveedores

No se almacena ni transmite texto íntegro de los EPUB. Los proveedores futuros reciben únicamente contexto previamente autorizado y no pueden ampliar el límite de conocimiento. Los resúmenes usados para explicar o recomendar deben ser originales y respaldables mediante evidencia accesible.
