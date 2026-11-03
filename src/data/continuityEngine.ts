export interface EvaluacionContinuidad {
  viabilidadPorcentaje: number;
  veredicto: string;
  primeraLey: string; // Explicación vs Solución
  segundaLey: string; // Límites y debilidades
  terceraLey: string; // Extrapolación de lo existente
  analisisEspiritual: string; // Identidad, Conexión y Resistencia
}

export function evaluarTeoriaMagica(teoriaTexto: string): EvaluacionContinuidad {
  const t = teoriaTexto.toLowerCase();

  // 1. Caso: Mezcla de Alomancia con Potenciación
  if ((t.includes('aloman') || t.includes('metal') || t.includes('atium')) && (t.includes('radiante') || t.includes('potencia') || t.includes('luz tormentosa'))) {
    return {
      viabilidadPorcentaje: 92,
      veredicto: 'ALTAMENTE FACTIBLE (COMPATIBILIDAD CANÓNICA CONFIRMADA)',
      primeraLey: 'Cumple la 1ª Ley: La magia alomántica actúa como llave de paso genética, mientras que la Potenciación usa Investidura ambiental directa.',
      segundaLey: 'Límites claros (2ª Ley): Un Radiante que queme metales requerirá una perla de Lerasium o grapado hemalúrgico previo para alterar su red espiritual.',
      terceraLey: 'Extrapolación (3ª Ley): Ya observado en Hoid (Sagaz), quien posee ambos sistemas simultáneamente.',
      analisisEspiritual: 'La Identidad espiritual del esprec no rechaza el metal físico, pues el metal actúa como filtro de frecuencia para el alma.'
    };
  }

  // 2. Caso: Romper el límite de Investidura o revivir muertos completos
  if (t.includes('revivir') || t.includes('resucitar') || t.includes('inmortal') || t.includes('mas alla')) {
    return {
      viabilidadPorcentaje: 25,
      veredicto: 'VIOLACIÓN DE LEY MAYOR (CONTRADICCIÓN TEOLÓGICA)',
      primeraLey: 'Falla la 1ª Ley: Brandon ha establecido como regla inviolable que lo que cruza al "Más Allá" (Beyond) jamás regresa.',
      segundaLey: 'Límites absolutos (2ª Ley): Solo se puede revivir si la Sombra Cognitiva aún no se ha disuelto por completo (como Kelsier o los Retornados).',
      terceraLey: 'Extrapolación (3ª Ley): Ninguna Esquirla, ni siquiera Armonía o Odium, tiene poder sobre el Más Allá.',
      analisisEspiritual: 'La Conexión espiritual se corta de forma irreversible cuando el cordón de plata se extingue.'
    };
  }

  // 3. Caso: Uso de Hemalurgia sobre spren o fabriales
  if (t.includes('clavo') || t.includes('hemalurg') || t.includes('robar')) {
    return {
      viabilidadPorcentaje: 88,
      veredicto: 'FACTIBLE Y CANÓNICAMENTE COHERENTE',
      primeraLey: 'Cumple la 1ª Ley: La Hemalurgia es universal en todo el Cosmere porque mutila la red espiritual de cualquier ser consciente.',
      segundaLey: 'Límites (2ª Ley): Decay de Investidura: El clavo pierde potencia rápidamente si pasa por el aire sin sangre o linfa investida.',
      terceraLey: 'Extrapolación (3ª Ley): Un clavo de trellium (metal de Autonomía) puede interferir en vínculos spren.',
      analisisEspiritual: 'Riesgo de contaminación de Identidad extremo entre el donante y el receptor.'
    };
  }

  // Evaluación genérica estándar
  return {
    viabilidadPorcentaje: 65,
    veredicto: 'TEORÍA EN DISCUSIÓN (REQUIERE DATOS DE ERA ESPACIAL)',
    primeraLey: 'Principio de Conservación: Toda manifestación requiere una fuente de Investidura (Aliento, Luz, Metales o Dor).',
    segundaLey: 'Resistencia: Los cuerpos vivos con Investidura previa repelen la manipulación externa (Inercia de Investidura).',
    terceraLey: 'Consistencia: Respeta las reglas conocidas siempre que no intente crear energía de la nada.',
    analisisEspiritual: 'La Conexión y la Intención son los catalizadores obligatorios para que el fenómeno se produzca.'
  };
}