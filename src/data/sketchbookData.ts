export interface LaminaCuaderno {
  id: string;
  especie: string;
  mundo: string;
  ilustracionAscii: string;
  anatomiaNotas: string[];
  citaShallan: string;
}

export const CUADERNO_SHALLAN: LaminaCuaderno[] = [
  {
    id: 'chasmfiend',
    especie: 'Abismoide (Chasmfiend)',
    mundo: 'Roshar (Llanuras Quebradas)',
    ilustracionAscii: '   /\\_ _/\\\n  ( o   o )\n   =( Y )=   [QUINTINA GIGANTE Y CORAZÓN DE GEMA]',
    anatomiaNotas: [
      'Caparazón calcificado resistente a Hojas de Esquirla en ángulos oblicuos.',
      'Corazón de gema de amatista gigante situado bajo el esternón secundario.',
      'Mandíbulas accesorias adaptadas para devorar carroña y conchas de chull.'
    ],
    citaShallan: '«Dibujé al abismoide mientras agonizaba. No había malicia en sus ojos, solo la fría inmensidad de una tormenta que se apaga.»'
  },
  {
    id: 'honorspren',
    especie: 'Esprec de Honor (Sylphrena)',
    mundo: 'Roshar (Reino Cognitivo / Físico)',
    ilustracionAscii: '      *\n    / | \\\n   *  |  *   [VESTIDO DE LUZ AZULADA EN ESPIRAL]',
    anatomiaNotas: [
      'Forma translúcida que emite luminiscencia azul verdosa pura.',
      'Capacidad de alterar su masa y adherirse a corrientes de aire ascendentes.',
      'En el Tercer Ideal se condensa en metal de Hoja de Esquirla viva.'
    ],
    citaShallan: '«Observar a Syl flotar alrededor de Kaladin es como ver a una hoja rebelándose contra el viento.»'
  },
  {
    id: 'mistwraith',
    especie: 'Espectro de la Bruma (Mistwraith)',
    mundo: 'Scadrial',
    ilustracionAscii: '    ~~~~~\n  ( ??_?? )\n   ~~~~~~~   [MASA AMORFA CON HUESOS ABSORBIDOS]',
    anatomiaNotas: [
      'Cuerpo gelatinoso y translúcido que busca osamentas animales para sostenerse.',
      'Carentes de mente consciente hasta que se les implanta una púa hemalúrgica (Kandra).',
      'Inofensivos durante el día; carroñeros nocturnos entre las brumas.'
    ],
    citaShallan: '«Registros recopilados de los diarios de Khrissalla: formas que sueñan con ser hombres.»'
  }
];