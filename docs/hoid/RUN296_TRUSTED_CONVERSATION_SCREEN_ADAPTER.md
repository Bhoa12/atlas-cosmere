# Run 296 — adaptador de conversación exact-unit para HoidScreen

## Objetivo

Conectar la composición conversacional v3 con una frontera de UI explícita. Las preguntas narrativas dejan de usar el gateway local heredado: requieren una sesión exact-unit firmada y un permiso de presentación coherente con el progreso.

## Cambios

- Añade una marca privada para composiciones creadas por la fábrica de confianza. La API estática de construcción exige un token privado del módulo.
- Añade \`createHoidTrustedConversationScreenPort()\`, que crea y administra una sesión v3 por pantalla.
- El adaptador captura las entregas del host y exige que el permiso incluya la misma revisión de registro y progreso que devuelve el gateway.
- La respuesta se transforma directamente desde referencias exact-unit a una proyección visual mínima. No se reconstruyen localizadores EPUB ni se copian fingerprints, unit IDs o evidence IDs a React.
- El ámbito explícito de una obra o de varias obras se vuelve a comprobar contra las fuentes visibles antes de devolver la proyección.
- El resumen transversal se construye a partir de las citas ya validadas y solo contiene títulos, capítulos y segmentos.
- HoidScreen utiliza el puerto v3 para todas las preguntas narrativas. El gateway local anterior queda limitado a la lectura del progreso.
- El contexto de seguimiento permanece en la sesión v3 y se invalida cuando cambia el progreso.
- La pantalla dispone su sesión al desmontarse.
- App sigue inyectando \`null\` para ambos puertos. La narrativa de producción no se activa sin bootstrap, registro de revisores, paquetes firmados y composición real.

## Contrato de UI

La pantalla envía únicamente pregunta, intención determinista, profundidad y ámbito bibliográfico explícito.

El puerto devuelve:
- texto y segmentos reconstruidos desde afirmaciones firmadas;
- citas mínimas con obra, capítulo y ordinal de edición;
- resumen transversal de títulos y capítulos cuando intervienen varias obras;
- revisión y fingerprint del progreso que autorizó la presentación.

No devuelve texto bruto del proveedor, localizadores EPUB, fingerprints de identidad, IDs de evidencia ni permisos internos.

## Prevención de spoilers

1. El gateway v3 consulta el progreso durable antes de preparar la respuesta.
2. El host exact-unit verifica firmas, registro, checkpoint, políticas de desbloqueo y evidencia.
3. El sink entrega la respuesta junto con un permiso de presentación.
4. El adaptador comprueba que las revisiones del permiso y del resultado coinciden.
5. Las referencias de capítulo se validan contra el manifiesto de edición.
6. La proyección visual descarta los identificadores internos.
7. HoidScreen vuelve a comprobar el progreso inmediatamente antes de guardar el mensaje en React.

Un permiso ausente, malformado, revocado o incoherente bloquea la respuesta.

## Límites

- No se implementan ni se simulan Android Keystore, iOS Keychain o un testigo monotónico.
- No se crean claves raíz, claves de revisores, credenciales ni paquetes editoriales de producción.
- No se habilita persistencia de conversaciones.
- Los tests usan afirmaciones sintéticas firmadas exclusivamente para pruebas.
- No se leen ni se incorporan EPUB, XHTML, pasajes protegidos ni resúmenes narrativos.

## Validación

El workflow dedicado ejecuta la proyección exact-unit, la composición, el gateway v3, el host firmado, las pruebas de integración estática de HoidScreen y TypeScript estricto para la pantalla React Native.

## Aislamiento

- Base: \`feat/hoid-ia-core-run295\`, SHA \`e60cc3265ed20d1f0b33f479759b944e40fdb6e0\`.
- Rama: \`feat/hoid-ia-core-run296\`.
- PR en Draft; no fusionar automáticamente.
- No modificar \`main\`, PR #188 ni las ramas anteriores.

## Privacidad

La bibliografía privada se mantiene como catálogo de fuentes. La estructura de lectura no se trata como evidencia narrativa y no se inventa contenido que no haya sido revisado y firmado.
