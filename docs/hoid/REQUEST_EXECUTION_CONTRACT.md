# Contrato de ejecución de una solicitud segura

## Objetivo

Este contrato define cómo Hoid IA ejecuta una solicitud desde la pregunta del lector hasta una respuesta visible. Su función es impedir que una fase posterior amplíe el conocimiento autorizado, incluso cuando un proveedor externo falle, sea sustituido o produzca contenido inesperado.

Este documento trabaja sobre los contratos de catálogo, progreso, procedencia y verificación ya definidos. No autoriza el uso de texto íntegro protegido.

## Entrada mínima

Una ejecución recibe únicamente:

- una pregunta del lector;
- una instantánea validada e inmutable de su progreso;
- el catálogo canónico aplicable;
- registros editoriales con procedencia conocida;
- preferencias explícitas necesarias para recomendaciones.

La pregunta no modifica el progreso. Las instrucciones incluidas en la pregunta tampoco pueden cambiar el catálogo ni desbloquear una obra o capítulo.

## Presupuesto de conocimiento

Antes de invocar cualquier proveedor, el núcleo calcula un presupuesto de conocimiento para esa solicitud.

El presupuesto contiene:

- obras canónicas autorizadas;
- límite de lectura por obra;
- identificadores de evidencia editorial autorizados;
- metadatos seguros para recomendaciones.

El presupuesto es inmutable durante toda la ejecución. Un reintento reutiliza el mismo presupuesto; nunca vuelve a consultar un estado de progreso mutable para obtener un límite mayor.

## Máquina de estados

La ejecución debe avanzar solo en esta dirección:

`received -> validated -> budgeted -> contextualized -> proposed -> verified -> filtered -> completed`

Estados terminales seguros:

- `authorized`: toda la respuesta visible está respaldada.
- `limited`: solo se conserva la parte respaldada y segura.
- `blocked`: la propuesta no contiene contenido visible que pueda autorizarse.
- `abstain`: no existe base suficiente o la solicitud no puede ejecutarse con seguridad.
- `failed_safe`: fallo técnico sin exposición de contexto no autorizado.

Una transición terminal no puede reabrirse para intentar ampliar el conocimiento.

## Proveedor desacoplado

El proveedor recibe un contrato de entrada limitado al contexto autorizado. No recibe acceso directo al repositorio editorial completo, al historial global del lector ni a una API que pueda consultar capítulos futuros.

La salida del proveedor es una propuesta no confiable. Cambiar de proveedor no puede modificar las reglas de autorización.

Si el proveedor devuelve texto libre, ese texto no adquiere evidencia implícita. Si devuelve afirmaciones estructuradas, cada afirmación debe pasar la verificación local de evidencia antes de poder mostrarse.

## Recomendaciones

Las recomendaciones se calculan en un carril separado del conocimiento narrativo. Pueden usar:

- progreso validado;
- metadatos de obras;
- preferencias explícitas;
- reglas editoriales no narrativas.

No pueden justificar una recomendación revelando acontecimientos de contenido todavía no autorizado.

## Fallos y reintentos

Los siguientes fallos deben ser conservadores:

- catálogo ambiguo o no resoluble -> `abstain`;
- progreso inválido -> `abstain`;
- procedencia desconocida -> excluir evidencia;
- proveedor no disponible -> `failed_safe` o respuesta limitada sin proveedor;
- verificación de salida fallida -> `blocked` o `abstain`.

Un reintento no puede añadir obras, capítulos ni evidencias al presupuesto original.

## Observabilidad segura

La trazabilidad puede registrar:

- estado terminal;
- frontera que tomó la decisión;
- identificadores canónicos;
- límites de capítulo ya validados;
- identificadores de evidencia.

No debe registrar pasajes narrativos, explicaciones libres que revelen contenido futuro ni prompts completos con contexto editorial sensible.

## Pruebas obligatorias

Las integraciones deben demostrar, como mínimo:

1. que una actualización del progreso durante una solicitud no cambia su presupuesto;
2. que un proveedor no puede introducir una evidencia inexistente o no autorizada;
3. que un reintento conserva exactamente el mismo techo de conocimiento;
4. que un fallo de recuperación no provoca acceso a un catálogo más amplio;
5. que las recomendaciones no dependen de detalles narrativos futuros;
6. que los registros de trazabilidad no contienen contenido narrativo;
7. que dos solicitudes de lectores con progreso distinto no comparten autorización.

## Regla de cierre

La respuesta visible solo puede depender del presupuesto calculado al inicio y de transformaciones que reduzcan o preserven ese presupuesto. Ninguna transformación posterior puede ampliarlo.

Cuando la información necesaria no esté accesible o no pueda verificarse, Hoid IA debe declarar el límite de forma prudente o abstenerse. No debe inventar hechos ni afirmar haber consultado una fuente no disponible.
