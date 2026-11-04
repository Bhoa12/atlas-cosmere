# Verificación del núcleo de expansión

La rama de expansión mantiene una separación estricta entre metadatos bibliográficos y contenido editorial protegido.

## Comandos

Después de instalar dependencias:

```bash
npm run typecheck
npm run test
npm run verify
```

- `typecheck` ejecuta TypeScript sin emitir archivos.
- `test` ejecuta las pruebas unitarias con Vitest.
- `verify` ejecuta ambas comprobaciones.

## Alcance actual de las pruebas

Las primeras pruebas cubren la validación del manifiesto de fuentes privadas:

- el manifiesto incluido en el repositorio debe ser válido;
- los identificadores duplicados se rechazan;
- los identificadores y títulos vacíos se rechazan;
- los estados de procesamiento desconocidos se rechazan en tiempo de ejecución.

Estas pruebas verifican **metadatos únicamente**. Un resultado correcto no demuestra que un EPUB haya sido abierto ni que se haya verificado su estructura de capítulos o contenido narrativo.

Las siguientes áreas previstas para cobertura son unidades de lectura, progreso granular y reglas de desbloqueo anti-spoilers.
