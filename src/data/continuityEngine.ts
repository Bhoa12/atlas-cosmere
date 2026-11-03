export interface EvaluacionContinuidad {
  /** Null means the heuristic cannot calculate a defensible probability. */
  viabilidadPorcentaje: number | null;
  veredicto: string;
  primeraLey: string;
  segundaLey: string;
  terceraLey: string;
  analisisEspiritual: string;
}

const contiene = (texto: string, terminos: string[]) =>
  terminos.some(termino => texto.includes(termino));

/**
 * This is a lightweight keyword-based guide, not a canon checker.
 * It deliberately avoids claiming that a theory is confirmed or assigning
 * unsupported probability scores.
 */
export function evaluarTeoriaMagica(teoriaTexto: string): EvaluacionContinuidad {
  const t = teoriaTexto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!t) {
    return {
      viabilidadPorcentaje: null,
      veredicto: 'FALTA UNA TEORÍA QUE ANALIZAR',
      primeraLey: 'Describe el mecanismo mágico que propones y qué Investidura lo alimentaría.',
      segundaLey: 'Indica qué límites, costes o condiciones tendría el fenómeno.',
      terceraLey: 'Explica qué precedentes conocidos apoyan la extrapolación.',
      analisisEspiritual: 'Aclara qué papel tendrían la Identidad, la Conexión y la intención.'
    };
  }

  const mencionaMuerte = contiene(t, ['revivir', 'resucitar', 'muerto', 'mas alla', 'mas alla']);
  const mencionaHemalurgia = contiene(t, ['hemalurg', 'clavo', 'robar atributo']);
  const mencionaSistemas = contiene(t, ['alomancia', 'alomant', 'feruquimia', 'radiante', 'investidura', 'luz tormentosa', 'aliento', 'dor']);

  return {
    viabilidadPorcentaje: null,
    veredicto: 'ANÁLISIS ORIENTATIVO — NO ES UNA VALIDACIÓN CANÓNICA',
    primeraLey: mencionaSistemas
      ? 'Has mencionado uno o varios sistemas de Investidura. Comprueba qué fuente de poder utiliza cada uno y si el mecanismo propuesto tiene un precedente explícito.'
      : 'No se identifica con claridad un sistema de Investidura. Especifica la fuente de poder y el mecanismo que permitiría el efecto.',
    segundaLey: mencionaMuerte
      ? 'La teoría trata sobre muerte o retorno. Distingue entre curación, Retornados, Sombras Cognitivas y aquello que se encuentra más allá; no son fenómenos equivalentes.'
      : mencionaHemalurgia
        ? 'La teoría trata sobre Hemalurgia. Considera el atributo robado, el punto de inserción, la compatibilidad espiritual y la pérdida de Investidura.'
        : 'Explicita los costes, límites, condiciones y posibles efectos secundarios. No basta con que dos sistemas compartan una fuente de Investidura.',
    terceraLey: 'Busca un precedente textual concreto antes de extrapolar. Una semejanza temática o una aparición aislada no demuestra que dos mecanismos sean intercambiables.',
    analisisEspiritual: 'Valora por separado Identidad, Conexión, Alma e intención. Su funcionamiento depende del contexto y no debe darse por supuesto.',
  };
}
