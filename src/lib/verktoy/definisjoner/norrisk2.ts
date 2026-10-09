import type { Terskel, Verktoy } from "../typer"

/**
 * NORRISK 2 — 10-årsrisiko for fatalt og ikke-fatalt hjerteinfarkt eller
 * hjerneslag, til bruk sammen med nasjonal faglig retningslinje for individuell
 * primærforebygging av hjerte- og karsykdommer.
 *
 * Første verktøy med `beregning: { type: "formel" }`. Selve modellen ligger i
 * `formler.ts`; her er bare inndataskjemaet og tolkningstabellen.
 *
 * Risikogrensene er **aldersbåndede**: 9 % er lav risiko hos en 70-åring og høy
 * hos en 50-åring. Det uttrykkes med `betingelse` på hver terskel.
 */

const KILDE_URL = "https://hjerterisiko.helsedirektoratet.no/"

/** Tre kategorier per aldersbånd, med kildens egne grenser. */
function band(
  fra: number,
  til: number,
  grenser: { lav: number; middels: number }
): Terskel[] {
  const betingelse = { felt: "alder", min: fra, maks: til }
  const alder = `${fra}–${til} år`
  return [
    {
      fra: 0,
      til: grenser.lav,
      klasse: "Lav risiko",
      tekst: `Beregnet 10-årsrisiko under ${grenser.lav} % regnes som lav i aldersgruppen ${alder}`,
      farge: "gronn",
      betingelse,
    },
    {
      fra: grenser.lav,
      til: grenser.middels,
      klasse: "Middels risiko",
      tekst: `Beregnet 10-årsrisiko mellom ${grenser.lav} og ${grenser.middels} % regnes som middels i aldersgruppen ${alder}`,
      farge: "gul",
      betingelse,
    },
    {
      fra: grenser.middels,
      til: 1000,
      klasse: "Høy risiko",
      tekst: `Beregnet 10-årsrisiko på ${grenser.middels} % eller mer regnes som høy i aldersgruppen ${alder}`,
      farge: "rod",
      betingelse,
    },
  ]
}

