# Política de versionado del catálogo de Hoid IA

## Propósito

El catálogo de obras es una frontera de autorización. Cambiar una identidad, un título o la estructura de lectura puede alterar qué progreso se considera válido. Por ello, las actualizaciones deben ser explícitas, revisables y compatibles de forma conservadora.

## Identidades estables

- Un identificador canónico publicado no debe reutilizarse para otra obra.
- Los títulos son metadatos de presentación y no sustituyen al identificador.
- Un cambio de identificador requiere una migración explícita; nunca debe inferirse por similitud de nombres.
- Las entradas ambiguas o duplicadas fallan de forma cerrada en las fronteras que autorizan progreso o recomendaciones.

## Cambios de estructura

La estructura de capítulos es metadato de lectura, no evidencia de contenido narrativo. Si se corrige:

1. se documenta el origen del cambio;
2. se conserva el historial de la revisión;
3. el progreso existente no se amplía automáticamente;
4. si la equivalencia no puede demostrarse, se conserva el límite más restrictivo.

## Compatibilidad

Una versión nueva del catálogo no puede desbloquear conocimiento por sí sola. La autorización sigue requiriendo progreso validado para la identidad canónica correspondiente.

Si una migración falla o un estado antiguo es ambiguo, Hoid IA debe mantener el progreso sin ampliar o pedir una actualización explícita en una capa de interfaz. El núcleo no adivina equivalencias.

## Fuentes privadas

Las actualizaciones pueden utilizar índices, metadatos y estructura de lectura de la bibliografía privada aportada. No deben copiarse ni publicarse pasajes íntegros protegidos. Un dato no accesible o no verificable no debe presentarse como consultado.

## Pruebas requeridas

- identificadores históricos no se reutilizan;
- duplicados no crean autorización;
- una actualización no aumenta capítulos autorizados automáticamente;
- una migración ambigua conserva el estado más restrictivo;
- los proveedores no reciben capacidad para modificar el catálogo.
