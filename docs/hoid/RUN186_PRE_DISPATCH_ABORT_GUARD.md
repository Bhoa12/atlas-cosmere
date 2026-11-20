# Hoid IA — Run 186: cancellation-before-dispatch race guard

## Hallazgo

La inspección del límite de invocación encontró una ventana de carrera en `invokeWithProviderDeadline()`: el listener del llamante y el deadline se instalaban correctamente, pero la llamada al adaptador se programaba en una microtarea sin volver a comprobar si la invocación ya se había asentado.

Si el usuario cancelaba de forma síncrona inmediatamente después de iniciar la consulta y antes de ejecutar esa microtarea, Hoid devolvía `aborted`, pero el adaptador todavía podía comenzar a trabajar con una señal que ya estaba abortada.

El resultado no podía entrar en la ruta de respuesta gracias al estado de asentamiento, pero el despacho innecesario podía consumir recursos y provocar tráfico externo después de la cancelación.

## Corrección

- Revalidar `settled` y `controller.signal.aborted` dentro de la microtarea, justo antes de invocar el adaptador.
- Mantener el deadline y el listener instalados antes del despacho.
- Mantener el asentamiento único y el descarte de resoluciones tardías.
- Encapsular tanto los rechazos asíncronos como las excepciones síncronas del adaptador en el resultado tipado existente.

## Pruebas

- Cancelación del llamante inmediatamente después de crear la invocación y antes de la microtarea: el adaptador no se ejecuta.
- Rechazo tardío después de timeout: el resultado permanece `timeout`.
- Se conservan las pruebas de resolución normal, timeout, cancelación ya presente, cancelación durante la operación y fallo del adaptador.

Las pruebas usan proveedores sintéticos; no necesitan credenciales ni llamadas de red.

## Garantías y límites

- La cancelación previa al despacho evita iniciar el adaptador si la cancelación gana la carrera.
- Si el adaptador ya comenzó, `AbortSignal` sigue siendo cooperativo; un transporte que lo ignore puede continuar trabajando externamente.
- Ninguna respuesta tardía puede reabrir una invocación asentada ni llegar a la presentación.
- La cancelación no modifica el progreso de lectura, los manifiestos, los permisos ni los umbrales N+1.
- No se añaden proveedores concretos ni SDKs a la capa de dominio.

## Fuentes y privacidad

Esta iteración es arquitectónica. No se han abierto EPUBs ni inspeccionado pasajes narrativos. No se han copiado ni subido EPUBs, XHTML, imágenes ni texto protegido.

## Aislamiento

- Base: `feat/hoid-ia-core-run185`
- SHA base: `0dabae8c26957735483fae0a81feec6dbc367004`
- Rama: `feat/hoid-ia-core-run186`
- `main` y las ramas anteriores no se modifican.
- El trabajo se mantiene en una rama independiente y no se fusiona automáticamente.
