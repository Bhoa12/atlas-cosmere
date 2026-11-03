export interface RadarCapitulo {
  libroId: string;
  capitulo: number;
  tituloEscena: string;
  ubicacion: string;
  personajesPresentes: string[];
  magiasEnUso: string[];
  avistamientoHoid?: string;
  notaAntiespoiler: string;
}

export const RADAR_CAPITULOS_CANONICO: RadarCapitulo[] = [
  {
    libroId: 'twok',
    capitulo: 1,
    tituloEscena: 'El Asesino de Blanco (Prólogo)',
    ubicacion: 'Palacio Real de Kholinar, Alezkar',
    personajesPresentes: ['Szeth-hijo-hijo-Vallano', 'Gavilar Kholin', 'Elhokar Kholin'],
    magiasEnUso: ['Potenciación: Gravitación (Caída múltiple)', 'Hoja de Honor'],
    notaAntiespoiler: 'Gavilar confía a Szeth una esfera negra antes de morir pronunciando: "Debes decirles... que no deben encontrarlo".'
  },
  {
    libroId: 'twok',
    capitulo: 6,
    tituloEscena: 'El Puente Cuatro',
    ubicacion: 'Llanuras Quebradas, Campamentos Alezis',
    personajesPresentes: ['Kaladin', 'Torol Sadeas', 'Gazan', 'Roca'],
    magiasEnUso: ['Ninguna Investidura activa detectable'],
    avistamientoHoid: 'Hoid observa desde los campamentos bajo el alias de Sagaz real.',
    notaAntiespoiler: 'Kaladin es arrojado a las tripulaciones de puente como esclavo condenado.'
  },
  {
    libroId: 'tfe',
    capitulo: 1,
    tituloEscena: 'Cenizas en las Plantaciones',
    ubicacion: 'Mansión Tresting, Dominio Central, Scadrial',
    personajesPresentes: ['Kelsier', 'Lord Tresting', 'Esclavos Skaa'],
    magiasEnUso: ['Alomancia: Quema de peltre e hierro'],
    notaAntiespoiler: 'Kelsier demuestra la brutalidad de la resistencia Skaa tras su escape de los Pozos de Hathsin.'
  },
  {
    libroId: 'tfe',
    capitulo: 19,
    tituloEscena: 'Encuentro en la Calle de las Mentiras',
    ubicacion: 'Bajos fondos de Luthadel',
    personajesPresentes: ['Kelsier', 'Hoid (Informante)'],
    magiasEnUso: ['Alomancia: Cobre'],
    avistamientoHoid: 'Hoid opera disfrazado de informante ciego vendiendo rumores a Kelsier.',
    notaAntiespoiler: 'Primera aparición cronológica de Hoid en las novelas publicadas de Scadrial.'
  }
];