# Run 246 — endurecimiento de la frontera de matriz transversal

## Objetivo

Hacer que `summarizeHoidPresentedCrossBookEvidence()` trate su entrada como datos externos, aunque el tipo TypeScript describa una presentación ya validada. La función es exportada y no debe depender de que todos sus llamadores respeten el tipo en tiempo de compilación.

## Cambios

- La frontera recibe `unknown` y canonicaliza la presentación una sola vez.
- Rechaza objetos con prototipos inesperados, propiedades adicionales, símbolos, getters, arrays dispersos, propiedades de array no canónicas y trampas de Proxy que fallen.
- Comprueba IDs únicos y densos, correspondencia exacta entre afirmaciones, evidencias y citas, y ausencia de evidencias globales huérfanas.
- Verifica que cada cita use el título canónico de la bibliografía y que el par capítulo/localizador corresponda a una unidad numerada real del manifiesto de edición vigente.
- Recompone el texto desde los segmentos con el layout cerrado y exige igualdad exacta con el texto presentado.
- Solo después de canonicalizar deriva los resúmenes globales y por afirmación.

## Límite de confianza

Esta función no autentica por sí sola que un `evidenceId` pertenezca a una afirmación editorial concreta ni vuelve a leer el progreso. La identidad editorial y el desbloqueo en tiempo real siguen siendo responsabilidad del runtime y de `presentHoidEvidenceAnswer()`, que deben ejecutarse antes de llamar a la matriz.

Por eso:

- En la interfaz, se pasa únicamente la presentación producida por el presentador confiable.
- Para otros consumidores, se prefiere `buildHoidCrossBookEvidenceSummary(answer, progress)`, que vuelve a autorizar la respuesta bruta antes de resumirla.
- La validación adicional de capítulo/localizador evita destinos inventados o mal formados, pero no sustituye la autoridad editorial ni el control de progreso.
- No se vuelve a leer el snapshot de progreso ni el objeto original de respuesta después de obtener la presentación canónica.

## Pruebas

Siete pruebas nuevas cubren locators que no coinciden con el manifiesto, IDs globales divergentes, identidad/orden de segmentos, deriva del texto, getters no ejecutados, trampas de Proxy y arrays dispersos o con propiedades adicionales.

## Privacidad

La matriz sigue siendo metadata-only. No incorpora texto de capítulos, títulos de secciones EPUB, rutas privadas, resúmenes ni nuevas afirmaciones narrativas. No cambia los umbrales de desbloqueo ni activa conocimiento de producción.
