# Run 265 — Evidence-bound conversation scope

## Objetivo

Una pregunta de seguimiento no debe ampliar silenciosamente el conjunto de obras de la respuesta anterior. El contexto conversacional se vincula al conjunto exacto de obras y capítulos que aportaron evidencia a la última respuesta autorizada, además de la identidad del progreso que permitió presentarla.

## Contrato

`HoidConversationScopeBinding` es un valor efímero y metadata-only que contiene:

- versión de esquema y tipo de binding;
- ámbito canónico de una o varias obras;
- IDs bibliográficos de las obras;
- números de capítulo citados por cada obra (trazabilidad de la respuesta anterior, no un límite de recuperación adicional);
- revisión y fingerprint del progreso que autorizó la respuesta.

No contiene nombres de personajes, alias, texto de preguntas, prosa de respuesta, resúmenes, localizadores EPUB, XHTML ni contenido de capítulos.

## Creación

`createHoidConversationScopeBinding()` solo crea el binding si `presentHoidEvidenceAnswer()` acepta la respuesta contra el progreso actual y los manifiestos de edición.

- Con un ámbito explícito, todas las obras seleccionadas deben aportar evidencia.
- En ámbito automático, las obras que realmente aportaron evidencia se convierten en el ámbito de seguimiento.
- Una respuesta bloqueada, abstencionista, sin citas o con más obras de las permitidas no crea contexto reutilizable.
- Los capítulos visibles se reconstruyen desde las citas verificadas, no desde etiquetas del proveedor.

## Validación de seguimiento

`validateHoidConversationScopeBinding()` vuelve a comprobar:

1. forma exacta y descriptores de datos;
2. catálogo de obras y orden canónico del ámbito;
3. capítulos existentes en los manifiestos;
4. revisión y fingerprint del progreso;
5. igualdad con cualquier ámbito explícito elegido en la interfaz.

Una discrepancia produce abstención. No se reintenta en modo automático ni se recurre al grafo relacional sin ámbito.

## Integración en el gateway

Las rutas de seguimiento tipado, coreferencia singular y seguimiento grupal requieren un binding válido. El gateway pasa el ámbito heredado al runtime estricto como `bookScope`, que vuelve a aplicar los umbrales de evidencia por obra y capítulo.

Una pregunta nueva e independiente no hereda el binding anterior: crea un ámbito nuevo a partir de las citas de su propia respuesta.

El binding nunca cruza la frontera del proveedor. Solo se pasa al gateway local y se utiliza para construir la solicitud canónica del runtime.

## Integración en HoidScreen

La pantalla conserva el binding únicamente en memoria. Lo envía junto con los contextos ID-only, lo elimina al cambiar el ámbito, cambiar el progreso, cancelar, fallar o iniciar recomendaciones, y muestra al usuario las obras y capítulos que limitan el seguimiento.

Si la presentación confiable y el binding no describen el mismo conjunto de obras, no se conserva el contexto.

## Seguridad y spoilers

- El fingerprint de progreso invalida el binding cuando cambia cualquier cursor o revisión.
- El ámbito heredado limita el conjunto de obras; el runtime sigue aplicando los límites de capítulo desbloqueado de cada una.
- Una petición con un ámbito diferente se rechaza con `context-scope-mismatch`.
- La ausencia de binding se rechaza con `context-scope-unavailable`.
- Los errores no incluyen nombres, alias, localizadores ni contenido privado.
- El texto EPUB permanece local y no se envía a proveedores.

## Validación

El workflow dedicado ejecuta pruebas de binding, gateway, continuidad tipada y contexto, además de TypeScript estricto sobre el gateway y la pantalla.

Todos los fixtures son sintéticos. No se incorporan EPUB privados, XHTML ni pasajes protegidos.
