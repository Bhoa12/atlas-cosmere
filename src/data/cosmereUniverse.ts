export interface Libro {
  id: string;
  titulo: string;
  saga: string;
  ordenSaga: number;
  ordenLecturaRecomendado: number;
  totalCapitulos: number;
  portadaColor: string;
  esNovelaCorta?: boolean;
}

export interface SistemaPlanetario {
  id: string;
  nombre: string;
  planeta: string;
  esquirlas: string[];
  colorAura: string;
  descripcion: string;
  climaYTiempo: string;
  faunaFlora: { nombre: string; tipo: 'fauna' | 'flora'; desc: string; desbloqueoLibroId: string }[];
  sistemasMagicos: { nombre: string; desc: string; desbloqueoLibroId: string }[];
  libros: Libro[];
}

export const SISTEMAS_COSMERE_COMPLETO: SistemaPlanetario[] = [
  {
    id: 'roshar',
    nombre: 'Sistema Rosharano Mayor',
    planeta: 'Roshar',
    esquirlas: ['Honor', 'Cultivación', 'Odium'],
    colorAura: '#38bdf8',
    descripcion: 'Un continente rocoso ecológicamente adaptado a las Altas Tormentas recurrentes.',
    climaYTiempo: 'Las Altas Tormentas barren el continente de este a oeste, depositando Cremacio e infundiendo las gemas con Luz Tormentosa.',
    faunaFlora: [
      { nombre: 'Chulls', tipo: 'fauna', desc: 'Crustáceos gigantescos domesticados usados como bestias de carga.', desbloqueoLibroId: 'twok' },
      { nombre: 'Abismoides (Chasmfiends)', tipo: 'fauna', desc: 'Depredadores colosales con caparazones quitinosos y corazones de gema.', desbloqueoLibroId: 'twok' },
      { nombre: 'Esprecs (Spren)', tipo: 'fauna', desc: 'Fragmentos conscientes de Investidura que encarnan ideas y emociones.', desbloqueoLibroId: 'twok' },
      { nombre: 'Hierba de Roca', tipo: 'flora', desc: 'Plantas que retraen sus tallos dentro de la roca al detectar vibraciones.', desbloqueoLibroId: 'twok' }
    ],
    sistemasMagicos: [
      { nombre: 'Potenciación (Surgebinding)', desc: 'Manipulación de las 10 fuerzas fundamentales mediante vínculos Nahel con esprecs.', desbloqueoLibroId: 'wor' },
      { nombre: 'Vacuomancia (Voidbinding)', desc: 'Contraparte mística de origen oscuro ligada a los Deshechos de Odium.', desbloqueoLibroId: 'o' }
    ],
    libros: [
      { id: 'twok', titulo: 'El Camino de los Reyes', saga: 'Archivo de las Tormentas', ordenSaga: 1, ordenLecturaRecomendado: 5, totalCapitulos: 75, portadaColor: '#1e3a8a' },
      { id: 'wor', titulo: 'Palabras Radiantes', saga: 'Archivo de las Tormentas', ordenSaga: 2, ordenLecturaRecomendado: 7, totalCapitulos: 89, portadaColor: '#0284c7' },
      { id: 'edgedancer', titulo: 'Danzante del Filo', saga: 'Archivo de las Tormentas', ordenSaga: 2.5, ordenLecturaRecomendado: 8, totalCapitulos: 20, portadaColor: '#0d9488', esNovelaCorta: true },
      { id: 'o', titulo: 'Juramentada', saga: 'Archivo de las Tormentas', ordenSaga: 3, ordenLecturaRecomendado: 9, totalCapitulos: 122, portadaColor: '#b91c1c' },
      { id: 'dawnshard', titulo: 'Esquirla del Amanecer', saga: 'Archivo de las Tormentas', ordenSaga: 3.5, ordenLecturaRecomendado: 10, totalCapitulos: 21, portadaColor: '#d97706', esNovelaCorta: true },
      { id: 'row', titulo: 'El Ritmo de la Guerra', saga: 'Archivo de las Tormentas', ordenSaga: 4, ordenLecturaRecomendado: 11, totalCapitulos: 117, portadaColor: '#4f46e5' },
      { id: 'wat', titulo: 'Viento y Verdad', saga: 'Archivo de las Tormentas', ordenSaga: 5, ordenLecturaRecomendado: 12, totalCapitulos: 115, portadaColor: '#7c3aed' }
    ]
  },
  {
    id: 'scadrial',
    nombre: 'Sistema Scadriano',
    planeta: 'Scadrial',
    esquirlas: ['Conservación', 'Ruina (Armonía)'],
    colorAura: '#f59e0b',
    descripcion: 'Mundo de cenizas y brumas en Era 1; metrópolis industrial electrificada en Era 2.',
    climaYTiempo: 'Ceniza constante en la Era Clásica. En la actualidad, clima templado con brumas nocturnas conscientes.',
    faunaFlora: [
      { nombre: 'Espectros de la Bruma (Mistwraiths)', tipo: 'fauna', desc: 'Carroñeros amorfos que absorben huesos para construir formas grotescas.', desbloqueoLibroId: 'tfe' },
      { nombre: 'Kandra', tipo: 'fauna', desc: 'Seres inmortales evolucionados de los espectros que pueden imitar cuerpos humanos.', desbloqueoLibroId: 'woa' },
      { nombre: 'Caballos Scadrianos', tipo: 'fauna', desc: 'Una de las pocas especies animales supervivientes del cataclismo de Rashek.', desbloqueoLibroId: 'tfe' }
    ],
    sistemasMagicos: [
      { nombre: 'Alomancia', desc: 'Poder de consumir y "quemar" metales para obtener habilidades físicas y mentales.', desbloqueoLibroId: 'tfe' },
      { nombre: 'Feruquimia', desc: 'Poder de almacenar los propios atributos corporales en metales para usarlos después.', desbloqueoLibroId: 'tfe' },
      { nombre: 'Hemalurgia', desc: 'Arte oscuro de robar Investidura clavando púas de metal a través del corazón.', desbloqueoLibroId: 'hoa' }
    ],
    libros: [
      { id: 'tfe', titulo: 'El Imperio Final', saga: 'Nacidos de la Bruma Era 1', ordenSaga: 1, ordenLecturaRecomendado: 1, totalCapitulos: 38, portadaColor: '#334155' },
      { id: 'woa', titulo: 'El Pozo de la Ascensión', saga: 'Nacidos de la Bruma Era 1', ordenSaga: 2, ordenLecturaRecomendado: 2, totalCapitulos: 59, portadaColor: '#475569' },
      { id: 'hoa', titulo: 'El Héroe de las Eras', saga: 'Nacidos de la Bruma Era 1', ordenSaga: 3, ordenLecturaRecomendado: 3, totalCapitulos: 82, portadaColor: '#64748b' },
      { id: 'sh', titulo: 'Historia Secreta', saga: 'Nacidos de la Bruma', ordenSaga: 3.5, ordenLecturaRecomendado: 6, totalCapitulos: 24, portadaColor: '#ef4444', esNovelaCorta: true },
      { id: 'aol', titulo: 'Aleación de Ley', saga: 'Nacidos de la Bruma Era 2', ordenSaga: 4, ordenLecturaRecomendado: 13, totalCapitulos: 20, portadaColor: '#92400e' },
      { id: 'sos', titulo: 'Sombras de Identidad', saga: 'Nacidos de la Bruma Era 2', ordenSaga: 5, ordenLecturaRecomendado: 14, totalCapitulos: 27, portadaColor: '#78350f' },
      { id: 'bom', titulo: 'Brazales de Duelo', saga: 'Nacidos de la Bruma Era 2', ordenSaga: 6, ordenLecturaRecomendado: 15, totalCapitulos: 31, portadaColor: '#b45309' },
      { id: 'tlm', titulo: 'El Metal Perdido', saga: 'Nacidos de la Bruma Era 2', ordenSaga: 7, ordenLecturaRecomendado: 16, totalCapitulos: 54, portadaColor: '#d97706' }
    ]
  },
  {
    id: 'sel',
    nombre: 'Sistema Selish',
    planeta: 'Sel',
    esquirlas: ['Devoción', 'Dominio'],
    colorAura: '#10b981',
    descripcion: 'Mundo donde las Esquirlas fueron astilladas y encerradas en el Reino Cognitivo (El Dor).',
    climaYTiempo: 'Geografía dependiente del paisaje cultural; la magia está estrictamente atada a la localización física.',
    faunaFlora: [
      { nombre: 'Seones (Seons)', tipo: 'fauna', desc: 'Esferas flotantes de luz con una runa central Aon que permiten comunicación instantánea.', desbloqueoLibroId: 'elantris' },
      { nombre: 'Skaze', tipo: 'fauna', desc: 'Entidades oscuras similares a los seones pero vinculadas a Dominio.', desbloqueoLibroId: 'elantris' }
    ],
    sistemasMagicos: [
      { nombre: 'AonDor', desc: 'Dibujo de símbolos rúnicos en el aire para canalizar la energía del Dor.', desbloqueoLibroId: 'elantris' },
      { nombre: 'Falsificación (Forgery)', desc: 'Reescritura del pasado de un objeto o persona mediante sellos de alma tallados.', desbloqueoLibroId: 'soul' }
    ],
    libros: [
      { id: 'elantris', titulo: 'Elantris', saga: 'Sel', ordenSaga: 1, ordenLecturaRecomendado: 4, totalCapitulos: 63, portadaColor: '#059669' },
      { id: 'soul', titulo: 'El Alma del Emperador', saga: 'Sel', ordenSaga: 2, ordenLecturaRecomendado: 4.5, totalCapitulos: 12, portadaColor: '#047857', esNovelaCorta: true }
    ]
  },
  {
    id: 'nalthis',
    nombre: 'Sistema Nalthiano',
    planeta: 'Nalthis',
    esquirlas: ['Dotación'],
    colorAura: '#ec4899',
    descripcion: 'Mundo cromáticamente brillante donde cada habitante nace con un Aliento biocromático.',
    climaYTiempo: 'Junglas exuberantes y mares cálidos. Flores de lágrimas de Edgli con tintes intensos.',
    faunaFlora: [
      { nombre: 'Lágrimas de Edgli', tipo: 'flora', desc: 'Flores endémicas de colores deslumbrantes usadas para los tintes más valiosos del Cosmere.', desbloqueoLibroId: 'warbreaker' }
    ],
    sistemasMagicos: [
      { nombre: 'Despertar Biocromático', desc: 'Comandar objetos inanimados dándoles órdenes verbales e infundiéndoles Alientos.', desbloqueoLibroId: 'warbreaker' }
    ],
    libros: [
      { id: 'warbreaker', titulo: 'El Aliento de los Dioses (Warbreaker)', saga: 'Nalthis', ordenSaga: 1, ordenLecturaRecomendado: 4.8, totalCapitulos: 58, portadaColor: '#be185d' }
    ]
  },
  {
    id: 'taldain',
    nombre: 'Sistema de Taldain',
    planeta: 'Taldain',
    esquirlas: ['Autonomía'],
    colorAura: '#eab308',
    descripcion: 'Planeta bloqueado marealmente: una mitad siempre de día bajo un sol blanco y la otra en noche eterna.',
    climaYTiempo: 'El Lado Diurno es un desierto infinito de arena investida; el Lado Nocturno es frío y avanzado tecnológicamente.',
    faunaFlora: [
      { nombre: 'Microorganismos de la Arena', tipo: 'flora', desc: 'Líquenes microscópicos que cubren los granos de arena y absorben la luz solar para recargar Investidura.', desbloqueoLibroId: 'whitesand' }
    ],
    sistemasMagicos: [
      { nombre: 'Maestría de la Arena', desc: 'Manipulación física y telequinética de las arenas blancas mediante la hidratación corporal.', desbloqueoLibroId: 'whitesand' }
    ],
    libros: [
      { id: 'whitesand', titulo: 'Arena Blanca (White Sand)', saga: 'Taldain', ordenSaga: 1, ordenLecturaRecomendado: 0, totalCapitulos: 30, portadaColor: '#ca8a04' }
    ]
  },
  {
    id: 'lumar',
    nombre: 'Sistema Lumar',
    planeta: 'Lumar',
    esquirlas: ['Ninguna (Esporas de Éteres)'],
    colorAura: '#14b8a6',
    descripcion: 'Un mundo sin océanos de agua; posee doce mares de esporas de colores que caen de doce lunas.',
    climaYTiempo: 'Las esporas reaccionan violentamente con el agua: la espora esmeralda crea zarzas gigantescas, la rosa crea cristales.',
    faunaFlora: [
      { nombre: 'Esporas de Éteres', tipo: 'flora', desc: 'Polvo lunar vegetal que germina de forma instantánea al contacto con cualquier líquido.', desbloqueoLibroId: 'tress' }
    ],
    sistemasMagicos: [
      { nombre: 'Navegación de Esporas', desc: 'Fluido de aire a través de lechos de esporas para permitir la navegación de barcos.', desbloqueoLibroId: 'tress' }
    ],
    libros: [
      { id: 'tress', titulo: 'Trenza del Mar Esmeralda', saga: 'Novelas Secretas', ordenSaga: 1, ordenLecturaRecomendado: 17, totalCapitulos: 65, portadaColor: '#0f766e' }
    ]
  },
  {
    id: 'cantico',
    nombre: 'Sistema de Cántico',
    planeta: 'Cántico (Canticle)',
    esquirlas: ['Fragmentos de Sol / Thaidakar'],
    colorAura: '#f97316',
    descripcion: 'Un planeta diminuto donde el amanecer incinera la superficie. Los habitantes viven huyendo en naves continuas.',
    climaYTiempo: 'Luz solar letal que funde la roca y recarga con calor/energía a quienes mueren bajo su luz (Sombras de Carbón).',
    faunaFlora: [
      { nombre: 'Sombras de Carbón', tipo: 'fauna', desc: 'Cadáveres carbonizados reanimados por la Investidura del sol.', desbloqueoLibroId: 'sunlit' }
    ],
    sistemasMagicos: [
      { nombre: 'Motores de Investidura Solar', desc: 'Baterías que absorben la energía letal del amanecer para propulsar ciudades voladoras.', desbloqueoLibroId: 'sunlit' }
    ],
    libros: [
      { id: 'sunlit', titulo: 'El Hombre Iluminado', saga: 'Novelas Secretas', ordenSaga: 4, ordenLecturaRecomendado: 18, totalCapitulos: 52, portadaColor: '#c2410c' }
    ]
  },
  {
    id: 'drominad',
    nombre: 'Sistema Drominad',
    planeta: 'Primero del Sol',
    esquirlas: ['Autonomía (avatar Patrocinio)'],
    colorAura: '#3b82f6',
    descripcion: 'Océanos infinitos y archipiélagos letales dominados por la isla mística de Patji.',
    climaYTiempo: 'Tormentas oceánicas y selvas hiper-competitivas con criaturas que rastrean mentes.',
    faunaFlora: [
      { nombre: 'Aviar', tipo: 'fauna', desc: 'Aves que comen los frutos del árbol de Patji y obtienen dones mágicos (ocultar mentes o proyectar visiones de peligro).', desbloqueoLibroId: 'sixth' }
    ],
    sistemasMagicos: [
      { nombre: 'Dones Aviar', desc: 'Habilidades mentales conferidas a través de la simbiosis con parásitos investidos.', desbloqueoLibroId: 'sixth' }
    ],
    libros: [
      { id: 'sixth', titulo: 'Sexto del Ocaso', saga: 'Drominad', ordenSaga: 1, ordenLecturaRecomendado: 19, totalCapitulos: 10, portadaColor: '#1d4ed8', esNovelaCorta: true },
      { id: 'emberdark', titulo: 'Islas del Ascuaoscura (Isles of the Emberdark)', saga: 'Novelas Secretas', ordenSaga: 5, ordenLecturaRecomendado: 20, totalCapitulos: 50, portadaColor: '#2563eb' }
    ]
  }
];