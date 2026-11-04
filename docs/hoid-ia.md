# Hoid IA: arquitectura segura

Hoid IA se mantiene deliberadamente desacoplado de cualquier proveedor externo.

## Flujo

`UI -> HoidService -> SpoilerGuard -> HoidProvider (opcional)`

- La UI entrega una posición de lectura por libro y capítulo.
- `SpoilerGuard` bloquea temas registrados antes de que salgan del dispositivo.
- Si no hay proveedor configurado, Hoid devuelve un estado explícito `unavailable`; no simula una respuesta de IA.
- Los adaptadores futuros deben implementar `HoidProvider` y no deben contener claves en componentes de React Native.

## Siguiente paso

El guardia actual es intencionadamente conservador y depende de gates explícitos. La siguiente fase debe conectar un índice canónico de entidades y eventos con su primera aparición segura por libro/capítulo. Las respuestas externas deberán incluir procedencia o referencias internas para validar la respuesta antes de mostrarla al lector.
