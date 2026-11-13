# Política de procedencia y confianza del conocimiento de Hoid IA

## Objetivo

Hoid IA debe distinguir entre conocimiento editorial respaldado, metadatos verificables y contenido cuya procedencia no puede demostrarse. Esta frontera evita que una respuesta parezca más fiable o más avanzada que las fuentes autorizadas por el progreso del lector.

## Niveles de procedencia

Cada unidad editorial utilizable debe conservar, como mínimo:

- un identificador estable de evidencia;
- la obra canónica;
- el límite de lectura al que pertenece;
- un tipo de procedencia: `catalog`, `editorial_summary` o `unavailable`;
- un estado de confianza: `verified` o `unknown`.

Los pasajes íntegros protegidos no forman parte de este contrato.

## Regla de autorización

Una unidad solo puede convertirse en evidencia para una respuesta si se cumplen simultáneamente:

1. su obra está presente en el catálogo canónico;
2. su posición no supera la instantánea de progreso de la solicitud;
3. su procedencia está marcada como verificable para el propósito solicitado;
4. la unidad no depende de texto no accesible en el entorno.

La existencia global de una unidad no concede autorización.

## Incertidumbre explícita

`unavailable` y `unknown` son estados informativos, no errores que el proveedor pueda completar con conocimiento externo. Cuando una pregunta depende de una unidad no verificable, la respuesta debe limitarse a:

- explicar que no hay base suficiente para afirmarlo;
- ofrecer contexto seguro que sí esté autorizado;
- o abstenerse de responder al detalle.

## Aislamiento de proveedores

Los proveedores reciben identificadores y contexto derivados del presupuesto de conocimiento de la solicitud. No pueden elevar un nivel de confianza, cambiar la procedencia ni declarar una evidencia como verificada.

## Pruebas mínimas

Las integraciones deben comprobar que:

- una evidencia con procedencia desconocida no autoriza una afirmación;
- una unidad verificable de un capítulo posterior sigue bloqueada;
- un proveedor no puede convertir `unknown` en `verified`;
- una respuesta limitada conserva únicamente afirmaciones respaldadas;
- la ausencia de una fuente accesible produce incertidumbre o abstención, nunca hechos inventados.

## Relación con la bibliografía privada

La bibliografía privada se usa como catálogo de obras y estructura de lectura. Cualquier resumen incorporado debe ser original y estar respaldado por información realmente accesible. Esta política no autoriza copiar, almacenar ni publicar texto íntegro protegido.
