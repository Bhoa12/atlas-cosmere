# Política de trazabilidad de decisiones de Hoid IA

## Propósito

Hoid IA debe poder explicar por qué una afirmación, una pieza de contexto o una recomendación fue permitida o bloqueada sin registrar texto protegido ni delegar la decisión en un proveedor.

## Recibo de decisión

Cada frontera puede producir un recibo estructurado y mínimo con:

- tipo de decisión: permitido, rechazado, bloqueado o abstención;
- frontera responsable;
- identificador canónico de obra, cuando sea necesario;
- límite de capítulo previamente validado;
- identificadores de conocimiento, nunca pasajes íntegros;
- motivo normalizado.

El recibo es metadato de control. No contiene la pregunta completa, respuestas completas del modelo ni contenido íntegro de las fuentes privadas.

## Propiedades de seguridad

1. Un recibo describe una decisión ya tomada; nunca autoriza conocimiento.
2. La ausencia de un recibo no convierte una decisión bloqueada en permitida.
3. Un proveedor puede adjuntar identificadores de sus salidas, pero no modificar los límites de obra o capítulo.
4. Los motivos deben ser finitos y normalizados para evitar que mensajes libres introduzcan spoilers.
5. La trazabilidad de una respuesta debe conservar la separación entre obras.

## Aplicación

Las interfaces de usuario pueden mostrar una explicación breve, por ejemplo que una respuesta se ha limitado al progreso registrado. No deben revelar títulos de capítulos futuros, acontecimientos posteriores ni detalles descartados por los filtros.

Esta política complementa la observabilidad: la observabilidad mide el funcionamiento técnico; la trazabilidad explica decisiones de autorización sin ampliar el conocimiento disponible.
