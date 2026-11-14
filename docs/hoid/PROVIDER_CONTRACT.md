# Contrato de proveedores de Hoid IA

Este módulo define una frontera desacoplada entre la orquestación de Hoid IA y cualquier proveedor de modelos.

## Entrada mínima

El proveedor recibe únicamente:

- la pregunta normalizada;
- una instantánea de identificadores de evidencia autorizados para la solicitud.

No recibe automáticamente el catálogo privado, el texto de los EPUB ni una autoridad global sobre el Cosmere.

## Salida verificable

Cada afirmación narrativa debe incluir identificadores de evidencia. Tras la generación, `verifyProviderResponse` comprueba cada afirmación contra la frontera inmutable de conocimiento.

La política es de **fallo cerrado**: si una afirmación contiene una referencia desconocida o futura, se rechaza completa. No se elimina solo la referencia, porque el texto podría depender de información no autorizada.

## Intercambiabilidad

`HoidProvider` es una interfaz. La capa superior puede conectar distintos proveedores sin que estos conozcan la implementación del catálogo, la procedencia o las reglas de progreso.

## Límite importante

Un identificador autorizado no sustituye a la comprobación previa de procedencia y progreso. El flujo correcto sigue siendo:

**catálogo → procedencia verificable → admisión por obra y capítulo → frontera de conocimiento → solicitud al proveedor → verificación de salida → explicación/recomendación o abstención**

El contrato no incorpora texto protegido. Las implementaciones deben trabajar con contexto permitido y resúmenes originales respaldados; si un pasaje no es accesible, no puede presentarse como consultado.
