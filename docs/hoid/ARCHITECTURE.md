# Hoid IA: arquitectura y política de seguridad

## Objetivo

Hoid adapta explicaciones y recomendaciones al progreso real de lectura sin revelar información posterior. La seguridad frente a spoilers es una frontera del sistema, no una instrucción opcional para el modelo.

## Flujo de confianza

1. Validar la petición y el progreso de lectura.
2. Resolver el contexto permitido por obra y capítulo.
3. Recuperar únicamente metadatos y resúmenes originales autorizados.
4. Crear una instantánea aislada del contexto para el proveedor.
5. Ejecutar el proveedor detrás de un contrato y un límite temporal.
6. Validar la salida en tiempo de ejecución.
7. Aplicar filtros anti-spoiler a la salida.
8. Fallar de forma conservadora si cualquier frontera no puede garantizarse.

Un proveedor nunca decide qué conocimiento está desbloqueado.

## Contratos desacoplados

La capa de aplicación debe depender de interfaces propias para generación, recuperación y filtrado. Las implementaciones concretas de SDK o modelos viven en adaptadores. Esto permite sustituir proveedor, usar un proveedor local o desactivar generación remota sin cambiar las reglas de progreso.

## Catálogo de fuentes

Las fuentes privadas se representan mediante metadatos de obras, estructura de lectura y puntos de desbloqueo. El catálogo conocido incluye la bibliografía aportada por el usuario para Mistborn, Nalthis, Sel, Arena Blanca, las novelas independientes, Arcanum ilimitado y Roshar, incluidas sus novelas principales, Danzante del Filo y Esquirla del amanecer.

No se debe copiar ni subir texto íntegro protegido. Los resúmenes usados por Hoid deben ser originales y respaldados por una fuente accesible. Si un pasaje no está disponible, el sistema debe expresarlo como una limitación y no inventar hechos.

## Política fail-closed

Ante progreso ambiguo, catálogo inconsistente, recuperación no autorizada, salida malformada, timeout o detección de posible spoiler, Hoid debe rechazar o degradar la respuesta en lugar de completar información con una suposición.

## Pruebas mínimas

Las pruebas deben cubrir:

- límites exactos de capítulo y obra;
- conocimiento bloqueado y permitido;
- mutación del estado externo durante una llamada asíncrona;
- proveedores lentos, fallidos o con salida malformada;
- ofuscación Unicode en términos bloqueados;
- aislamiento entre solicitudes;
- ausencia de dependencias directas del dominio hacia SDK concretos.

## Recomendaciones

Las recomendaciones deben usar el mismo contexto autorizado que las explicaciones. Nunca deben sugerir acontecimientos, personajes o revelaciones posteriores como si fueran conocimiento del lector.
