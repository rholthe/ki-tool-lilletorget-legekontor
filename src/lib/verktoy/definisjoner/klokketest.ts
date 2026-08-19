import type { Verktoy } from "../typer"

/**
 * Shulmans klokketest graderes 1–6, der høyere verdi betyr større svikt — motsatt
 * vei av de øvrige skåringsverktøyene. Skår 3 og høyere regnes som patologisk.
 */
export const KLOKKETEST: Verktoy = {
  id: "klokketest",
  navn: "Klokketest",
  langtNavn: "Visuospatial og eksekutiv funksjon (Shulman)",
  kategori: "score",
  sokeord: [
    "klokketest",
    "kognitiv svikt",
    "demens",
    "hukommelse",
    "glemsom",
    "kognisjon",
    "shulman",
    "mmse",
    "utredning kognitiv",
  ],
  notatTittel: "Klokketest (Shulman)",
  beregning: { type: "sum" },
  // Ett vurderingsledd — poenget står allerede i summen, så notatet trenger bare teksten
  detaljStil: "tekst",
  sumEtikett: "på Shulman-skalaen",
  seksjoner: [
    {
      id: "vurdering",
      tittel: "Vurdering",
      felter: [
        {
          type: "valg",
          id: "nivaa",
          sporsmal: "Vurdering av tegningen",
          kort: "vurdering",
          hjelp:
            "Pasienten tegner en urskive med alle tall og setter viserne til ti over elleve. Høyere skår betyr større svikt.",
          alternativer: [
            {
              tekst: "Perfekt klokke",
              poeng: 1,
              kriterium: "Riktige tall og visere, ingen feil",
            },
            {
              tekst: "Lette visuospatiale feil",
              poeng: 2,
              kriterium:
                "For eksempel ujevn avstand mellom tallene eller tall utenfor sirkelen, men klokken er ellers riktig",
            },
            {
              tekst: "Feil klokkeslett ved bevart visuospatial organisering",
              poeng: 3,
              kriterium: "Tallene står riktig plassert, men viserne viser ikke ti over elleve",
            },
            {
              tekst: "Moderat visuospatial desorganisering",
              poeng: 4,
              kriterium:
                "Ujevn avstand, manglende tall, ingen visere eller tall utenfor sirkelen — klokkeslettet kan ikke leses",
            },
            {
              tekst: "Alvorlig visuospatial desorganisering",
              poeng: 5,
              kriterium: "Tallene er spredt eller gjentatt, urskiven er ikke gjenkjennelig",
            },
            {
              tekst: "Ingen gjenkjennelig gjengivelse av en klokke",
              poeng: 6,
              kriterium: "Ingen meningsfylt tegning, eller pasienten klarer ikke å forsøke",
            },
          ],
        },
      ],
    },
  ],
  terskler: [
    {
      fra: 1,
      til: 2,
      klasse: "Normal",
      tekst: "Innenfor normalområdet etter Shulmans gradering",
      farge: "gronn",
    },
    {
      fra: 3,
      til: 6,
      klasse: "Patologisk",
      tekst:
        "Skår 3 eller høyere regnes som patologisk og gir grunnlag for videre kognitiv utredning",
      farge: "rod",
    },
  ],
  kilde: {
    navn: "Shulman, klokketest med 6-punkts gradering",
    versjon: "1993",
    sistRevidert: "1993",
  },
  testkasus: [
    { navn: "Perfekt klokke", svar: { nivaa: 0 }, forventetSum: 1 },
    { navn: "Lette visuospatiale feil", svar: { nivaa: 1 }, forventetSum: 2 },
    { navn: "Moderat desorganisering", svar: { nivaa: 3 }, forventetSum: 4 },
    { navn: "Ingen gjenkjennelig klokke", svar: { nivaa: 5 }, forventetSum: 6 },
  ],
  opphav: "innebygd",
}
