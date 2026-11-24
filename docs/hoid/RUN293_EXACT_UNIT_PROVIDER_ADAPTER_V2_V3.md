# Run 293 — adaptador provider-neutral exact-unit v2/v3

## Objetivo

Añadir una frontera de transporte para el selector del runtime exact-unit v2/v3. El adaptador debe poder utilizarse con HTTP, un SDK externo o un modelo local sin introducir dependencias de proveedores en el dominio Hoid.

## Contrato

createHoidExactUnitSelectionAdapter(transport) implementa HoidExactClaimSelector y acepta el contrato de selección definido por exactUnitEvidenceRuntime.ts.

El transporte recibe exclusivamente:

- El snapshot inmutable de selección v2 o v3.
- Un contexto de invocación inmutable que contiene un AbortSignal auténtico.

No recibe progreso, posiciones, ordinales, referencias exactas, localizadores EPUB, registro de confianza, claves, paquetes editoriales completos ni texto de respuestas anteriores.

## Versiones admitidas

### v2

Contiene exactamente:

- schemaVersion
- requestFingerprint
- question
- intent
- candidates
- selectionBudget

### v3

Añade exclusivamente conversationContext, que contiene:

- schemaVersion
- priorClaimIds
- entityIds
- bookIds

Los arrays deben ser densos, congelados, sin duplicados y en orden canónico. Las obras deben existir en la bibliografía de Hoid. El contexto solo orienta la selección; no amplía permisos ni sustituye la autorización exact-unit.

La presencia de conversationContext y la versión deben coincidir: v2 no lo admite y v3 lo exige.

## Validación antes del egress

La fábrica comprueba:

1. Objeto raíz congelado, plano y con claves exactas.
2. Versión 2 o 3 y fingerprint SHA-256 de 64 caracteres hexadecimales.
3. Pregunta, intención y límites de tamaño.
4. Presupuesto de selección dentro de los límites del runtime.
5. Candidatos densos, congelados, ordenados, únicos y con evidencias únicas.
6. Contexto v3 exacto, acotado y compuesto solo por IDs válidos.
7. Contexto de invocación congelado, sin propiedades adicionales ni getters.
8. AbortSignal real, comprobado mediante el getter nativo de AbortSignal.prototype.

Las propiedades se inspeccionan mediante descriptores de datos. Los getters de solicitudes o contextos hostiles no se ejecutan. Las excepciones de reflexión se convierten en rechazo antes de despachar el transporte.

## Cancelación y reintentos

- La señal exacta de la invocación se reenvía al transporte.
- Una señal ya abortada bloquea el despacho.
- La señal se vuelve a comprobar en la microtarea inmediatamente anterior al transporte.
- Una cancelación activa se propaga sin crear una segunda invocación.
- La fábrica realiza como máximo un despacho por llamada.
- No hay reintentos automáticos: un fallo remoto no demuestra que el servidor no procesara la solicitud.

El transporte concreto debe pasar la señal a fetch o al SDK cuando sea compatible. Si el transporte ignora la señal, el núcleo no puede garantizar la cancelación física remota; el runtime sí descarta resultados tardíos y vuelve a validar el progreso antes de presentar.

## Autoridad narrativa

El adaptador no parsea ni autoriza el resultado. Devuelve unknown al runtime, que comprueba:

- versión y fingerprint coincidentes;
- forma exacta del sobre;
- IDs densos y únicos;
- pertenencia de cada ID al conjunto local de candidatos;
- presupuestos de claims, evidencias, obras y caracteres;
- cobertura de todas las obras requeridas;
- frescura del progreso y autorización de cada evidencia.

El proveedor solo elige IDs. El texto final, los segmentos y las citas se reconstruyen desde los paquetes editoriales locales firmados. El adaptador no puede aprobar una afirmación ni introducir texto narrativo.

## Archivos

- src/hoid/exactUnitProviderAdapter.ts
- src/hoid/exactUnitProviderAdapter.test.ts
- .github/workflows/hoid-exact-unit-provider-adapter-v2-v3.yml

## Validación

El workflow ejecuta la suite nueva y las regresiones del runtime exact-unit, gateway conversacional, host de presentación, firmas, integridad editorial y autorización. También ejecuta TypeScript estricto.

No se considera validado hasta que GitHub Actions termine sobre el HEAD definitivo de la rama.

## Límites explícitos

- No se añade SDK de OpenAI, Anthropic, Google ni otro proveedor.
- No se configura una URL, API key ni secreto.
- No se conecta todavía el adaptador a la composición de producción de Atlas.
- No se activa el runtime exact-unit como autoridad de lectura.
- El registro editorial de producción continúa dependiendo de paquetes aprobados y firmados.
- No se incluyen EPUB, XHTML, localizadores, títulos de capítulos ni pasajes protegidos. Las pruebas utilizan únicamente datos sintéticos y metadatos del catálogo.

## Aislamiento

- Base: feat/hoid-ia-core-run292
- SHA base: 77b627c03dcf5b1875e15428e138a1a0f858bfee
- Rama: feat/hoid-ia-core-run293
- Mantener en Draft y sin fusionar automáticamente.
- No modificar main, PR #185 ni ninguna rama anterior.
