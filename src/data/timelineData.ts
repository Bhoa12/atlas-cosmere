export interface EventoTemporal {
  id: string;
  anoAproximado: string;
  era: string;
  eventoRoshar: string;
  eventoScadrial: string;
  eventoOtrosMundos: string;
  esquirlaRelevante: string;
}

export const CRONOLOGIA_COSMERE: EventoTemporal[] = [
  {
    id: 'e0',
    anoAproximado: '~ 10.000 antes del Catacendre',
    era: 'Era Primordial',
    eventoRoshar: 'Los oyentes habitan Roshar con esprecs primitivos.',
    eventoScadrial: 'Scadrial aún no ha sido creado físicamente.',
    eventoOtrosMundos: 'Fragmentación de Adonalsium en Yolen por dieciséis conspiradores.',
    esquirlaRelevante: 'Adonalsium se divide en 16 Esquirlas divinas.'
  },
  {
    id: 'e1',
    anoAproximado: '~ 1000 antes del Catacendre',
    era: 'Era Clásica Antigua',
    eventoRoshar: 'Época de los Desolaciones y traición de los Heraldos (Aharietiam).',
    eventoScadrial: 'Rashek toma el Pozo de la Ascensión, mueve el planeta y crea el Imperio Final.',
    eventoOtrosMundos: 'Devoción y Dominio son astilladas por Odium en Sel (creación del Dor).',
    esquirlaRelevante: 'Conservación y Ruina sellan su pacto en Scadrial.'
  },
  {
    id: 'e2',
    anoAproximado: 'Año 0 (Catacendre)',
    era: 'El Renacer de la Bruma',
    eventoRoshar: 'Dalinar Kholin es un guerrero implacable unificando Alezkar.',
    eventoScadrial: 'Vin mata al Lord Legislador. Sazed fusiona Ruina y Conservación en Armonía.',
    eventoOtrosMundos: 'Guerra del Ajuste en Nalthis (Vasher crea a Sangre de la Noche).',
    esquirlaRelevante: 'Ruina y Conservación unidas en Armonía.'
  },
  {
    id: 'e3',
    anoAproximado: 'Año 340 después del Catacendre',
    era: 'Era de las Tormentas e Industria',
    eventoRoshar: 'Retorno de los Fusionados; despertar de la Tormenta Eterna (Archivo 1-5).',
    eventoScadrial: 'Wax & Wayne defienden Elendel del complot de Autonomía (Era 2).',
    eventoOtrosMundos: 'Khriss y Nazh cartografían Shadesmar desde Silverlight.',
    esquirlaRelevante: 'Odium cambia de Vaso; Autonomía amenaza Scadrial.'
  },
  {
    id: 'e4',
    anoAproximado: 'Futuro Cósmico (Era Espacial)',
    era: 'Era Espacial del Cosmere',
    eventoRoshar: 'Tecnología de fabriales cuánticos y naves impulsadas por Luz Tormentosa.',
    eventoScadrial: 'Metrópolis cibernéticas e imperio interestelar con naves alománticas.',
    eventoOtrosMundos: 'Nomad huye de la Brigada Nocturna en Cántico; Trenza surca mares de esporas.',
    esquirlaRelevante: 'Guerra fría a escala galáctica entre Esquirlas supervivientes.'
  }
];