export const NORRISK2: Verktoy = {
  id: "norrisk2",
  navn: "NORRISK 2",
  langtNavn: "10-årsrisiko for hjerteinfarkt eller hjerneslag",
  kategori: "kalkulator",
  fagomrader: ["hjerte_kar"],
  sokeord: [
    "norrisk",
    "norrisk2",
    "hjerterisiko",
    "kardiovaskulær risiko",
    "risikoskår",
    "statin",
    "kolesterol",
    "primærforebygging",
    "hjerte- og karsykdom",
    "hjerteinfarkt",
    "hjerneslag",
  ],
  notatTittel: "NORRISK 2",
  beregning: { type: "formel", formelId: "norrisk2", desimaler: 1 },
  sumEtikett: "% 10-årsrisiko",
  detaljStil: "uten_poeng",
  veiledning: {
    tittel: "NORRISK 2 — bruk og tilleggsfaktorer",
    blokker: [
      {
        type: "avsnitt",
        tekst:
          "Beregning av 10-årsrisiko for fatalt og ikke-fatalt hjerteinfarkt eller hjerneslag. Til bruk sammen med nasjonal faglig retningslinje for individuell primærforebygging av hjerte- og karsykdommer.",
      },
      { type: "overskrift", tekst: "Validert inndataområde" },
      {
        type: "avsnitt",
        tekst:
          "Modellen er tilpasset alder 45–74 år, systolisk blodtrykk 120–160 mmHg og totalkolesterol 4–8 mmol/l. Utenfor disse grensene regner appen ingen risiko, i stedet for å ekstrapolere en modell som ikke er validert der.",
      },
      { type: "overskrift", tekst: "Risikogrenser per aldersgruppe" },
      {
        type: "tabell",
        kolonner: ["Alder", "Lav", "Middels", "Høy"],
        rader: [
          ["45–54 år", "under 4 %", "4–5 %", "5 % eller mer"],
          ["55–64 år", "under 8 %", "8–10 %", "10 % eller mer"],
          ["65–74 år", "under 12 %", "12–15 %", "15 % eller mer"],
        ],
      },
      { type: "overskrift", tekst: "Tilleggsfaktorer" },
      {
        type: "avsnitt",
        tekst:
          "Følgende faktorer inngår ikke i risikomodellen, men Helsedirektoratet oppgir dem som forhold legen skal vekte i totalvurderingen. Appen regner dem ikke inn i prosenten.",
      },
      {
        type: "tabell",
        kolonner: ["Faktor", "Foreslått multiplikasjonsfaktor"],
        rader: [
          ["Sørasiatisk etnisitet", "× 1,5"],
          ["Revmatoid artritt", "× 1,4"],
          ["Abdominal fedme (menn > 100 cm, kvinner > 88 cm)", "—"],
          ["Psykososial belastning og stress", "—"],
        ],
      },
    ],
  },
  seksjoner: [
    {
      id: "person",
      tittel: "Pasient",
      felter: [
        {
          type: "valg",
          id: "kjonn",
          sporsmal: "Kjønn",
          kort: "kjønn",
          alternativer: [
            { tekst: "Kvinne", poeng: 0 },
            { tekst: "Mann", poeng: 0 },
          ],
        },
        {
          type: "tall",
          id: "alder",
          sporsmal: "Alder",
          kort: "alder",
          enhet: "år",
          min: 45,
          max: 74,
          hjelp: "Modellen er validert for 45–74 år.",
        },
      ],
    },
    {
      id: "malinger",
      tittel: "Målinger",
      felter: [
        {
          type: "tall",
          id: "systolisk",
          sporsmal: "Systolisk blodtrykk",
          kort: "systolisk BT",
          enhet: "mmHg",
          min: 120,
          max: 160,
          hjelp: "Modellen er validert for 120–160 mmHg.",
        },
        {
          type: "tall",
          id: "kolesterol",
          sporsmal: "Totalkolesterol",
          kort: "totalkolesterol",
          enhet: "mmol/l",
          min: 4,
          max: 8,
          hjelp: "Modellen er validert for 4–8 mmol/l.",
        },
        {
          type: "ja_nei",
          id: "lavtHdl",
          sporsmal: "Lavt HDL-kolesterol",
          kort: "lavt HDL",
          poeng: 0,
          hjelp: "Menn under 1,0 mmol/l. Kvinner under 1,3 mmol/l.",
        },
      ],
    },
    {
      id: "risikofaktorer",
      tittel: "Risikofaktorer",
      felter: [
        {
          type: "ja_nei",
          id: "royking",
          sporsmal: "Røyker",
          kort: "røyker",
          poeng: 0,
        },
        {
          type: "ja_nei",
          id: "btBehandling",
          sporsmal: "Legemiddelbehandlet hypertensjon",
          kort: "behandlet hypertensjon",
          poeng: 0,
        },
        {
          type: "valg",
          id: "slektninger",
          sporsmal: "Førstegradsslektninger med hjerteinfarkt før 60 år",
          kort: "slektninger med tidlig infarkt",
          alternativer: [
            { tekst: "Ingen", poeng: 0 },
            { tekst: "1", poeng: 0 },
            { tekst: "2 eller flere", poeng: 0 },
          ],
        },
      ],
    },
  ],
  terskler: [
    ...band(45, 54, { lav: 4, middels: 5 }),
    ...band(55, 64, { lav: 8, middels: 10 }),
    ...band(65, 74, { lav: 12, middels: 15 }),
  ],
  kilde: {
    navn: "NORRISK 2, Helsedirektoratet",
    url: KILDE_URL,
    sistRevidert: "2017",
  },
  /**
   * Referansekasus hentet fra Helsedirektoratets egen kalkulator. Selvtesten
   * kjører dem ved hver endring, så et avvik fanges i utviklingsløpet — også
   * hvis modellen der oppdateres.
   */
  testkasus: [
    {
      navn: "Kvinne 50 år, ingen risikofaktorer",
      svar: { kjonn: 0, alder: 50, systolisk: 120, kolesterol: 5, slektninger: 0 },
      forventetSum: 0.9,
      forventetKlasse: "Lav risiko",
    },
    {
      navn: "Kvinne 60 år, røyker",
      svar: { kjonn: 0, alder: 60, systolisk: 140, kolesterol: 6, royking: true, slektninger: 0 },
      forventetSum: 7.9,
      forventetKlasse: "Lav risiko",
    },
    {
      navn: "Kvinne 70 år, alle risikofaktorer",
      svar: {
        kjonn: 0,
        alder: 70,
        systolisk: 160,
        kolesterol: 7,
        royking: true,
        btBehandling: true,
        lavtHdl: true,
        slektninger: 2,
      },
      forventetSum: 44.6,
      forventetKlasse: "Høy risiko",
    },
    {
      navn: "Mann 45 år, ingen risikofaktorer",
      svar: { kjonn: 1, alder: 45, systolisk: 120, kolesterol: 4, slektninger: 0 },
      forventetSum: 0.9,
      forventetKlasse: "Lav risiko",
    },
    {
      navn: "Mann 55 år, ingen risikofaktorer",
      svar: { kjonn: 1, alder: 55, systolisk: 140, kolesterol: 6, slektninger: 0 },
      forventetSum: 5.5,
      forventetKlasse: "Lav risiko",
    },
    {
      navn: "Mann 60 år, røyker — samme prosent, annen aldersgruppe",
      svar: { kjonn: 1, alder: 60, systolisk: 140, kolesterol: 6, royking: true, slektninger: 0 },
      forventetSum: 12.7,
      forventetKlasse: "Høy risiko",
    },
    {
      navn: "Mann 65 år, behandlet hypertensjon og lavt HDL",
      svar: {
        kjonn: 1,
        alder: 65,
        systolisk: 150,
        kolesterol: 7,
        btBehandling: true,
        lavtHdl: true,
        slektninger: 1,
      },
      forventetSum: 30.7,
      forventetKlasse: "Høy risiko",
    },
    {
      navn: "Mann 74 år, alle risikofaktorer",
      svar: {
        kjonn: 1,
        alder: 74,
        systolisk: 160,
        kolesterol: 8,
        royking: true,
        btBehandling: true,
        lavtHdl: true,
        slektninger: 2,
      },
      forventetSum: 66.4,
      forventetKlasse: "Høy risiko",
    },
  ],
  opphav: "innebygd",
}
