# Contrato de respuesta segura de Hoid IA

## Propósito

La salida de un proveedor es una propuesta no confiable. Antes de presentarla al lector, Hoid IA debe conservar el mismo límite de conocimiento autorizado por obra y capítulo.

## Estados de salida

Una respuesta pasa por uno de estos estados:

- **autorizada**: puede mostrarse porque procede de contexto editorial permitido;
- **limitada**: solo se muestra la parte respaldada y segura;
- **abstención**: no existe base suficiente para responder sin inventar hechos;
- **bloqueada**: el contenido intenta superar el límite de spoilers.

Los estados son decididos por el núcleo de Hoid IA, no por el proveedor.

## Contrato mínimo

El proveedor debe recibir únicamente:

- la pregunta validada;
- el contexto editorial ya autorizado;
- el progreso canónico necesario para la adaptación.

No recibe acceso implícito al catálogo completo, a EPUB privados ni a contenido futuro.

La capa posterior debe rechazar resultados que no puedan asociarse a conocimiento autorizado cuando la respuesta formule afirmaciones narrativas. Una respuesta genérica que reconozca una limitación puede mostrarse sin inventar hechos.

## Invariantes

1. La salida nunca amplía el conjunto de obras o capítulos autorizados.
2. Una referencia a otra obra no se desbloquea por similitud, cronología o recomendación.
3. La ausencia de contexto no autoriza al proveedor a completar lagunas con conocimiento externo.
4. Si la verificación falla, prevalece la abstención o una explicación conservadora.
5. Los filtros posteriores no pueden convertir una respuesta bloqueada en permitida.

## Pruebas requeridas

Las pruebas de integración deben comprobar:

- proveedor sustituible con el mismo contrato;
- contexto vacío o insuficiente;
- intento de introducir una obra no autorizada;
- intento de superar el capítulo registrado;
- respuesta parcial que conserva solo afirmaciones respaldadas;
- fallo técnico sin filtración de contenido parcial.

## Relación con fuentes privadas

Esta frontera trabaja con resúmenes editoriales originales y metadatos autorizados. No requiere copiar ni enviar texto íntegro protegido. Si un pasaje privado no está accesible y verificable, no puede usarse como fundamento de una afirmación.
