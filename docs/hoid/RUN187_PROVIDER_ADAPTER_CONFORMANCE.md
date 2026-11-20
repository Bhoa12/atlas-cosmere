# Hoid IA — Run 187: provider adapter conformance boundary

## Objetivo

Run 187 introduce una fábrica de adaptadores neutral para que los futuros proveedores implementen el contrato de selección sin repetir reglas de aislamiento, snapshots ni cancelación.

No se incorpora ningún SDK ni proveedor concreto.

## Implementación

- `src/hoid/providerAdapter.ts` define el contrato de transporte y `createHoidClaimSelectorAdapter()`.
- El adaptador acepta exclusivamente solicitudes v1 inmutables, densas y con claves cerradas.
- La lista de claves de la solicitud impide que progreso bruto, permisos o campos ajenos entren en el payload.
- La fábrica vuelve a comprobar `AbortSignal` dentro de la microtarea de despacho.
- El transporte recibe el snapshot original y un contexto congelado que contiene únicamente la señal de esa invocación.
- Los errores síncronos del transporte se convierten en rechazos de promesa; el runtime superior conserva la responsabilidad de clasificarlos y cerrar la consulta.

## Conformidad mínima para futuros adaptadores

Cada adaptador concreto deberá probar que:

1. Usa `createHoidClaimSelectorAdapter()` o implementa las mismas garantías.
2. No despacha transporte cuando la señal ya está abortada.
3. Vuelve a comprobar la cancelación justo antes del despacho diferido.
4. Propaga la misma señal al transporte HTTP/SDK cuando sea compatible.
5. No muta la solicitud ni conserva referencias mutables al estado de Atlas.
6. Devuelve el sobre `hoid.claim-selection` v1 con el fingerprint exacto.
7. No añade progreso, manifiestos, aliases internos ni permisos al payload.
8. Deja que el runtime local valide los IDs y reconstruya el texto desde el registro editorial aprobado.

## Límites

La señal es cooperativa. Un transporte que ignore `AbortSignal` puede continuar trabajo remoto; Hoid solo garantiza que el resultado tardío no reingresa en la ruta de presentación.

La fábrica no autentica al proveedor y no convierte el fingerprint en una credencial. La autorización narrativa y el control de spoilers siguen siendo locales.

## Pruebas

`providerAdapter.test.ts` usa transportes sintéticos para comprobar snapshots inmutables, ausencia de progreso bruto, cancelación previa al despacho, propagación durante una operación activa, fingerprint y encapsulación de excepciones.

No se utilizan EPUBs ni texto narrativo protegido.

## Privacidad

No se han abierto ni modificado las fuentes privadas del usuario. No se han incorporado EPUBs, XHTML, imágenes ni texto protegido al repositorio.

## Aislamiento

- Base: `feat/hoid-ia-core-run186`
- SHA base: `92f5bd6554c2b1e230fbf51725b40d878e32f28c`
- Rama: `feat/hoid-ia-core-run187`
- `main`, PR #79 y ramas anteriores permanecen sin modificar.
- No se fusiona automáticamente.
