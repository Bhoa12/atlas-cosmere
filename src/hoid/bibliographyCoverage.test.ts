import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";

describe("Hoid source catalog coverage", () => {
  it("keeps the verified supplied bibliography complete without storing source prose", () => {
    const cosmere = HOID_SOURCE_BIBLIOGRAPHY
      .filter(source => source.sourceGroup === "cosmere.epub")
      .map(source => source.title);
    const roshar = HOID_SOURCE_BIBLIOGRAPHY
      .filter(source => source.sourceGroup === "roshar-epubs")
      .map(source => source.title);

    expect(cosmere).toHaveLength(17);
    expect(cosmere).toEqual(expect.arrayContaining([
      "El Imperio Final",
      "El Pozo de la Ascensión",
      "El Héroe de las Eras",
      "Aleación de ley",
      "Sombras de identidad",
      "Brazales de Duelo",
      "El metal perdido",
      "El aliento de los dioses",
      "Elantris",
      "Arena blanca vol. 1",
      "Arena blanca vol. 2",
      "Arena blanca vol. 3",
      "Trenza del mar Esmeralda",
      "Yumi y el pintor de pesadillas",
      "El Hombre Iluminado",
      "Islas de la ascuaoscura",
      "Arcanum ilimitado",
    ]));

    expect(roshar).toHaveLength(7);
    expect(roshar).toEqual(expect.arrayContaining([
      "El Camino de los Reyes",
      "Palabras radiantes",
      "Juramentada",
      "El Ritmo de la Guerra",
      "Viento y Verdad",
      "Danzante del Filo",
      "Esquirla del amanecer",
    ]));

    expect(HOID_SOURCE_BIBLIOGRAPHY).toHaveLength(24);
  });
});
