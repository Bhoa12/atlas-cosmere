# Hoid IA

Base desacoplada de proveedores para Atlas del Cosmere.

## Principio de seguridad

Hoid debe fallar de forma segura: si no puede determinar con certeza que un dato está desbloqueado para el progreso actual, no debe entregarlo.

El flujo previsto es:

`pregunta → autorización por libro/capítulo → contexto permitido → proveedor → filtro final`

Cada frontera es independiente. Un proveedor nunca debe recibir contexto bloqueado, y su respuesta debe volver a pasar por un filtro antes de mostrarse.

## Progreso y aislamiento entre obras

El conocimiento se etiqueta con una obra y un capítulo de desbloqueo. La recuperación compara exclusivamente el progreso de esa misma obra: avanzar en otro libro no desbloquea contenido.

La integración con Atlas debe pasar por un adaptador de progreso. La interfaz de usuario no forma parte del núcleo de Hoid y los contratos internos no deben depender de React ni de un proveedor de IA concreto.

Las posiciones inválidas, desconocidas o ambiguas se tratan como no autorizadas.\n\nLa representación canónica del progreso usa un diccionario sin prototipo. Los identificadores externos, incluidos nombres especiales de propiedades de JavaScript, nunca deben modificar la herencia del estado de autorización.

## Proveedores

Los proveedores se consumen mediante contratos. El núcleo de Hoid no debe depender de una SDK concreta ni contener claves, configuración de red o lógica específica de un modelo.

Cuando no hay proveedor configurado o falla una llamada, el servicio debe comunicarlo explícitamente y no simular una respuesta de IA.

Las llamadas al proveedor también deben tener un límite temporal explícito en la frontera del servicio. Un timeout, rechazo o configuración de plazo inválida debe degradar a la misma respuesta conservadora de proveedor no disponible; nunca se muestra una salida parcial.

## Recomendaciones

Las recomendaciones actuales son deliberadamente conservadoras y se basan únicamente en metadatos del catálogo y en el progreso conocido.

No deben:

- copiar texto de los EPUB;
- inferir hechos argumentales desde fuentes no accesibles;
- afirmar dependencias o un orden de lectura canónico sin respaldo editorial verificado;
- usar progreso de identificadores que no pertenezcan al catálogo.

## Fuentes privadas

Las fuentes privadas se representan únicamente mediante metadatos, estructura de lectura y resúmenes originales respaldados. No se incluyen EPUBs ni texto protegido.

Un elemento de conocimiento debe incorporar una posición verificable antes de añadirse. Si el pasaje o la fuente no está accesible en el entorno, no se inventan hechos ni se afirma haberlo consultado.

## Pruebas mínimas

La cobertura debe incluir como mínimo:

- aislamiento de spoilers entre libros;
- preguntas que mezclan contenido permitido y bloqueado;
- bloqueo antes de llamar al proveedor;
- filtrado de spoilers introducidos por la salida del proveedor;
- progreso inválido o desconocido;
- recomendaciones limitadas a metadatos y obras verificadas.

Cualquier cambio futuro en la arquitectura debe conservar estas garantías antes de añadir capacidades de generación o recuperación más amplias.

## Modelo de amenazas y reglas de frontera

Las defensas anti-spoiler no deben depender de una única capa. Hoid trata como riesgos independientes: una pregunta que intenta inducir revelaciones futuras, un contexto recuperado con etiquetas erróneas, un proveedor que introduce información no autorizada y una integración que entrega progreso ambiguo.

Por ello, cada frontera debe aplicar estas reglas:

- **Entrada:** una petición no amplía por sí misma el conocimiento autorizado; el progreso es la única fuente de desbloqueo.
- **Recuperación:** cada elemento debe tener obra y posición de desbloqueo verificables; sin ambas, se excluye.
- **Proveedor:** recibe solo la pregunta y el contexto ya autorizado; nunca debe recibir una biblioteca completa como atajo.
- **Salida:** cualquier contenido que no pueda justificarse dentro del contexto autorizado se bloquea o se sustituye por una respuesta segura.
- **Degradación:** ante errores, datos incompletos o desacuerdo entre capas, Hoid reduce información en vez de ampliar el acceso.

Estas reglas también permiten sustituir o añadir proveedores sin cambiar la política de spoilers: el contrato del proveedor es una dependencia externa, mientras que la autorización y el filtrado pertenecen al núcleo.


## Contexto y respuestas adaptadas

La adaptación al lector debe producirse sin convertir el historial de lectura en una vía para ampliar conocimiento. El progreso normalizado es la única representación que usan recuperación y proveedores contextuales.

Las explicaciones deben distinguir entre información respaldada por el contexto autorizado y recomendaciones generales basadas en metadatos. Si Hoid no dispone de evidencia suficiente para responder con seguridad, debe reconocer el límite en lugar de completar huecos con hechos inventados.

El límite de contexto se aplica después de la autorización. Reducir el contexto nunca debe cambiar una entrada bloqueada en una autorizada.

### Invariantes para cambios futuros

- validar datos externos en tiempo de ejecución, aunque TypeScript declare un contrato;
- normalizar una vez las entradas de confianza y reutilizar la representación canónica;
- comprobar la salida del proveedor, incluso cuando su entrada haya sido segura;
- mantener pruebas separadas para autorización, recuperación, proveedores y filtros;
- documentar cualquier nueva capacidad de recuperación antes de conectarla a una fuente privada.
