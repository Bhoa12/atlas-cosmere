# Cobertura de fuentes del catálogo

`validateCatalogSourceCoverage` comprueba que la arquitectura de expansión
mantenga un enlace explícito entre cada obra declarada y una entrada de
procedencia.

## Qué valida

- Una obra del catálogo sin ningún enlace de procedencia.
- Un enlace de procedencia que apunta a una obra no declarada.

## Límites deliberados

Esta validación trabaja exclusivamente con IDs y metadatos. No selecciona una
fuente alternativa, no crea obras ausentes y no intenta deducir títulos,
capítulos o relaciones narrativas.

La existencia de un enlace no sustituye la validación del contenido de la
fuente: esa comprobación permanece separada para evitar convertir supuestos
editoriales en datos del catálogo.

Esto permite incorporar progresivamente Scadrial, Sel, Nalthis, Taldain y otros
mundos sin introducir contenido no verificado.
