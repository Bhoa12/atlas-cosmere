# Hoid IA: orquestación segura de solicitudes

Este módulo implementa la última frontera antes de presentar una respuesta al lector.

## Flujo

1. **Congelar progreso.** `freezeReadingProgress` crea una instantánea por obra y rechaza posiciones contradictorias.
2. **Autorizar evidencia.** `authorizeEvidence` conserva únicamente evidencia cuya posición máxima no supera el capítulo alcanzado en su propia obra.
3. **Contexto mínimo.** El adaptador del proveedor debe recibir solo identificadores ya autorizados.
4. **Verificar afirmaciones.** `finalizeDraft` evalúa cada afirmación de forma independiente: necesita texto y al menos una evidencia autorizada.
5. **Reducir, nunca ampliar.** Las afirmaciones no verificadas se eliminan. Ninguna fase puede añadir evidencia fuera del contexto inicial.

## Estados

- `authorized`: todas las afirmaciones visibles están respaldadas.
- `limited`: se eliminó al menos una afirmación no autorizada.
- `blocked`: el proveedor respondió, pero no quedó ninguna afirmación segura.
- `abstain`: no hubo borrador utilizable.

## Proveedores

El contrato no depende de OpenAI, Anthropic ni ningún otro proveedor. Un adaptador futuro solo transforma una solicitud ya delimitada en un `ProviderDraft`; no decide qué capítulos, obras o evidencias están autorizados.

## Fuentes privadas

La bibliografía privada se usa como catálogo, estructura de lectura y respaldo de metadatos o resúmenes originales. Este módulo no almacena ni transporta pasajes íntegros. Si un pasaje no está accesible y verificable, no puede convertirse en evidencia autorizada.
