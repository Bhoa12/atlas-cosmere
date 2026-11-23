# Run 250 — cancelación del llamador y descarte de resultados tardíos

## Objetivo

Asegurar que cancelar una consulta desde la interfaz o desde cualquier host invalida el resultado incluso cuando el adaptador del proveedor ignora `AbortSignal`. La cancelación del usuario es distinta de un cambio de progreso: ambas descartan el valor, pero conservan códigos de resultado diferentes.

## Contrato

`invokeWithHoidProgressChangeWatch()` puede devolver:

- `completed`: la operación terminó y el llamador no canceló.
- `failed`: falló el runtime o cambió el progreso.
- `cancelled / caller-aborted`: el llamador canceló la operación; cualquier valor tardío se descarta.
- `unavailable`: no se pudo establecer o limpiar de forma segura la frontera de vigilancia.

La señal del llamador se comprueba antes de instalar listeners o invocar el runtime. Si se aborta durante la verificación durable, el proveedor no se invoca. Si se aborta durante la llamada, el gateway descarta el valor resuelto aunque el proveedor ignore la señal. También vuelve a comprobar la señal después de cada lectura durable final, antes de devolver una respuesta o recomendación lista.

## Integración

- El gateway traduce `cancelled` a `unavailable / cancelled` para respuestas y recomendaciones.
- HoidScreen presenta una notificación neutral y elimina el contexto conversacional asociado.
- Cuando existe una suscripción del ledger, la señal del llamador se combina con la señal derivada que también escucha los cambios de progreso.
- Sin suscripción, el mismo descarte tardío se aplica usando la señal original y una comprobación posterior.

## Corrección de la prueba heredada de Run 249

La firma del runtime de recomendaciones admite un tercer argumento opcional `HoidRuntimeCallOptions`. La prueba ahora espera explícitamente `undefined` cuando no se proporciona ese argumento. No se modifica el contrato de producción para satisfacer una expectativa antigua.

## Pruebas

- Señal ya abortada: no se instala la suscripción ni se invoca el runtime.
- Cancelación durante una llamada sin suscripción: se descarta el valor tardío.
- Cancelación durante una llamada vigilada: se aborta la señal derivada, se desuscribe y se descarta el valor tardío.
- Cancelación durante la segunda lectura durable: no se invoca el proveedor.
- La invalidación del progreso conserva su código independiente.
- Pruebas de gateway para respuestas y recomendaciones tardías.
- TypeScript estricto en el workflow de concurrencia.

## Privacidad y spoilers

Se utilizan valores sintéticos. No se leen ni se incorporan EPUBs, XHTML, pasajes protegidos, localizadores privados ni afirmaciones narrativas. La cancelación no concede ni modifica permisos de lectura.

## Aislamiento

- Base: `feat/hoid-ia-core-run249`.
- Rama: `feat/hoid-ia-core-run250`.
- PR #142 / Run 249 no se modifica.
- No se escribe en `main`, no se retargetean ramas anteriores y no se fusiona automáticamente.
