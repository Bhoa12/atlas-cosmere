# Política de fallos de Hoid IA

Hoid IA trata a los proveedores y sus integraciones como fronteras no confiables. Un fallo técnico nunca debe transformarse en conocimiento narrativo.

## Regla principal

Ante un fallo, la aplicación conserva el límite de conocimiento previamente autorizado. No reutiliza respuestas parciales, no completa huecos mediante suposiciones y no amplía el contexto por haber fallado una recuperación o un proveedor.

## Clasificación

- **Entrada inválida:** la solicitud no se interpreta ni se envía al proveedor.
- **Tiempo de espera, excepción o respuesta malformada:** se devuelve una respuesta de disponibilidad conservadora y no se presenta contenido generado.
- **Evidencia insuficiente:** las afirmaciones sin respaldo autorizado se descartan; si no queda una respuesta verificable, la salida se bloquea.
- **Posible spoiler:** prevalece la protección del lector y la salida se bloquea.

## Invariantes

1. Ningún resultado parcial del proveedor cruza la frontera de respuesta.
2. Un error posterior no puede aumentar el conocimiento autorizado por progreso y capítulo.
3. La interfaz puede explicar la limitación, pero no atribuir hechos a una fuente que no se haya podido consultar.
4. Los proveedores siguen siendo intercambiables: esta política pertenece al núcleo y no a una implementación concreta.

Esta política trabaja con metadatos, estructura de lectura y resúmenes editoriales originales. No autoriza copiar ni almacenar texto íntegro protegido de las fuentes privadas.