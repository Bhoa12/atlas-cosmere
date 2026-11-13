# Hoid IA: contrato de contexto mínimo autorizado

## Objetivo

Este contrato define la frontera entre el presupuesto de conocimiento de una solicitud y el contexto que puede entregarse a un proveedor de IA.

La regla es deliberadamente asimétrica: una fase puede eliminar contexto, pero ninguna fase posterior puede recuperar o añadir conocimiento que no estuviera autorizado al inicio de la solicitud.

## Entrada canónica

El constructor de contexto recibe únicamente:

- una instantánea inmutable del progreso del lector;
- un presupuesto de conocimiento ya autorizado;
- una intención de respuesta validada;
- preferencias explícitas del lector cuando sean necesarias para formato o recomendaciones.

No recibe el repositorio editorial completo ni fuentes privadas sin filtrar.

## Salida neutral respecto al proveedor

El resultado debe ser una estructura independiente de cualquier API concreta:

```text
AuthorizedContext
  requestId
  readingSnapshotId
  knowledgeBudgetId
  purpose: explain | answer | recommend
  evidenceIds[]
  editorialSummaries[]
  metadata[]
  constraints[]
```

Los adaptadores de proveedor transforman esta estructura al formato requerido por cada proveedor. Un proveedor no debe decidir qué evidencia entra en el contexto.

## Reglas de selección

1. Cada elemento debe pertenecer al presupuesto de conocimiento de la misma solicitud.
2. Cada elemento narrativo debe tener procedencia permitida.
3. El capítulo asociado no puede superar el progreso de la obra correspondiente.
4. Los elementos sin posición canónica o procedencia verificable se excluyen.
5. Las recomendaciones no necesitan contexto narrativo futuro: deben basarse en progreso, metadatos y preferencias seguras.
6. La ausencia de contexto suficiente produce una respuesta limitada o abstención; nunca se completa con hechos no respaldados.

## Contexto mínimo

El constructor debe seleccionar el subconjunto más pequeño que permita atender la intención. No se debe enviar una obra completa, una colección completa de resúmenes ni evidencia no pertinente simplemente porque ya esté autorizada.

Esto reduce dos riesgos:

- que un proveedor conecte elementos autorizados de una forma que revele una conclusión no solicitada;
- que una integración futura confunda disponibilidad interna con necesidad para la respuesta.

## Reintentos y proveedores alternativos

Un reintento reutiliza el mismo `requestId`, la misma instantánea y el mismo techo de evidencia. Puede recibir un subconjunto más pequeño, pero nunca uno mayor.

Cambiar de proveedor tampoco permite recalcular el progreso ni consultar una fuente adicional para ampliar el contexto.

## Fallos seguros

Si no puede demostrarse que un elemento pertenece al presupuesto, debe excluirse.

Si el presupuesto o la instantánea no están disponibles, el proveedor no debe ser llamado con una aproximación. La solicitud debe terminar en un estado seguro, normalmente `abstain` o `failed_safe`.

## Pruebas mínimas

La implementación debe comprobar al menos:

- un elemento de un capítulo futuro no entra en el contexto;
- una obra sin progreso no aporta evidencia narrativa;
- un reintento no puede aumentar el número de evidencias;
- dos lectores con progreso distinto reciben conjuntos distintos;
- un adaptador de proveedor no puede introducir identificadores de evidencia nuevos;
- una recomendación puede construirse sin cargar conocimiento narrativo posterior.

## Límite de copyright y fuentes privadas

Esta frontera transporta identificadores, metadatos y resúmenes editoriales originales respaldados. No debe copiar, almacenar ni enviar texto íntegro protegido procedente de los EPUB privados.

Cuando un pasaje no está accesible o no puede verificarse en el entorno, debe representarse como conocimiento no disponible. Hoid IA no debe inventar hechos ni afirmar haber consultado ese pasaje.
