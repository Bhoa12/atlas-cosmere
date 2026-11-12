# Observabilidad segura de Hoid IA

La observabilidad debe ayudar a detectar fallos y regresiones sin ampliar el conocimiento narrativo ni registrar material protegido.

## Principio

Los eventos técnicos describen decisiones de frontera, no el contenido de las fuentes privadas ni el texto completo de las conversaciones.

Nunca se deben registrar:

- pasajes íntegros de EPUB privados;
- respuestas completas del proveedor por defecto;
- preguntas completas del lector cuando no sean imprescindibles;
- contexto editorial completo enviado al proveedor.

## Eventos recomendados

Los eventos pueden registrar únicamente metadatos acotados:

- tipo de frontera: entrada, progreso, recuperación, proveedor o salida;
- resultado: permitido, rechazado, bloqueado o fallo técnico;
- motivo técnico normalizado;
- identificador de obra canónico cuando sea necesario;
- capítulo autorizado como número;
- contadores y tamaños ya validados.

Los motivos deben pertenecer a un vocabulario controlado. El texto no confiable no debe convertirse en una etiqueta de telemetría.

## Fallo cerrado

La telemetría es observacional y no participa en la autorización. Si falla el sistema de observabilidad, Hoid IA conserva la decisión de seguridad original y continúa sin reenviar contenido a un destino alternativo.

## Retención y depuración

Las implementaciones deben minimizar la retención y permitir desactivar el diagnóstico detallado. Para reproducir un problema se deben preferir identificadores de solicitud, códigos de motivo y datos sintéticos.

Esta política complementa la política de fallos: un error de proveedor u observabilidad nunca autoriza conocimiento adicional ni convierte una respuesta parcial en una respuesta segura.