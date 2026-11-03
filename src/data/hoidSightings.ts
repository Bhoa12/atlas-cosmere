export interface AvistamientoHoid {
  libroId: string;
  tituloLibro: string;
  alias: string;
  capitulo: string;
  objetoMagicoUsado: string;
  descripcionCanon: string;
}

export const AVISTAMIENTOS_HOID_TOTAL: AvistamientoHoid[] = [
  {
    libroId: 'tfe',
    tituloLibro: 'El Imperio Final',
    alias: 'Informante Ciego',
    capitulo: 'Capítulo 19',
    objetoMagicoUsado: 'Nubes de cobre alománticas',
    descripcionCanon: 'Se hace pasar por un mendigo ciego en Luthadel que se reúne con Kelsier para venderle secretos de los nobles.'
  },
  {
    libroId: 'woa',
    tituloLibro: 'El Pozo de la Ascensión',
    alias: 'Refugiado Terrisano',
    capitulo: 'Capítulo 56',
    objetoMagicoUsado: 'Rastreo feruquímico',
    descripcionCanon: 'Viaja entre las caravanas de refugiados en Terris buscando la ubicación del Pozo de la Ascensión.'
  },
  {
    libroId: 'sh',
    tituloLibro: 'Historia Secreta',
    alias: 'El Navegante del Reino Cognitivo',
    capitulo: 'Parte 2',
    objetoMagicoUsado: 'Una perla de Lerasium pura',
    descripcionCanon: 'Surca el mar de cuentas sobre un cadáver reanimado, pelea a puñetazos con Kelsier y se traga el Lerasium para convertirse en Mistborn.'
  },
  {
    libroId: 'twok',
    tituloLibro: 'El Camino de los Reyes',
    alias: 'Sagaz (Bufón del Rey)',
    capitulo: 'Capítulo 54',
    objetoMagicoUsado: 'Flauta de madera y narración investida',
    descripcionCanon: 'Insulta a los altos príncipes con ingenio lacerante y cuenta la historia de Derethil y los Caminantes del Viento a Kaladin.'
  },
  {
    libroId: 'wor',
    tituloLibro: 'Palabras Radiantes',
    alias: 'El Cochero de Adolin / Sagaz',
    capitulo: 'Epílogo',
    objetoMagicoUsado: 'Alomancia emocional y bienvenida a Taln',
    descripcionCanon: 'Espera en las puertas de Kholinar al Heraldo Talenelat\'Elin y recoge su Hoja de Honor cuando cae inconsciente.'
  },
  {
    libroId: 'warbreaker',
    tituloLibro: 'El Aliento de los Dioses',
    alias: 'Cuentacuentos de Idris',
    capitulo: 'Capítulo 32',
    objetoMagicoUsado: 'Despertar de cuerdas y polvos de colores',
    descripcionCanon: 'Narra la historia de los Cuatro Retornados originales ante Siri y Susebron arrojando tintes brillantes en el aire.'
  },
  {
    libroId: 'tress',
    tituloLibro: 'Trenza del Mar Esmeralda',
    alias: 'Charlie el Narrador',
    capitulo: 'Narrador Omnisciente',
    objetoMagicoUsado: 'Maldición de la Hechicera elantriana',
    descripcionCanon: 'Actúa como narrador directo de toda la historia, vistiendo ropa extravagante y sufriendo una maldición que le impide hablar con sentido.'
  }
];