export interface Worldhopper {
  id: string;
  nombre: string;
  mundoOrigen: string;
  mundosVisitados: string[];
  organizacion: string;
  identidadesConocidas: string[];
  descripcion: string;
}

export const LISTA_WORLDHOPPERS: Worldhopper[] = [
  {
    id: 'hoid',
    nombre: 'Hoid (Cephandrius)',
    mundoOrigen: 'Yolen',
    mundosVisitados: ['Roshar', 'Scadrial', 'Sel', 'Nalthis', 'Taldain', 'Lumar', 'Cántico'],
    organizacion: 'Independiente (Conspirador Antiguo)',
    identidadesConocidas: ['Sagaz (Roshar)', 'Informante ciego (Luthadel)', 'Mendigo errante (Elantris)', 'Charlie el Cuidador (Lumar)'],
    descripcion: 'Presente en la Fragmentación de Adonalsium. Portador de una perla de lerasium, un vínculo con un esprec de cripta y Alientos biocromáticos.'
  },
  {
    id: 'vasher',
    nombre: 'Vasher (Zahel)',
    mundoOrigen: 'Nalthis',
    mundosVisitados: ['Nalthis', 'Roshar'],
    organizacion: 'Los Cinco Visionarios',
    identidadesConocidas: ['Zahel (Maestro de espada en Urithiru)', 'Talento de la Guerra'],
    descripcion: 'Retornado de Nalthis y forjador de Sangre de la Noche. Vive en Roshar consumiendo Luz Tormentosa en lugar de Alientos humanos.'
  },
  {
    id: 'kelsier',
    nombre: 'Kelsier (Thaidakar)',
    mundoOrigen: 'Scadrial',
    mundosVisitados: ['Scadrial (Físico/Cognitivo)', 'Influencia directa en Roshar'],
    organizacion: 'Sangre de Espectro (Ghostbloods - Líder Supremo)',
    identidadesConocidas: ['El Superviviente de Hathsin', 'El Señor de las Cicatrices', 'Thaidakar'],
    descripcion: 'Sombra cognitiva grapada a un cuerpo con una púa hemalúrgica. Dirige la red secreta de contrabando de Investidura interestelar.'
  },
  {
    id: 'khriss',
    nombre: 'Khrissalla (Khriss)',
    mundoOrigen: 'Taldain',
    mundosVisitados: ['Taldain', 'Scadrial', 'Silverlight'],
    organizacion: 'Universidad de Silverlight',
    identidadesConocidas: ['La Erudita de los Ensayos del Arcanum'],
    descripcion: 'La mente científica más brillante del Cosmere. Investiga las leyes físicas de la Investidura junto a su ayudante Nazh.'
  },
  {
    id: 'vivenna',
    nombre: 'Vivenna (Azure)',
    mundoOrigen: 'Nalthis',
    mundosVisitados: ['Nalthis', 'Roshar'],
    organizacion: 'Realeza de Idris / Comandante de la Guardia de Kholinar',
    identidadesConocidas: ['Alta Mariscala Azure'],
    descripcion: 'Portadora de una espada investida artificial y experta en el Despertar de telas.'
  }
];