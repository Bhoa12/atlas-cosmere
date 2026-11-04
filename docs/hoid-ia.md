# Hoid IA: arquitectura segura

Hoid IA está desacoplado de cualquier proveedor externo.

## Flujo

`UI -> HoidService -> guardQuestion -> HoidProvider (opcional) -> redactProviderAnswer -> UI`

- La UI entrega progreso real por libro y capítulo desde `CosmereContext`.
- Los spoiler gates requieren un libro y capítulo explícitos; no se desbloquean por la posición de un array.
- La pregunta se bloquea antes de invocar un proveedor.
- La respuesta del proveedor pasa por una segunda comprobación determinista antes de mostrarse.
- Si no hay proveedor o falla, el sistema responde de forma explícita y no inventa contenido.
- Ninguna clave de proveedor pertenece a un componente de React Native.

## Límites actuales

Los gates actuales son una base técnica, no un índice canónico completo. La siguiente fase debe construir un catálogo de entidades, eventos y conceptos con su primera aparición segura por libro/capítulo y utilizar recuperación de contexto autorizada. Hasta entonces, cualquier adaptador externo debe tratarse como experimental y mantener el principio de fallo seguro.

## Contrato de integración

Los proveedores futuros implementarán `HoidProvider`. La aplicación no debe depender de SDKs concretos ni exponer secretos de servidor en el cliente.
