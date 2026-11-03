export interface TerminoFonetico {
  termino: string;
  foneticaEspanol: string;
  ipa: string;
  origen: string;
  significado: string;
}

export const DICCIONARIO_FONETICO: TerminoFonetico[] = [
  {
    termino: 'Numuhukumakiaki\'aialunamor',
    foneticaEspanol: 'Nu-mu-ju-ku-ma-ki-a-ki-ai-a-lu-na-mor (Apodo: "Roca")',
    ipa: '/nuːmuːhuːkuːmɑːkiːaɪɑːluːnɑːmɔːr/',
    origen: 'Roshar (Picos de los Comecuernos)',
    significado: 'Nombre verdadero del cocinero de Roca, nombrado en honor a una montaña sagrada.'
  },
  {
    termino: 'Szeth-hijo-hijo-Vallano',
    foneticaEspanol: 'Set-hijo-hijo-Va-llá-no',
    ipa: '/zɛθ/',
    origen: 'Roshar (Shinovar)',
    significado: 'El Asesino de Blanco. En Shinovar, omitir el nombre del padre indica degradación criminal.'
  },
  {
    termino: 'Kelsier',
    foneticaEspanol: 'Kél-si-er (o Kel-sié en pronunciación scandriana clásica)',
    ipa: '/ˈkɛlsiər/',
    origen: 'Scadrial',
    significado: 'El Superviviente de Hathsin.'
  },
  {
    termino: 'AonDor',
    foneticaEspanol: 'Éi-on-Dor',
    ipa: '/ˈeɪ.ɒn dɔːr/',
    origen: 'Sel',
    significado: 'Canalización rúnica del Dor mediante símbolos luminosos Aon.'
  },
  {
    termino: 'Sazed',
    foneticaEspanol: 'Séi-zed',
    ipa: '/ˈseɪzɪd/',
    origen: 'Scadrial (Terris)',
    significado: 'Guardián terrisano y eventual Vaso de Armonía.'
  }
];