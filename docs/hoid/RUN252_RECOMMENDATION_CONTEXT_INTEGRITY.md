# Run 252 — Integridad del contexto de recomendaciones

## Objetivo

Asegurar que el contexto metadata-only utilizado para recomendar la siguiente lectura sea internamente coherente con el ledger v2 y con los manifiestos de edición incluidos en el repositorio.

La función exportada \`composeHoidReadingAwareRecommendations()\` recibe datos externos al módulo y, por tanto, no debe confiar en que los campos contados sean correctos solo porque el objeto tenga la forma TypeScript esperada.

## Invariantes comprobados

Antes de construir recomendaciones, la función canonicaliza el contexto y exige:

- \`startedCount\` coincide exactamente con el número de posiciones únicas.
- \`trackableWorkCount\` coincide con el número de obras del catálogo que tienen un manifiesto de lectura verificado.
- \`trackableUnstartedCount\` equivale a obras con manifiesto menos las obras iniciadas que también tienen manifiesto.
- \`untrackedWorkCount\` coincide con el catálogo menos las obras con manifiesto.
- La suma y los contadores no pueden manipularse conjuntamente para simular una cobertura distinta.
- Las posiciones respetan el orden canónico del constructor: orden explícito y, en su ausencia o empate, ID bibliográfico.
- \`updatedAt\` debe ser una marca temporal ISO canónica, no solo una cadena que Date.parse pueda interpretar.
- Revisión cero implica ledger vacío y \`updatedAt: null\`.
- Una revisión positiva requiere una marca temporal. Puede conservar cero posiciones si el lector ha vaciado el ledger mediante una escritura durable.

Cada posición en curso sigue necesitando una frontera de capítulo válida en el manifiesto exacto de su edición. No se infiere un capítulo final ni se amplía el prefijo seguro de una edición parcial.

## Efecto en recomendaciones

La política de producto no cambia:

1. Se priorizan las obras que el lector ya tiene en curso, según su orden registrado.
2. Una obra completada no se ofrece como reanudación.
3. Después se añaden obras no iniciadas del catálogo en orden bibliográfico.
4. Los candidatos de descubrimiento no afirman orden narrativo, dependencia canónica ni lectura recomendada universal.
5. El límite se aplica después de priorizar las reanudaciones.

Los contadores son metadatos de consistencia; nunca conceden acceso a afirmaciones, citas o capítulos.

## Pruebas

Se añaden regresiones para contadores de manifiesto falsificados, contador de obras no iniciadas incorrecto, combinaciones imposibles de revisión/fecha, timestamps no canónicos, posiciones fuera del orden canónico y un ledger legítimamente vacío tras una revisión positiva.

## Privacidad y spoilers

Solo se usan fixtures sintéticos, IDs bibliográficos, manifiestos de lectura y metadatos. No se leen ni incorporan bytes EPUB, XHTML, pasajes, localizadores privados, resúmenes narrativos ni afirmaciones editoriales. La validación no inspecciona contenido de capítulos ni modifica el progreso del lector.

## Límite de confianza

Esta comprobación valida coherencia interna del contexto de recomendaciones. No autentica por sí sola el ledger: el gateway sigue obligado a construir el contexto desde el snapshot v2 validado y a comprobar la identidad del progreso antes y después del trabajo asíncrono. Tampoco convierte recomendaciones de catálogo en autorización narrativa.
