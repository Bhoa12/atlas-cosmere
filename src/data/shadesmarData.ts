export interface UbicacionCognitiva {
  id: string;
  nombre: string;
  equivalenteFisico: string;
  tipoTerreno: 'Mar de Cuentas' | 'Tierra Firme de Obsidiana' | 'Ciudad de Esprecs';
  gobernantes: string;
  descripcion: string;
  peligro: string;
}

export const UBICACIONES_SHADESMAR: UbicacionCognitiva[] = [
  {
    id: 'celebrant',
    nombre: 'Ciudad Libre de Celebrant',
    equivalenteFisico: 'Bajo el Mar de Cejas (Roshar)',
    tipoTerreno: 'Ciudad de Esprecs',
    gobernantes: 'Consejo mixto de Criptics e Honorspren',
    descripcion: 'Población cosmopolita flotante donde humanos, trotamundos y spren comercian con perlas de pensamiento y fabriales.',
    peligro: 'Contrabando de los Sangre de Espectro y patrullas de Fusionados.'
  },
  {
    id: 'mar_rosharano',
    nombre: 'El Mar de Cuentas de Vidrio',
    equivalenteFisico: 'Supercontinente de Roshar',
    tipoTerreno: 'Mar de Cuentas',
    gobernantes: 'Gobernanza marítima de barcos spren',
    descripcion: 'Un océano interminable de millones de esferas de vidrio. Cada cuenta es la manifestación cognitiva de un objeto del mundo físico.',
    peligro: 'Si un humano cae al mar de cuentas sin apoyo, se hunde entre los pensamientos de la materia y muere asfixiado.'
  },
  {
    id: 'silverlight',
    nombre: 'Metrópolis Estelar de Silverlight',
    equivalenteFisico: 'Espacio cognitivo neutral profundo',
    tipoTerreno: 'Tierra Firme de Obsidiana',
    gobernantes: 'Eruditos y Universidades de Silverlight (Khriss)',
    descripcion: 'La mayor civilización trotamundos construida sobre tierra artificial en el Reino Cognitivo, protegida por árboles de luz investida.',
    peligro: 'Espías interplanetarios y control de aduanas de Investidura.'
  }
];

export interface CuentaMoldearAlmas {
  material: string;
  esencia: string;
  dificultadPersuasion: string;
  argumentoCanonica: string;
}

export const ESENCIAS_MOLDEAR_ALMAS: CuentaMoldearAlmas[] = [
  { material: 'Palo / Madera', esencia: 'Tallow / Celulosa', dificultadPersuasion: 'Media', argumentoCanonica: '«Soy un palo». Debes ofrecerle calor o propósito para convencerlo de convertirse en fuego.' },
  { material: 'Piedra / Roca', esencia: 'Talus', dificultadPersuasion: 'Alta', argumentoCanonica: 'La piedra es terca y vieja. Solo cede si le prometes una forma más digna (ej. sangre pura o grano alimenticio).' },
  { material: 'Aire / Vapor', esencia: 'Vapor', dificultadPersuasion: 'Baja', argumentoCanonica: 'El aire es voluble y curioso; acepta transformarse casi sin resistencia si se le infunde Luz Tormentosa.' }
];