# Validación de estructura de lectura

`validateReadingStructure` comprueba la integridad de las unidades de lectura declaradas antes de usarlas para progreso o desbloqueos anti-spoilers.

Detecta:

- identificadores de unidad duplicados;
- posiciones que no son enteros positivos;
- posiciones repetidas dentro de una misma obra.

La validación trabaja exclusivamente con metadatos. No crea unidades ausentes, no rellena huecos de numeración y no interpreta títulos o contenido editorial. Por tanto, una estructura válida solo confirma coherencia técnica: la procedencia y el significado de cada unidad siguen dependiendo de fuentes verificadas.
