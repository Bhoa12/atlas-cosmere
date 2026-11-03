export interface OrdenRadiante {
  id: string;
  nombre: string;
  potencias: string[];
  esprec: string;
  glifo: string;
  descripcion: string;
  lema: string;
  color: string;
}

export const ORDENES_RADIANTE: { [key: string]: OrdenRadiante } = {
  windrunner: {
    id: 'windrunner',
    nombre: 'Corredores del Viento',
    potencias: ['Adhesión', 'Gravitación'],
    esprec: 'Esprec de Honor (Honorspren)',
    glifo: '🌬️',
    descripcion: 'Protectores natos guiados por el deber de salvaguardar a los desvalidos, incluso de sí mismos.',
    lema: 'Protegeré a quienes no pueden protegerse a sí mismos.',
    color: '#0284c7'
  },
  skybreaker: {
    id: 'skybreaker',
    nombre: 'Rompedores del Cielo',
    potencias: ['Gravitación', 'División'],
    esprec: 'Esprec de Ceniza (Highspren)',
    glifo: '⚖️',
    descripcion: 'Agentes de la ley y la justicia implacable. Su lealtad reside en los códigos morales objetivos.',
    lema: 'Buscaré la justicia y purgaré la iniquidad.',
    color: '#334155'
  },
  dustbringer: {
    id: 'dustbringer',
    nombre: 'Portadores del Polvo',
    potencias: ['División', 'Abrasión'],
    esprec: 'Esprec de Ceniza menor (Ashspren)',
    glifo: '💥',
    descripcion: 'Artesanos del desmantelamiento con gran disciplina interna para contener su devastador poder.',
    lema: 'Buscaré el autocontrol antes que la destrucción.',
    color: '#dc2626'
  },
  edgedancer: {
    id: 'edgedancer',
    nombre: 'Danzantes del Filo',
    potencias: ['Abrasión', 'Progresión'],
    esprec: 'Esprec Cultivador (Cultivationspren)',
    glifo: '🌿',
    descripcion: 'Elegantes y ágiles sanadores dedicados a recordar a los olvidados y a las gentes sencillas.',
    lema: 'Recordaré a quienes han sido olvidados.',
    color: '#059669'
  },
  truthwatcher: {
    id: 'truthwatcher',
    nombre: 'Vigilantes de la Verdad',
    potencias: ['Progresión', 'Iluminación'],
    esprec: 'Mistspren',
    glifo: '👁️',
    descripcion: 'Sanadores filosóficos e investigadores de la verdad cósmica que aprecian el silencio.',
    lema: 'Buscaré la verdad última detrás de la ilusión.',
    color: '#10b981'
  },
  lightweaver: {
    id: 'lightweaver',
    nombre: 'Tejedores de Luz',
    potencias: ['Iluminación', 'Transformación'],
    esprec: 'Esprec de Cripta (Cryptic / Mentiras)',
    glifo: '🎭',
    descripcion: 'Artistas, espías e ilusionistas que admiten verdades dolorosas sobre sí mismos para crecer.',
    lema: 'Pronunciaré mis verdades más oscuras.',
    color: '#ec4899'
  },
  elsecaller: {
    id: 'elsecaller',
    nombre: 'Nominadores de lo Otro',
    potencias: ['Transformación', 'Transporte'],
    esprec: 'Inkspren',
    glifo: '📖',
    descripcion: 'Eruditos pragmáticos, lógicos y decididos capaces de transitar físicamente hacia Shadesmar.',
    lema: 'Alcanzaré mi verdadero potencial intelectual.',
    color: '#6366f1'
  },
  willshaper: {
    id: 'willshaper',
    nombre: 'Moldeadores de Voluntades',
    potencias: ['Transporte', 'Cohesión'],
    esprec: 'Lightspren',
    glifo: '🔓',
    descripcion: 'Constructores y libertadores que no toleran la tiranía ni el aprisionamiento.',
    lema: 'Buscaré la libertad para todos los pueblos.',
    color: '#d97706'
  },
  stoneward: {
    id: 'stoneward',
    nombre: 'Custodios de la Piedra',
    potencias: ['Cohesión', 'Tensión'],
    esprec: 'Peakspren',
    glifo: '⛰️',
    descripcion: 'Guerreros inamovibles, leales e inflexibles que siempre están donde más se los necesita.',
    lema: 'Estaré donde me necesiten hasta el final.',
    color: '#b45309'
  },
  bondsmith: {
    id: 'bondsmith',
    nombre: 'Forjadores de Vínculos',
    potencias: ['Tensión', 'Adhesión'],
    esprec: 'Padre Tormenta / Guardiana Nocturna / Hermano',
    glifo: '⚡',
    descripcion: 'Solo tres miembros a la vez. Conectores de mundos, mentes y naciones en una sola causa.',
    lema: 'Uniré a los hombres en lugar de dividirlos.',
    color: '#eab308'
  }
};

export const PREGUNTAS_ORDEN_RADIANTE = [
  {
    pregunta: 'Ante una crisis civil masiva, tu primer impulso instintivo es:',
    opciones: [
      { texto: 'Correr al frente para interponer mi cuerpo entre el peligro y los indefensos.', orden: 'windrunner' },
      { texto: 'Descubrir quién violó los pactos y aplicar la ley con pulso firme.', orden: 'skybreaker' },
      { texto: 'Organizar a los líderes dispersos y forjar una coalición unida.', orden: 'bondsmith' },
      { texto: 'Cuidar a los mendigos y heridos que nadie más está atendiendo.', orden: 'edgedancer' }
    ]
  },
  {
    pregunta: '¿Cuál es la mayor virtud a la que puede aspirar un ser consciente?',
    opciones: [
      { texto: 'La creatividad artística y la honestidad con las propias sombras.', orden: 'lightweaver' },
      { texto: 'El conocimiento pragmático y el desarrollo intelectual sin sesgos.', orden: 'elsecaller' },
      { texto: 'La lealtad inquebrantable hacia tus compañeros de trinchera.', orden: 'stoneward' },
      { texto: 'La libertad individual y el derrocamiento de cadenas.', orden: 'willshaper' }
    ]
  },
  {
    pregunta: '¿Cómo prefieres resolver un conflicto aparentemente sin salida?',
    opciones: [
      { texto: 'Desmontando el problema pieza a pieza hasta entender su estructura básica.', orden: 'dustbringer' },
      { texto: 'Buscando la verdad oculta que ambas partes niegan ver.', orden: 'truthwatcher' },
      { texto: 'Forzando una tregua donde el bien común supere las diferencias personales.', orden: 'bondsmith' },
      { texto: 'Infiltrándome con audacia y cambiando las reglas del juego.', orden: 'lightweaver' }
    ]
  }
];