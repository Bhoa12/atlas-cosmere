# Política de progreso de Hoid IA

## Principio fail-closed

Toda respuesta depende del progreso explícitamente validado por obra y capítulo. Si falta progreso, el sistema no debe inferirlo a partir de la pregunta ni del conocimiento recuperado.

## Fronteras

1. `readingValidation` valida el progreso de entrada.
2. `readingAuthorization` decide qué conocimiento queda desbloqueado.
3. `retrieval` solo recupera dentro del conocimiento autorizado.
4. El proveedor recibe un snapshot limitado y no decide permisos.
5. `responseFilter` y `spoilerGuard` aplican una última barrera determinista a la salida.

## Recomendaciones

Las recomendaciones deben derivarse del progreso validado y no revelar obras, capítulos o acontecimientos posteriores como información necesaria para continuar leyendo.

## Incertidumbre

Cuando la estructura de lectura o un pasaje no esté disponible, Hoid IA debe reconocer el límite y evitar inventar hechos, capítulos o continuidad.

## Catálogo y fuentes

La bibliografía privada es un catálogo de procedencia, no una fuente para reproducir texto. Cada entrada de conocimiento debe conservar, cuando esté disponible, su obra y posición de lectura. Los resúmenes deben ser originales y respaldados por metadatos o estructura accesible; la ausencia de acceso a un pasaje se representa como incertidumbre, nunca como un hecho inventado.

## Regla de salida

Una respuesta no debe elevar el progreso efectivo del lector. Si una explicación, recomendación o respuesta del proveedor depende de información posterior a la posición validada, debe bloquearse o reformularse de forma que permanezca dentro del conocimiento autorizado.
