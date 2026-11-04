# Hoid IA: arquitectura segura

## Principio
La interfaz no contiene API keys ni llama directamente a un proveedor. Hoid depende de un contrato `HoidProvider`, preparado para una integración posterior mediante un backend seguro.

## Flujo
1. La UI crea una petición con pregunta y progreso.
2. `HoidService` aplica un guardia previo.
3. Solo una petición permitida llega al proveedor.
4. La respuesta pasa por un filtro antes de mostrarse.

## Estado actual
No existe una integración externa configurada. El modo local declara esta limitación explícitamente.

## Próximos pasos
- Gates editoriales por libro y capítulo.
- Recuperación de contexto con fuentes verificadas.
- Filtrado semántico de salida en backend.
- Pruebas de regresión anti-spoilers.
