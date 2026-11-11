# Política de respuesta de Hoid IA

Esta política define cómo Hoid IA transforma conocimiento autorizado en explicaciones y recomendaciones sin convertir la respuesta del proveedor en una nueva fuente de autoridad.

## Principio de menor revelación

La respuesta debe usar la menor cantidad de información necesaria para contestar la petición. Que un dato esté autorizado no obliga a incluirlo.

Una respuesta nunca puede:

- elevar el progreso efectivo del lector;
- introducir hechos posteriores para dar contexto;
- usar conocimiento de otra obra como sustituto de una posición no desbloqueada;
- presentar una inferencia o una incertidumbre como un hecho verificado.

## Modos de respuesta

### Explicación

Las explicaciones deben distinguir entre:

- hechos respaldados por conocimiento autorizado;
- contexto editorial o de lectura procedente del catálogo;
- incertidumbre cuando no existe un respaldo accesible.

El sistema debe preferir resúmenes originales y no reproducir texto protegido.

### Preguntas sobre progreso

Cuando una pregunta depende de una posición de lectura, la posición validada es el límite de la respuesta. Si no existe una posición inequívoca, Hoid IA debe reconocer el límite en lugar de adivinar qué parte conoce el lector.

### Recomendaciones

Las recomendaciones se basan en progreso validado y metadatos verificables. Deben explicar el motivo usando únicamente información segura para el lector y no afirmar dependencias narrativas que no estén verificadas.

## Separación de responsabilidades

El proveedor puede redactar, pero no autoriza conocimiento. La aplicación local conserva la autoridad sobre:

1. validación de progreso;
2. autorización de conocimiento;
3. procedencia y posición de lectura;
4. límites de salida;
5. detección y bloqueo de spoilers.

Las respuestas estructuradas con evidencia están sujetas a las mismas reglas finales que las respuestas de texto libre.

## Incertidumbre

Si un pasaje o su estructura no está accesible, Hoid IA no debe afirmar haberlo consultado ni completar el vacío con detalles plausibles. La respuesta debe reducir su alcance, pedir apoyo a metadatos disponibles o declarar la limitación.

Esta política complementa `PROGRESS_POLICY.md`, `SOURCE_CATALOG.md` y `PROVIDER_BOUNDARY.md`: la adaptación al lector y la prevención de spoilers permanecen como garantías locales, verificables e independientes del proveedor.

## Contexto por obra y capítulo

La posición de lectura debe conservar dos límites distintos: la **obra** y la **posición dentro de esa obra**. Hoid IA no debe convertir un capítulo alcanzado en una obra en permiso para revelar contenido de otra, aunque ambas aparezcan en la misma fuente privada.

Cuando la petición mencione una obra distinta de aquella cuyo progreso está validado, el sistema debe evaluar esa obra de forma independiente. La ausencia de progreso verificable significa ausencia de autorización narrativa, no una invitación a estimar lo que el lector probablemente conoce.

## Respuesta segura ante peticiones no autorizadas

Si la información necesaria para responder queda fuera del progreso validado, Hoid IA debe reducir el alcance de la respuesta antes que revelar contexto posterior. Puede:

- explicar el límite sin describir el acontecimiento no autorizado;
- ofrecer una explicación centrada en lo que ya está desbloqueado;
- distinguir claramente entre metadatos seguros y conocimiento narrativo no disponible.

No debe insinuar spoilers mediante pistas, nombres de acontecimientos posteriores, consecuencias, ni preguntas retóricas que permitan inferir contenido bloqueado. Un rechazo seguro también debe respetar el principio de menor revelación.

## Consistencia entre rutas de salida

Toda ruta pública que produzca una respuesta —texto libre, afirmaciones con evidencia, explicación o recomendación— debe aplicar la misma política de alcance narrativo antes de devolver contenido al lector. El formato de salida no puede ampliar permisos.
