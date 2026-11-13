# Hoid IA: contrato de proveedor y filtro de respuesta

Esta capa separa la generación del modelo de las decisiones de seguridad editorial.

## Frontera

Un proveedor implementa `HoidProvider` y recibe un `HoidPrompt` que contiene únicamente:

- la pregunta del lector;
- contexto ya autorizado;
- identificadores de evidencia permitidos para la solicitud.

El proveedor no recibe progreso mutable, acceso al catálogo completo ni una API de recuperación.

## Evidencia explícita

Cada afirmación estructurada debe declarar los identificadores de evidencia que la respaldan. `verifyClaims` falla de forma cerrada:

- una afirmación vacía se rechaza;
- una afirmación sin evidencia se rechaza;
- cualquier identificador fuera del presupuesto de la solicitud rechaza la afirmación.

El resultado puede conservar las afirmaciones verificadas y descartar las demás. Esto permite respuestas limitadas sin convertir una respuesta parcialmente insegura en una respuesta completamente bloqueada.

## Filtro final

`filterVisibleClaims` solo recibe afirmaciones ya aceptadas y nunca puede recuperar una afirmación rechazada. Los estados son:

- `authorized`: todas las afirmaciones visibles estaban respaldadas;
- `limited`: se eliminó parte de un borrador;
- `blocked`: no quedó ninguna afirmación segura.

## Fuentes privadas

Estas interfaces no almacenan ni transportan pasajes íntegros de EPUB. El contexto debe construirse previamente con identificadores, metadatos, estructura de lectura y resúmenes editoriales originales respaldados. Una fuente inaccesible o de procedencia desconocida no puede convertirse en evidencia autorizada.

## Propiedad de seguridad

Durante una solicitud:

**progreso -> presupuesto -> contexto -> borrador -> verificación -> filtro**

Cada transición puede reducir la información visible, pero ninguna transición posterior puede ampliar el conocimiento autorizado.
