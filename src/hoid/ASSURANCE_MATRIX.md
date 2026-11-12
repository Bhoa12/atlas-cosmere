# Matriz de garantías de Hoid IA

## Propósito

Esta matriz convierte las políticas de Hoid IA en invariantes verificables. No añade conocimiento narrativo: relaciona cada frontera con la propiedad que debe conservar y con la forma de probar una regresión.

## Invariantes

| Frontera | Garantía | Fallo seguro |
| --- | --- | --- |
| Catálogo | Solo identidades canónicas conocidas | Rechazar identidad ambigua o desconocida |
| Progreso | Ninguna entrada aumenta el progreso sin validación | Descartar la posición |
| Autorización | Cada obra se evalúa de forma aislada | No autorizar conocimiento |
| Recuperación | Solo conocimiento autorizado entra en contexto | Contexto vacío o respuesta conservadora |
| Proveedor | No decide el límite de lectura | Filtrar o bloquear la salida |
| Respuesta | Las afirmaciones requieren evidencia autorizada | Eliminar la afirmación |
| Recomendación | Los motivos no revelan acontecimientos | Limitarse a metadatos |
| Incertidumbre | Una fuente inaccesible no se convierte en hecho | Respuesta parcial o abstención |
| Observabilidad | La telemetría no contiene texto protegido ni autoriza contenido | Omitir el evento o registrar solo metadatos |

## Propiedad de no ampliación

Para cualquier solicitud, el conjunto de afirmaciones presentables debe ser un subconjunto del conocimiento autorizado antes de llamar al proveedor. Las etapas posteriores solo pueden conservar, reducir o rechazar ese conjunto.

## Estrategia de pruebas

Cada frontera debe tener pruebas de:

1. caso válido;
2. entrada malformada;
3. entrada sobredimensionada cuando exista un límite;
4. identidad u obra desconocida;
5. aislamiento respecto a otra obra;
6. ausencia de ampliación del conocimiento tras un fallo.

Las pruebas de integración deben comprobar además que una sustitución de proveedor no modifica estas garantías.

## Límite de fuentes

Esta matriz trabaja con contratos, metadatos y resúmenes editoriales originales. La presencia de una obra en el catálogo no demuestra acceso a su texto. Si una estructura o pasaje no está disponible, la prueba debe cubrir abstención o respuesta limitada, nunca una afirmación inventada.

## Uso en revisiones

Una modificación que añada una frontera nueva debe documentar:

- qué dato considera no confiable;
- qué conocimiento puede autorizar;
- cuál es su comportamiento ante fallo;
- qué prueba demuestra que no amplía el conocimiento autorizado.

La matriz complementa el modelo de amenazas, la política de incertidumbre y las políticas de respuesta.