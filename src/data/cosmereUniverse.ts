export interface PersonajeLibro {
  nombre: string;
  rol: string;
  escondidoPorSpoiler?: boolean;
}

export interface Libro {
  id: string;
  titulo: string;
  saga: string;
  ordenSaga: number;
  ordenLecturaRecomendado: number;
  totalCapitulos: number;
  portadaColor: string;
  esNovelaCorta?: boolean;
  sinopsis: string;
  personajesClave: PersonajeLibro[];
  conexionesCosmere: string;
}

export interface SistemaPlanetario {
  id: string;
  nombre: string;
  planeta: string;
  esquirlas: string[];
  colorAura: string;
  mapaTerritorial: string; // Explicación de regiones y mapas
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
    mapaTerritorial: 'Mapa de Roshar: Dominado por el supercontinente rosharano. Al este se extienden las hostiles Llanuras Quebradas y los Picos de los Comecuernos; al oeste el poderoso imperio de Alezkar, Jah Keved, Thaylenah y las islas de Shinovar (la única región con tierra fértil sin cremacio).',
    descripcion: 'Un continente rocoso ecológicamente adaptado a las Altas Tormentas recurrentes.',
    climaYTiempo: 'Las Altas Tormentas barren el continente de este a oeste, depositando Cremacio e infundiendo gemas con Luz Tormentosa.',
    faunaFlora: [
      { nombre: 'Chulls', tipo: 'fauna', desc: 'Crustáceos gigantescos domesticados usados como bestias de carga y transporte.', desbloqueoLibroId: 'twok' },
      { nombre: 'Abismoides (Chasmfiends)', tipo: 'fauna', desc: 'Depredadores colosales con caparazones quitinosos y corazones de gema gigante.', desbloqueoLibroId: 'twok' },
      { nombre: 'Esprecs de Honor (Honorspren)', tipo: 'fauna', desc: 'Esprecs sapientes capaces de formar el vínculo Nahel de Corredor del Viento.', desbloqueoLibroId: 'twok' },
      { nombre: 'Esprecs de Cripta (Cryptics)', tipo: 'fauna', desc: 'Seres geométricos fractales atraídos por las mentiras profundas.', desbloqueoLibroId: 'wor' },
      { nombre: 'Hierba de Roca y Arboles de Concha', tipo: 'flora', desc: 'Vegetación móvil que se repliega en la piedra al sentir vibraciones.', desbloqueoLibroId: 'twok' }
    ],
    sistemasMagicos: [
      { nombre: 'Potenciación (Surgebinding)', desc: 'Manipulación de 10 fuerzas fundamentales mediante vínculos Nahel con esprecs.', desbloqueoLibroId: 'wor' },
      { nombre: 'Vacuomancia (Voidbinding)', desc: 'Magia mística asociada a los 9 Deshechos de Odium.', desbloqueoLibroId: 'o' },
      { nombre: 'Hojas y Armaduras de Esquirla', desc: 'Armamento fabricado con el cuerpo espiritual condensado de esprecs o Heraldos.', desbloqueoLibroId: 'twok' }
    ],
    libros: [
      {
        id: 'twok',
        titulo: 'El Camino de los Reyes',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 1,
        ordenLecturaRecomendado: 5,
        totalCapitulos: 75,
        portadaColor: '#1e3a8a',
        sinopsis: 'En las Llanuras Quebradas, los ejércitos alezis libran una guerra de venganza contra los parshendi. Kaladin, un soldado esclavizado, lucha por salvar a sus compañeros del Puente Cuatro mientras Dalinar Kholin experimenta visiones ancestrales de los Caballeros Radiantes.',
        personajesClave: [
          { nombre: 'Kaladin Bendito por la Tormenta', rol: 'Esclavo cirujano y líder del Puente Cuatro' },
          { nombre: 'Dalinar Kholin (Espina Negra)', rol: 'Gran príncipe alezi asolado por visiones' },
          { nombre: 'Shallan Davar', rol: 'Joven erudita en busca de salvar a su familia' },
          { nombre: 'Szeth-hijo-hijo-Vallano', rol: 'El Asesino de Blanco' }
        ],
        conexionesCosmere: 'Aparición de Sagaz (Hoid) como bufón real. Primer contacto con las cartas inter-esquirlas entre Hoid y Frost.'
      },
      {
        id: 'wor',
        titulo: 'Palabras Radiantes',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 2,
        ordenLecturaRecomendado: 7,
        totalCapitulos: 89,
        portadaColor: '#0284c7',
        sinopsis: 'Los parshendi buscan una nueva forma de poder para no ser aniquilados, despertando la Tormenta Eterna. Kaladin debe aprender a dominar las potencias del Corredor del Viento mientras Shallan intenta infiltrarse en los conspiradores Hijos del Honor.',
        personajesClave: [
          { nombre: 'Shallan Davar', rol: 'Tejedora de Luz y pupila de Jasnah Kholin' },
          { nombre: 'Adolin Kholin', rol: 'Duelista magistral y heredero de la Casa Kholin' },
          { nombre: 'Eshonai', rol: 'Última guerrera parshendi con honor' }
        ],
        conexionesCosmere: 'Aparición de Sangre de la Noche y Zahel (Vasher), conectando directamente con Nalthis (Warbreaker).'
      },
      {
        id: 'edgedancer',
        titulo: 'Danzante del Filo',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 2.5,
        ordenLecturaRecomendado: 8,
        totalCapitulos: 20,
        portadaColor: '#0d9488',
        esNovelaCorta: true,
        sinopsis: 'Lift, una joven radiante que se desliza por el suelo y metaboliza comida en Luz Tormentosa, viaja a Yeddaw para salvar a un inocente del fanatismo del Heraldo Nale.',
        personajesClave: [
          { nombre: 'Lift', rol: 'Danzante del Filo que nunca envejece' },
          { nombre: 'Nale (Nin)', rol: 'Heraldo de la Justicia y Rompedor del Cielo' }
        ],
        conexionesCosmere: 'Exploración del Heraldo loco Nale y las peculiaridades de la Investidura de Cultivación en Tashikk.'
      },
      {
        id: 'o',
        titulo: 'Juramentada',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 3,
        ordenLecturaRecomendado: 9,
        totalCapitulos: 122,
        portadaColor: '#b91c1c',
        sinopsis: 'Con Urithiru reconquistada, los reyes y radiantes deben forjar una coalición continental ante el regreso de los Fusionados. Dalinar desentraña los recuerdos censurados de su sangriento pasado y de su esposa Evi.',
        personajesClave: [
          { nombre: 'Dalinar Kholin', rol: 'Forjador de Vínculos de la Esquirla Honor' },
          { nombre: 'Venli', rol: 'Superviviente cantora y primera Oyente Radiante' },
          { nombre: 'Taravangian', rol: 'Rey de Kharbranth y artífice del Diagrama' }
        ],
        conexionesCosmere: 'Viaje físico a través de Shadesmar (Reino Cognitivo); contacto con humanos y etnias de Scadrial y Nalthis en ciudades de spren.'
      },
      {
        id: 'dawnshard',
        titulo: 'Esquirla del Amanecer',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 3.5,
        ordenLecturaRecomendado: 10,
        totalCapitulos: 21,
        portadaColor: '#d97706',
        esNovelaCorta: true,
        sinopsis: 'Rysn y Cord encabezan una expedición náutica hacia la mística isla prohibida de Akinah, rodeada por una tormenta perpetua que oculta el secreto cósmico que destruyó las órdenes antiguas.',
        personajesClave: [
          { nombre: 'Rysn Ftori', rol: 'Comerciante thayleña y capitana del Caminante del Viento' },
          { nombre: 'Chiri-Chiri', rol: 'Larkin alada devoradora de Investidura' }
        ],
        conexionesCosmere: 'Revelación fundamental sobre las cuatro Esquirlas del Amanecer primigenias usadas para fragmentar a Adonalsium.'
      },
      {
        id: 'row',
        titulo: 'El Ritmo de la Guerra',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 4,
        ordenLecturaRecomendado: 11,
        totalCapitulos: 117,
        portadaColor: '#4f46e5',
        sinopsis: 'Urithiru cae bajo la ocupación enemiga de Raboniel. Navani Kholin y Kaladin libran una guerra de guerrillas científica y psicológica mientras Shallan persigue a la organización secreta de los Sangre de Espectro.',
        personajesClave: [
          { nombre: 'Navani Kholin', rol: 'Erudita de fabriales y reina de Urithiru' },
          { nombre: 'Raboniel', rol: 'Dama de los Deseos y erudita de los Fusionados' }
        ],
        conexionesCosmere: 'Descubrimiento de la física de la Investidura (tonos de Roshar, antimateria de luz) y revelación de la identidad del líder de los Ghostbloods: Thaidakar.'
      },
      {
        id: 'wat',
        titulo: 'Viento y Verdad (Wind and Truth)',
        saga: 'Archivo de las Tormentas',
        ordenSaga: 5,
        ordenLecturaRecomendado: 12,
        totalCapitulos: 115,
        portadaColor: '#7c3aed',
        sinopsis: 'Los diez días previos al épico duelo de campeones en lo alto de Urithiru que decidirá el destino eterno de Roshar y de las tres Esquirlas.',
        personajesClave: [
          { nombre: 'Dalinar Kholin', rol: 'Campeón del Honor' },
          { nombre: 'Szeth y Kaladin', rol: 'Expedicionarios hacia la tierra prohibida de Shinovar' }
        ],
        conexionesCosmere: 'Cierre del primer arco del Archivo de las Tormentas con repercusiones cósmicas para todo el universo.'
      }
    ]
  },
  {
    id: 'scadrial',
    nombre: 'Sistema Scadriano',
    planeta: 'Scadrial',
    esquirlas: ['Conservación', 'Ruina (Armonía)'],
    colorAura: '#f59e0b',
    mapaTerritorial: 'Mapa de Scadrial: En la Era Clásica, dominado por el Imperio Final con su capital imperial Luthadel, los Pozos de Hathsin y las provincias dominantes rodeadas de ceniza volcánica. En la Era 2, el mapa se centra en la cuenca de Elendel con sus canales y los Áridos fronterizos.',
    descripcion: 'Mundo de cenizas y brumas en Era 1; metrópolis industrial electrificada en Era 2.',
    climaYTiempo: 'Ceniza constante en la Era Clásica. En la actualidad, clima templado con brumas nocturnas conscientes.',
    faunaFlora: [
      { nombre: 'Espectros de la Bruma (Mistwraiths)', tipo: 'fauna', desc: 'Carroñeros amorfos que absorben esqueletos para componer su forma física.', desbloqueoLibroId: 'tfe' },
      { nombre: 'Kandra', tipo: 'fauna', desc: 'Criaturas conscientes de la Primera y Segunda Generación creadas por el Lord Legislador.', desbloqueoLibroId: 'woa' },
      { nombre: 'Colosos (Koloss)', tipo: 'fauna', desc: 'Monstruos humanoides de piel azul que nunca dejan de crecer.', desbloqueoLibroId: 'tfe' }
    ],
    sistemasMagicos: [
      { nombre: 'Alomancia', desc: 'Quema de 16 metales en el estómago para extraer potencia física, mental y temporal.', desbloqueoLibroId: 'tfe' },
      { nombre: 'Feruquimia', desc: 'Almacenamiento de atributos en mentes de metal (peso, salud, velocidad, recuerdos).', desbloqueoLibroId: 'tfe' },
      { nombre: 'Hemalurgia', desc: 'Arte de robar Investidura atravesando corazones con clavos metálicos.', desbloqueoLibroId: 'hoa' }
    ],
    libros: [
      {
        id: 'tfe',
        titulo: 'El Imperio Final',
        saga: 'Nacidos de la Bruma Era 1',
        ordenSaga: 1,
        ordenLecturaRecomendado: 1,
        totalCapitulos: 38,
        portadaColor: '#334155',
        sinopsis: 'Durante mil años la ceniza ha caído y los skaa han vivido esclavizados bajo el Lord Legislador. Kelsier, un ladrón superviviente de los Pozos de Hathsin, recluta a una joven de los bajos fondos llamada Vin para derrocar un imperio inmortal.',
        personajesClave: [
          { nombre: 'Vin', rol: 'Chica de la calle convertida en la más temible Nacida de la Bruma' },
          { nombre: 'Kelsier', rol: 'El Superviviente de Hathsin' },
          { nombre: 'Sazed', rol: 'Guardián terrisano y custodio de religiones perdidas' },
          { nombre: 'Elend Venture', rol: 'Noble erudito que sueña con un gobierno justo' }
        ],
        conexionesCosmere: 'Presentación del sistema de los 16 metales y primera aparición destacada de Hoid como informante ciego en Luthadel.'
      },
      {
        id: 'woa',
        titulo: 'El Pozo de la Ascensión',
        saga: 'Nacidos de la Bruma Era 1',
        ordenSaga: 2,
        ordenLecturaRecomendado: 2,
        totalCapitulos: 59,
        portadaColor: '#475569',
        sinopsis: 'Tras matar a un dios, gobernar resulta mucho más difícil. Tres ejércitos sitian Luthadel mientras Vin siente una llamada telúrica hacia el legendario Pozo de la Ascensión donde se oculta un poder primordial.',
        personajesClave: [
          { nombre: 'Vin', rol: 'Defensora de Luthadel' },
          { nombre: 'Elend Venture', rol: 'Rey de Luthadel' },
          { nombre: 'Zane', rol: 'Nacido de la bruma atormentado' },
          { nombre: 'OreSeur / TenSoon', rol: 'Kandra vinculado por Contrato' }
        ],
        conexionesCosmere: 'La naturaleza de la Esquirla Ruina y el aprisionamiento de la Investidura en fuentes termales/pozos.'
      },
      {
        id: 'hoa',
        titulo: 'El Héroe de las Eras',
        saga: 'Nacidos de la Bruma Era 1',
        ordenSaga: 3,
        ordenLecturaRecomendado: 3,
        totalCapitulos: 82,
        portadaColor: '#64748b',
        sinopsis: 'Ruina ha sido liberada y el mundo se muere entre ceniza roja y terremotos. Vin y Elend buscan los almacenes secretos del Lord Legislador para descubrir la profecía de quién será el Héroe que salve la Creación.',
        personajesClave: [
          { nombre: 'Sazed', rol: 'Erudito que ha perdido la fe tras la muerte de Tindwyl' },
          { nombre: 'Fantasma (Spook)', rol: 'Ojo de estaño que lidera la resistencia en Urteau' },
          { nombre: 'Marsh', rol: 'Inquisidor de Acero dominado por Ruina' }
        ],
        conexionesCosmere: 'Fusión de las Esquirlas Conservación y Ruina en una sola entidad: Armonía. Demostración de cómo se porta el poder de una Esquirla.'
      },
      {
        id: 'sh',
        titulo: 'Historia Secreta (Secret History)',
        saga: 'Nacidos de la Bruma',
        ordenSaga: 3.5,
        ordenLecturaRecomendado: 6,
        totalCapitulos: 24,
        portadaColor: '#ef4444',
        esNovelaCorta: true,
        sinopsis: 'Lo que ocurrió detrás del telón de la Era 1. Los pasos de Kelsier en el Reino Cognitivo tras su muerte física, sus encuentros con Hoid, los elantrianos y su negativa a pasar al Más Allá.',
        personajesClave: [
          { nombre: 'Kelsier (Sombra Cognitiva)', rol: 'El Superviviente que desafía a la muerte' },
          { nombre: 'Hoid (Cephandrius)', rol: 'Trotamundos en busca de una perla de lerasium' },
          { nombre: 'Kriss y Nazh', rol: 'Eruditos de Silverlight cartografiando el Cosmere' }
        ],
        conexionesCosmere: 'Novela hiperconectada: muestra Silverlight, pozos perpendiculares, vasijas de Esquirlas y el origen de los Ghostbloods.'
      },
      {
        id: 'aol',
        titulo: 'Aleación de Ley',
        saga: 'Nacidos de la Bruma Era 2',
        ordenSaga: 4,
        ordenLecturaRecomendado: 13,
        totalCapitulos: 20,
        portadaColor: '#92400e',
        sinopsis: 'Tres siglos después, Scadrial vive su revolución industrial con revólveres, ferrocarril y electricidad. Waxillium Ladrian, un justiciero de los Áridos, regresa a la metrópolis de Elendel para asumir el liderazgo de su casa noble.',
        personajesClave: [
          { nombre: 'Waxillium Ladrian', rol: 'Combi-férreo: Naciente lanzamonedas y feruquimista de peso' },
          { nombre: 'Wayne', rol: 'Hacedor de burbujas de velocidad y maestro del disfraz' },
          { nombre: 'Marasi Colms', rol: 'Estudiante de criminología y alomante de cadmio' }
        ],
        conexionesCosmere: 'Evolución científica de la Alomancia y la Feruquimia combinadas (*Twinborn*).'
      },
      {
        id: 'sos',
        titulo: 'Sombras de Identidad',
        saga: 'Nacidos de la Bruma Era 2',
        ordenSaga: 5,
        ordenLecturaRecomendado: 14,
        totalCapitulos: 27,
        portadaColor: '#78350f',
        sinopsis: 'Una kandra renegada asesina a políticos y magnates de Elendel utilizando una púa hemalúrgica desconocida que no proviene de Armonía, desatando revueltas sociales.',
        personajesClave: [
          { nombre: 'Waxillium Ladrian', rol: 'Espada de Armonía' },
          { nombre: 'Bleeder (Paalm)', rol: 'Kandra rebelde que busca liberar a Scadrial de dios' }
        ],
        conexionesCosmere: 'Primera señal de invasión por parte de una Esquirla externa no nativa de Scadrial.'
      },
      {
        id: 'bom',
        titulo: 'Brazales de Duelo',
        saga: 'Nacidos de la Bruma Era 2',
        ordenSaga: 6,
        ordenLecturaRecomendado: 15,
        totalCapitulos: 31,
        portadaColor: '#b45309',
        sinopsis: 'La expedición viaja a las montañas heladas en busca de los míticos Brazales de Duelo del Lord Legislador, descubriendo a los supervivientes enmascarados del sur de Scadrial.',
        personajesClave: [
          { nombre: 'Steris Harms', rol: 'Prometida analítica y cerebro logístico' },
          { nombre: 'Allik Jammer', rol: 'Navegante enmascarado del pueblo Malwish' }
        ],
        conexionesCosmere: 'Tecnología de aeronaves con mentes de metal sin restricción de ADN y revelación visual del Señor de las Cicatrices.'
      },
      {
        id: 'tlm',
        titulo: 'El Metal Perdido',
        saga: 'Nacidos de la Bruma Era 2',
        ordenSaga: 7,
        ordenLecturaRecomendado: 16,
        totalCapitulos: 54,
        portadaColor: '#d97706',
        sinopsis: 'La Esquirla Autonomía intenta estrellar Scadrial con una bomba de trellium. Wax, Wayne, Marasi y los Ghostbloods se unen en una batalla final desesperada por la supervivencia de su planeta.',
        personajesClave: [
          { nombre: 'Wayne', rol: 'El héroe más improbable de Scadrial' },
          { nombre: 'MeLaan', rol: 'Kandra trotamundos que parte hacia las estrellas' },
          { nombre: 'Kelsier (Thaidakar)', rol: 'Líder supremo de los Sangre de Espectro' }
        ],
        conexionesCosmere: 'Guerra interplanetaria abierta entre Autonomía y Scadrial; agentes mundiales de Roshar, Sel y Taldain operando en Elendel.'
      }
    ]
  },
  {
    id: 'sel',
    nombre: 'Sistema Selish',
    planeta: 'Sel',
    esquirlas: ['Devoción', 'Dominio'],
    colorAura: '#10b981',
    mapaTerritorial: 'Mapa de Sel: Región de Arelon con la magnífica ciudad de Elantris y Kae en el centro. Al este el imperio teocrático de Fjorden y al oeste el Imperio Rosa con la provincia de MaiPon.',
    descripcion: 'Mundo donde las Esquirlas fueron astilladas y encerradas en el Reino Cognitivo (El Dor).',
    climaYTiempo: 'Geografía dependiente del paisaje cultural; la magia está atada a la localización física.',
    faunaFlora: [
      { nombre: 'Seones (Seons)', tipo: 'fauna', desc: 'Esferas flotantes de luz con una runa central Aon que permiten comunicación y compañía.', desbloqueoLibroId: 'elantris' },
      { nombre: 'Skaze', tipo: 'fauna', desc: 'Entidades oscuras similares a los seones pero vinculadas al Dominio de Fjorden.', desbloqueoLibroId: 'elantris' }
    ],
    sistemasMagicos: [
      { nombre: 'AonDor', desc: 'Dibujo de símbolos rúnicos en el aire para canalizar la energía del Dor acumulada.', desbloqueoLibroId: 'elantris' },
      { nombre: 'Falsificación (Soul Forgery)', desc: 'Reescritura del pasado de un objeto o persona mediante sellos de alma tallados.', desbloqueoLibroId: 'soul' }
    ],
    libros: [
      {
        id: 'elantris',
        titulo: 'Elantris',
        saga: 'Sel',
        ordenSaga: 1,
        ordenLecturaRecomendado: 4,
        totalCapitulos: 63,
        portadaColor: '#059669',
        sinopsis: 'La ciudad de los dioses cayó bajo una maldición. Raoden, príncipe heredero, despierta convertido en un muerto viviente y es arrojado a las ruinas de Elantris mientras la princesa Sarene intenta salvar a su reino.',
        personajesClave: [
          { nombre: 'Raoden', rol: 'Príncipe elantriano y reformador de los malditos' },
          { nombre: 'Sarene', rol: 'Princesa de Teod y estratega política' },
          { nombre: 'Hrathen', rol: 'Gyorn fjordeniano y sacerdote devoto' }
        ],
        conexionesCosmere: 'Primera novela del Cosmere; aparición de Hoid intentando convertirse en elantriano.'
      },
      {
        id: 'soul',
        titulo: 'El Alma del Emperador',
        saga: 'Sel',
        ordenSaga: 2,
        ordenLecturaRecomendado: 4.5,
        totalCapitulos: 12,
        portadaColor: '#047857',
        esNovelaCorta: true,
        sinopsis: 'Shai, una falsificadora condenada a muerte, recibe cien días para tallar un nuevo sello de alma que reconstruya la mente y personalidad del emperador tras un atentado.',
        personajesClave: [
          { nombre: 'Wan ShaiLu', rol: 'Maestra Falsificadora' },
          { nombre: 'Gaotona', rol: 'Consejero imperial e historiador escéptico' }
        ],
        conexionesCosmere: 'La explicación filosófica más profunda sobre los tres reinos (Físico, Cognitivo, Espiritual) del Cosmere.'
      }
    ]
  },
  {
    id: 'nalthis',
    nombre: 'Sistema Nalthiano',
    planeta: 'Nalthis',
    esquirlas: ['Dotación'],
    colorAura: '#ec4899',
    mapaTerritorial: 'Mapa de Nalthis: El reino costero y tropical de Hallandren con su capital T’Telir y el Palacio de los Dioses, enfrentado a las frías montañas de Idris.',
    descripcion: 'Mundo cromáticamente saturado donde cada habitante nace con un Aliento biocromático.',
    climaYTiempo: 'Junglas exuberantes y mares cálidos. Flores de lágrimas de Edgli con tintes vivos.',
    faunaFlora: [
      { nombre: 'Lágrimas de Edgli', tipo: 'flora', desc: 'Flores endémicas de colores deslumbrantes usadas para los tintes más valiosos del universo.', desbloqueoLibroId: 'warbreaker' }
    ],
    sistemasMagicos: [
      { nombre: 'Despertar Biocromático', desc: 'Comandar objetos inanimados dándoles órdenes verbales e infundiéndoles Alientos.', desbloqueoLibroId: 'warbreaker' }
    ],
    libros: [
      {
        id: 'warbreaker',
        titulo: 'El Aliento de los Dioses (Warbreaker)',
        saga: 'Nalthis',
        ordenSaga: 1,
        ordenLecturaRecomendado: 4.8,
        totalCapitulos: 58,
        portadaColor: '#be185d',
        sinopsis: 'Dos princesas de Idris, Vivenna y Siri, son enviadas a la fastuosa corte de los Retornados en Hallandren para casarse con el temido Rey Dios Susebron.',
        personajesClave: [
          { nombre: 'Vasher (Zahel)', rol: 'Un hombre cansado con una espada negra voraz' },
          { nombre: 'Sangre de la Noche (Nightblood)', rol: 'Espada investida consciente que quiere destruir el mal' },
          { nombre: 'Susebron', rol: 'El Rey Dios mudo con miles de alientos acumulados' },
          { nombre: 'Lucero del Alba (Lightsong)', rol: 'Dios Retornado que no cree en su propia divinidad' }
        ],
        conexionesCosmere: 'Prequela espiritual del Archivo de las Tormentas: Vasher, Vivenna y Sangre de la Noche viajan posteriormente a Roshar.'
      }
    ]
  },
  {
    id: 'taldain',
    nombre: 'Sistema de Taldain',
    planeta: 'Taldain',
    esquirlas: ['Autonomía'],
    colorAura: '#eab308',
    mapaTerritorial: 'Mapa de Taldain: Planeta con bloqueo de marea. Lado Diurno con el Gran Océano de Arena de los Diem; Lado Nocturno avanzado tecnológicamente.',
    descripcion: 'Planeta dividido entre la luz solar incesante y la penumbra tecnológica perpetua.',
    climaYTiempo: 'Desiertos cálidos investidos por el sol blanco; frío en el lado oscuro.',
    faunaFlora: [
      { nombre: 'Microorganismos de la Arena', tipo: 'flora', desc: 'Bacterias fotosintéticas que recargan Investidura solar en la arena.', desbloqueoLibroId: 'whitesand' }
    ],
    sistemasMagicos: [
      { nombre: 'Maestría de la Arena', desc: 'Manipulación física y telequinética de las arenas blancas mediante la hidratación corporal.', desbloqueoLibroId: 'whitesand' }
    ],
    libros: [
      {
        id: 'whitesand',
        titulo: 'Arena Blanca (White Sand)',
        saga: 'Taldain',
        ordenSaga: 1,
        ordenLecturaRecomendado: 0,
        totalCapitulos: 30,
        portadaColor: '#ca8a04',
        sinopsis: 'Kenton, el maestro de arena más débil del Diem, sobrevive a una masacre traicionera y debe ganarse la confianza de Khrissalla, una científica del Lado Oscuro.',
        personajesClave: [
          { nombre: 'Kenton', rol: 'Lord Maestre del Diem' },
          { nombre: 'Khrissalla (Khriss)', rol: 'Científica que se convertirá en la mayor erudita del Cosmere' }
        ],
        conexionesCosmere: 'Khriss es la autora oficial de todas las notas del Arcanum Ilimitado y de los mapas del Cosmere.'
      }
    ]
  },
  {
    id: 'lumar',
    nombre: 'Sistema Lumar',
    planeta: 'Lumar',
    esquirlas: ['Ninguna (Esporas de Éteres)'],
    colorAura: '#14b8a6',
    mapaTerritorial: 'Mapa de Lumar: Doce mares inmensos compuestos de esporas de colores provenientes de doce lunas gigantescas.',
    descripcion: 'Un mundo sin océanos de agua; surcado por barcos de esporas y dragones estelares.',
    climaYTiempo: 'Mares de arena movediza vegetal que germinan con una gota de agua dulce.',
    faunaFlora: [
      { nombre: 'Esporas de Éteres', tipo: 'flora', desc: 'Polvo lunar que brota explosivamente al tocar agua (zarzas, cristales, aire).', desbloqueoLibroId: 'tress' }
    ],
    sistemasMagicos: [
      { nombre: 'Fluidos de Esporas', desc: 'Navegación mediante la aireación mecánica del suelo de esporas.', desbloqueoLibroId: 'tress' }
    ],
    libros: [
      {
        id: 'tress',
        titulo: 'Trenza del Mar Esmeralda',
        saga: 'Novelas Secretas',
        ordenSaga: 1,
        ordenLecturaRecomendado: 17,
        totalCapitulos: 65,
        portadaColor: '#0f766e',
        sinopsis: 'Trenza emprende una travesía pirata a través de mares de esporas letales para rescatar a su amado Charlie de las garras de la Hechicera del Mar de Medianoche.',
        personajesClave: [
          { nombre: 'Trenza', rol: 'Lavandera valiente convertida en capitana' },
          { nombre: 'Hoid', rol: 'Narrador de la historia y bufón afectado por una maldición elantriana' }
        ],
        conexionesCosmere: 'Aparición de dragones de Yolen, tecnología de naves espaciales scadrianas y una elantriana (la Hechicera).'
      }
    ]
  },
  {
    id: 'cantico',
    nombre: 'Sistema de Cántico',
    planeta: 'Cántico (Canticle)',
    esquirlas: ['Fragmentos de Sol / Thaidakar'],
    colorAura: '#f97316',
    mapaTerritorial: 'Mapa de Cántico: Un planeta diminuto donde las ciudades deben avanzar sobre rieles o flotar para no ser calcinadas por el amanecer.',
    descripcion: 'Planeta donde la luz solar es tan letal como energéticamente rica.',
    climaYTiempo: 'Amanecer calcinante; noche perpetua para las ciudades refugiadas en el lado umbrío.',
    faunaFlora: [
      { nombre: 'Sombras de Carbón', tipo: 'fauna', desc: 'Seres con almas alimentadas por la Investidura del sol.', desbloqueoLibroId: 'sunlit' }
    ],
    sistemasMagicos: [
      { nombre: 'Investidura Solar Cinética', desc: 'Carga de corazones térmicos para propulsión y teletransporte cósmico.', desbloqueoLibroId: 'sunlit' }
    ],
    libros: [
      {
        id: 'sunlit',
        titulo: 'El Hombre Iluminado (The Sunlit Man)',
        saga: 'Novelas Secretas',
        ordenSaga: 4,
        ordenLecturaRecomendado: 18,
        totalCapitulos: 52,
        portadaColor: '#c2410c',
        sinopsis: 'Nomad, un hombre perseguido a través de los mundos por la Brigada Nocturna, aterriza en un planeta donde la luz del amanecer calcina la piedra y la Investidura es la moneda vital.',
        personajesClave: [
          { nombre: 'Nomad (Sigzil)', rol: 'Antiguo escudero del Puente Cuatro y Portador de una Esquirla del Amanecer' },
          { nombre: 'Auxiliar', rol: 'Esprec muerto convertido en armadura' }
        ],
        conexionesCosmere: 'Futuro lejano del Cosmere (Era Espacial): Conexión directa con Roshar, Scadrial y los Sangre de Espectro.'
      }
    ]
  }
];