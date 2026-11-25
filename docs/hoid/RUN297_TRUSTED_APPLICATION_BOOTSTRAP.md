# Run 297 — bootstrap de aplicación para Hoid de confianza

## Objetivo

Añadir un único punto de ciclo de vida entre los adaptadores nativos de confianza de Atlas y el puerto de conversación exact-unit v3 consumido por HoidScreen.

## Cambios

- Añade `createHoidTrustedApplicationBootstrap()`.
- El loader de plataforma proporciona la configuración de confianza, el store SQLite cursor-v2 compartido, su fuente de invalidaciones y un identificador de sesión.
- Valida el registro de dependencias mediante descriptores de propiedades; rechaza getters, claves adicionales, prototipos inesperados e identificadores de sesión malformados.
- Inicializa primero el progreso durable del lector mediante `createHoidTrustedCursorConversationComposition()`.
- Construye el puerto visual solo después de que la composición exact-unit esté disponible.
- Expone una máquina de estados pequeña: `idle`, `loading`, `ready`, `blocked` y `disposed`.
- Coalesce inicializaciones concurrentes y reentrantes en una sola promesa.
- Propaga un AbortSignal al loader; si el bootstrap se dispone mientras la carga o composición están pendientes, descarta y dispone cualquier resultado tardío.
- Dispone conjuntamente el puerto de pantalla, la sesión v3, la composición y el coordinador derivado.
- No ofrece reintentos implícitos después de un estado bloqueado: el host debe crear una nueva instancia tras reparar la causa.

## Contrato de dependencias

El loader devuelve un objeto exacto con cuatro propiedades:

- `compositionConfig`: transporte provider-neutral, fuente de paquetes firmados, fuente del registro, checkpoint anti-rollback, reloj, contexto de revisión, clave raíz pública y verificador Ed25519.
- `cursorStore`: la misma implementación durable cursor-v2 que utiliza Atlas.
- `invalidationSource`: notificaciones sin payload del coordinador de progreso compartido.
- `sessionId`: identificador aislado para la pantalla Hoid.

La configuración no contiene claves privadas, credenciales de proveedor ni contenido EPUB.

## Garantías y límites

- La máquina de estados no convierte la existencia de adaptadores en una afirmación de confianza nativa.
- El loader de plataforma sigue siendo responsable de demostrar que su checkpoint es durable, atómico y resistente a rollback, que las invalidaciones cubren todas las instancias relevantes y que el verificador Ed25519 funciona en el runtime objetivo.
- El host firmado vuelve a comprobar registro, firmas, checkpoint, paquete editorial y progreso en cada turno. El estado `ready` significa que el grafo se compuso y que el cursor durable se inicializó; no certifica que exista un registro editorial válido.
- Una respuesta sigue bloqueada si el checkpoint o los paquetes firmados no están provisionados.
- No se implementan ni simulan Android Keystore, iOS Keychain, atestación hardware o un contador monotónico.
- No se activa la integración en `App.tsx`: la aplicación continúa inyectando `null` hasta que exista un adaptador nativo real y datos editoriales firmados.
- No se persisten conversaciones ni se amplía el progreso de lectura.
- Las pruebas usan fixtures sintéticos. No se leen ni se incorporan EPUB, XHTML, pasajes protegidos o resúmenes narrativos.

## Validación

El workflow dedicado ejecuta pruebas del bootstrap, regresiones de composición y del puerto de pantalla, y TypeScript estricto. La certificación corresponde únicamente al HEAD de esta rama y no debe inferirse antes de que GitHub Actions termine.

## Aislamiento

- Base: `feat/hoid-ia-core-run296`, SHA `13063195f7d329f82fa9f0d60c13f7e8c9b63b8a`.
- Rama: `feat/hoid-ia-core-run297`.
- PR en Draft; no fusionar automáticamente.
- No modificar `main`, PR #189 ni ramas/PR anteriores.
