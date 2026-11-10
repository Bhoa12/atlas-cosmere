# Ejecución de pruebas de Hoid IA

El núcleo de Hoid IA mantiene sus comprobaciones de seguridad como funciones TypeScript independientes del framework. Esto permite que los contratos y las fronteras anti-spoilers sigan siendo reutilizables fuera de una herramienta de pruebas concreta.

## Ejecución reproducible

Tras instalar las dependencias del proyecto:

`npm install`

ejecuta únicamente las pruebas del núcleo:

`npm run test:hoid`

Para desarrollo continuo:

`npm run test:hoid:watch`

## Adaptador de pruebas

`invariants.runner.test.ts` descubre automáticamente las exportaciones de los módulos `*.test.ts` cuyo nombre termina en `Invariants` y las ejecuta con Vitest.

Una comprobación nueva debe seguir estas reglas:

- no depender de texto narrativo protegido;
- usar conocimiento sintético cuando pruebe autorización o spoilers;
- fallar de forma explícita si se rompe una frontera de seguridad;
- nombrar la función con el sufijo `Invariants` para que el adaptador la descubra.

El runner no modifica la política de autorización: únicamente hace ejecutables las comprobaciones que ya describen los invariantes del núcleo.
