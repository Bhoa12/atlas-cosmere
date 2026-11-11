# Política de progreso de Hoid IA

## Principio fail-closed

Toda respuesta depende del progreso explícitamente validado por obra y posición de lectura. Si falta progreso, es ambiguo o no puede interpretarse de forma inequívoca, el sistema no debe inferirlo a partir de la pregunta ni del conocimiento recuperado.

El progreso solo puede limitar conocimiento: ninguna capa posterior puede repararlo, fusionarlo hacia un capítulo mayor ni ampliarlo mediante una inferencia.

## Posiciones canónicas

Cada posición se valida en tiempo de ejecución antes de entrar en autorización, contexto o recomendaciones.

- `bookId` debe ser un identificador no vacío.
- `chapter`, cuando existe, debe ser un entero finito y no negativo.
- `completed: true` solo expresa finalización de la obra indicada.
- Una posición sin capítulo válido ni finalización explícita no concede acceso.
- Dos posiciones válidas para la misma obra hacen que el estado completo sea ambiguo y se rechace.

No se fusionan duplicados tomando el capítulo mayor.

## Aislamiento entre obras

La autorización compara siempre la posición con la misma obra. Haber avanzado o completado un libro no desbloquea información etiquetada con otro libro, aunque exista relación editorial o narrativa entre ambos.

Los identificadores desconocidos tampoco pueden ampliar autorización. La presencia de una obra en el catálogo no permite inventar su estructura interna, capítulos o hechos.

## Fronteras

1. `readingValidation` valida el progreso de entrada.
2. La autorización decide qué conocimiento queda desbloqueado.
3. `retrieval` solo recupera dentro del conocimiento autorizado.
4. El proveedor recibe un snapshot limitado y no decide permisos.
5. `responseFilter` y `spoilerGuard` aplican una última barrera determinista a la salida.

Todas las rutas públicas que acepten progreso —respuesta, autorización, contexto y recomendaciones— deben reutilizar la validación canónica. Ninguna integración de interfaz puede introducir una interpretación alternativa.

## Recomendaciones

Las recomendaciones derivan del progreso validado y de metadatos del catálogo. No deben presentar obras, capítulos o acontecimientos posteriores como información necesaria para continuar leyendo ni convertir una finalización en una afirmación de dependencia narrativa no verificada.

## Incertidumbre y fuentes privadas

Cuando la estructura de lectura o un pasaje no esté disponible, Hoid IA debe reconocer el límite y evitar inventar hechos, capítulos o continuidad.

La bibliografía privada es un catálogo de procedencia, no una fuente para reproducir texto. Cada entrada de conocimiento debe conservar, cuando esté disponible, su obra y posición de lectura. Los resúmenes deben ser originales y respaldados por metadatos o estructura accesible; la ausencia de acceso a un pasaje se representa como incertidumbre, nunca como un hecho inventado.

## Regla de salida

Una respuesta no debe elevar el progreso efectivo del lector. Si una explicación, recomendación o respuesta del proveedor depende de información posterior a la posición validada, debe bloquearse o reformularse de forma que permanezca dentro del conocimiento autorizado.

## Pruebas requeridas para nuevas fuentes de progreso

Cualquier adaptador nuevo debe cubrir al menos:

1. progreso válido dentro de una obra;
2. aislamiento entre obras;
3. entradas malformadas;
4. duplicados ambiguos;
5. identificadores desconocidos que intenten ampliar autorización.

Esta política mantiene la autoridad de spoilers local, verificable y desacoplada de cualquier proveedor externo.
