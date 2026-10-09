import type { Verktoy } from "../typer"

export const QSOFA: Verktoy = {
  id: "qsofa",
  navn: "qSOFA",
  langtNavn: "Rask vurdering av organsvikt ved mistenkt infeksjon",
  kategori: "score",
  fagomrader: ["akutt"],
  sokeord: [
    "sepsis",
    "infeksjon",
    "qsofa",
    "sofa",
    "organsvikt",
    "feber",
    "alvorlig infeksjon",
    "septisk",
  ],
  notatTittel: "qSOFA",
  beregning: { type: "sum" },
  seksjoner: [
    {
      id: "kriterier",
      tittel: "Kriterier",
      maksPoeng: 3,
      felter: [
        {
          type: "ja_nei",
          id: "respirasjonsfrekvens",
          sporsmal: "Respirasjonsfrekvens 22/min eller høyere",
          kort: "respirasjonsfrekvens ≥22",
          poeng: 1,
        },
        {
          type: "ja_nei",
          id: "mental",
          sporsmal: "Endret mental status",
          kort: "endret mental status",
          poeng: 1,
          hjelp: "Glasgow Coma Scale under 15.",
        },
        {
          type: "ja_nei",
          id: "systolisk",
          sporsmal: "Systolisk blodtrykk 100 mmHg eller lavere",
          kort: "systolisk BT ≤100",
          poeng: 1,
        },
      ],
    },
  ],
  terskler: [
    {
      fra: 0,
      til: 1,
      klasse: "Ikke forhøyet",
      tekst: "Ikke forhøyet risiko for dårlig utfall etter qSOFA-kriteriene",
      farge: "gronn",
    },
    {
      fra: 2,
      til: 3,
      klasse: "Forhøyet risiko",
      tekst:
        "To eller flere kriterier er forbundet med økt risiko for død og forlenget intensivopphold ved mistenkt infeksjon",
      farge: "rod",
    },
  ],
  kilde: {
    navn: "Sepsis-3 (JAMA)",
    versjon: "2016",
    sistRevidert: "2016",
  },
  testkasus: [
    {
      navn: "Ingen kriterier oppfylt",
      svar: {},
      forventetSum: 0,
    },
    {
      navn: "Takypné og hypotensjon",
      svar: { respirasjonsfrekvens: true, systolisk: true },
      forventetSum: 2,
    },
    {
      navn: "Alle tre kriterier",
      svar: { respirasjonsfrekvens: true, mental: true, systolisk: true },
      forventetSum: 3,
    },
  ],
  opphav: "innebygd",
}
