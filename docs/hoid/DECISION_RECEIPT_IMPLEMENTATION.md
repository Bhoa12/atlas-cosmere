# Implementación de trazabilidad segura

`decisionReceipt.ts` implementa el contrato de recibos de decisión descrito por la política de trazabilidad.

## Qué puede contener

Un recibo solo admite valores estructurados y acotados:

- resultado normalizado: `authorized`, `limited`, `blocked` o `abstain`;
- frontera responsable;
- motivo técnico normalizado mediante un identificador, no una frase libre;
- identificador canónico de obra y capítulo, si ya fueron validados;
- identificadores de evidencia, sin resúmenes ni pasajes.

## Qué no puede contener

No se admiten preguntas del lector, respuestas del proveedor, citas, resúmenes narrativos ni motivos en lenguaje libre. Los campos opcionales malformados se omiten y una estructura esencial inválida se rechaza por completo.

El recibo **describe** una decisión ya tomada: no autoriza conocimiento y nunca se utiliza para ampliar el contexto de lectura.
