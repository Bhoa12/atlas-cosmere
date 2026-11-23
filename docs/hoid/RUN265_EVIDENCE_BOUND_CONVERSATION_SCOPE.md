# Run 265 — Evidence-bound conversation scope

## Objetivo

Ningún turno posterior debe ampliar silenciosamente el conjunto de obras de la respuesta anterior. El contexto conversacional permanece vinculado al conjunto exacto de obras y capítulos que aportaron evidencia a la última respuesta autorizada, además de la identidad del progreso que permitió presentarla.

## Contrato

`HoidConversationScopeBinding` es un valor efímero y metadata-only que contiene:

- versión de esquema y tipo de binding;
- ámbito canónico de una o varias obras;
- IDs bibliográficos de las obras;
- números de capítulo citados por cada obra (trazabilidad de la respuesta anterior, no un límite de recuperación adicional);
- revisión y fingerprint del progreso que autorizó la respuesta.

No contiene nombres de personajes, alias, texto de preguntas, prosa de respuesta, resúmenes, localizadores EPUB, XHTML ni contenido de capítulos. Se marca con una capacidad local de módulo (WeakSet): una copia serializada o reconstruida no puede reutilizarse como contexto de seguimiento.

## Creación

`createHoidConversationScopeBinding()` solo crea el binding si `presentHoidEvidenceAnswer()` acepta la respuesta contra el progreso actual y los manifiestos de edición.

- Con un ámbito explícito, todas las obras seleccionadas deben aportar evidencia.
- En ámbito automático, las obras que realmente aportaron evidencia se convierten en el ámbito inicial de la conversación.
- Una respuesta bloqueada, abstencionista, sin citas, sin capítulos localizables en un manifiesto verificado o con más obras de las permitidas no crea un contexto inicial reutilizable. Las obras que todavía no dispongan de segmentación y localizadores de capítulo verificables no generan un binding de seguimiento; no se inventa una posición numérica.
- Los capítulos visibles se reconstruyen desde las citas verificadas, no desde etiquetas del proveedor.

## Validación y continuidad

`validateHoidConversationScopeBinding()` vuelve a comprobar:

1. forma exacta y descriptores de datos;
2. catálogo de obras y orden canónico del ámbito;
3. capítulos existentes en los manifiestos;
4. revisión y fingerprint del progreso;
5. igualdad con cualquier ámbito explícito elegido en la interfaz;
6. identidad de capacidad del binding emitido por este módulo.

Una discrepancia produce abstención. No se reintenta en modo automático ni se recurre al grafo relacional sin ámbito.

Una vez establecido, el ámbito activo se aplica a **todos** los turnos posteriores, incluidos los que parecen preguntas independientes y no contienen pronombres ni marcadores de seguimiento. El gateway envía el `bookScope` heredado al runtime estricto, que sigue aplicando los umbrales de capítulo desbloqueado por obra.

- Una respuesta autorizada dentro del ámbito actual sustituye el binding por uno nuevo con sus citas y capítulos.
- Una abstención conserva el binding anterior: un intento sin evidencia no libera el ámbito.
- Un cambio explícito de ámbito se rechaza con `context-scope-mismatch`.
- La falta o invalidez del binding se rechaza con `context-scope-unavailable`.
- Para ampliar el ámbito automático, el usuario debe iniciar un tema nuevo o cambiar explícitamente la selección de obras.

El binding nunca cruza la frontera del proveedor. Solo se pasa al gateway local y se utiliza para construir la solicitud canónica del runtime.

## Integración en HoidScreen

La pantalla conserva el binding únicamente en memoria. Lo envía junto con los contextos ID-only, lo invalida al cambiar el progreso, cancelar o reiniciar explícitamente el tema, y muestra al usuario las obras y capítulos que limitan la conversación.

Los errores que no invalidan el progreso conservan el ámbito, pero eliminan los referentes de entidad para que no se reutilicen referencias ambiguas. El botón **Nuevo tema** libera el ámbito y reinicia el contexto conversacional sin alterar el progreso ni la selección de obras.

Si la presentación confiable y el binding no describen exactamente las mismas obras y los mismos capítulos citados, no se conserva el contexto ni se muestra esa respuesta.

## Seguridad y spoilers

- El fingerprint de progreso invalida el binding cuando cambia cualquier cursor o revisión.
- El ámbito heredado limita el conjunto de obras; el runtime sigue aplicando los límites de capítulo desbloqueado de cada una.
- Las preguntas completas nuevas tampoco pueden ampliar silenciosamente el ámbito.
- Los errores no incluyen nombres, alias, localizadores ni contenido privado.
- El texto EPUB permanece local y no se envía a proveedores.

## Validación

El workflow dedicado ejecuta pruebas de binding, gateway, continuidad tipada y contexto, además de TypeScript estricto sobre el gateway y la pantalla.

Todos los fixtures son sintéticos. No se incorporan EPUB privados, XHTML ni pasajes protegidos.
