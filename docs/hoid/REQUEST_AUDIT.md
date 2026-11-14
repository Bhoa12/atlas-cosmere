# Auditoría segura de solicitudes de Hoid IA

## Objetivo

La auditoría permite reconstruir **qué decisiones de seguridad tomó el sistema** sin almacenar contenido narrativo que pueda convertirse en una vía secundaria de spoilers o en una copia de las fuentes privadas.

## Qué se registra

Cada evento contiene únicamente:

- etapa del pipeline;
- resultado de la etapa;
- identificadores opacos de evidencia ya tratados por la arquitectura;
- un código técnico de motivo opcional.

El contrato no contiene campos para texto de EPUB, extractos, resúmenes completos, afirmaciones narrativas ni contenido descartado.

## Etapas

La traza puede registrar validación del catálogo, procedencia, selección por progreso, frontera de conocimiento, ejecución del proveedor, verificación y decisión final.

Una entrada en el catálogo no demuestra que una fuente fuese accesible ni autoriza hechos narrativos. La auditoría conserva esta separación.

## Política de fallo cerrado

Un identificador de solicitud o de evidencia vacío invalida la creación de la traza. Los identificadores duplicados se reducen a una única referencia. La capa de observabilidad nunca debe recuperar texto protegido para completar una auditoría.

## Uso

La auditoría es una capa de observabilidad desacoplada. No decide qué evidencia es segura y tampoco concede permisos al proveedor. Solo registra el resultado de contratos anteriores:

`catálogo → procedencia → progreso/contexto → frontera de conocimiento → proveedor → verificación → decisión`.

Por ello, una traza no puede utilizarse como fuente narrativa ni como sustituto de evidencia accesible.
