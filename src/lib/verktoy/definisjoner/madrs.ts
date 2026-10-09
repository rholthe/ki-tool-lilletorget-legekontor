import type { Alternativ, Verktoy } from "../typer"

/**
 * MADRS skåres 0–6 per ledd. Kun partallene har definerte forankringspunkter;
 * oddetallene er mellomliggende verdier legen setter ved skjønn.
 */
function ledd(
  forankring: [string, string, string, string]
): Alternativ[] {
  const [null_, to, fire, seks] = forankring
  return [
    { tekst: "0", poeng: 0, kriterium: null_ },
    { tekst: "1", poeng: 1, kriterium: "Mellomliggende" },
    { tekst: "2", poeng: 2, kriterium: to },
    { tekst: "3", poeng: 3, kriterium: "Mellomliggende" },
    { tekst: "4", poeng: 4, kriterium: fire },
    { tekst: "5", poeng: 5, kriterium: "Mellomliggende" },
    { tekst: "6", poeng: 6, kriterium: seks },
  ]
}

export const MADRS: Verktoy = {
  id: "madrs",
  navn: "MADRS",
  langtNavn: "Alvorlighetsgrad av depresjon",
  kategori: "score",
  fagomrader: ["psykisk_helse"],
  sokeord: [
    "depresjon",
    "deprimert",
    "nedstemt",
    "madrs",
    "stemningsleie",
    "tungsinn",
    "selvmordstanker",
    "suicidal",
    "angst",
    "psykisk helse",
  ],
  notatTittel: "MADRS",
  beregning: { type: "sum" },
  // Ti ledd med hver sin alternativtekst ville gitt en avsnittslang notatlinje
  detaljStil: "poeng",
  seksjoner: [
    {
      id: "ledd",
      tittel: "Ledd",
      maksPoeng: 60,
      felter: [
        {
          type: "valg",
          id: "synlig-tristhet",
          sporsmal: "1. Synlig tristhet",
          kort: "synlig tristhet",
          hjelp: "Observert nedstemthet i mimikk, holdning og tale.",
          alternativer: ledd([
            "Ingen tristhet",
            "Ser nedstemt ut, men lysner uten vansker",
            "Virker nedstemt og ulykkelig mesteparten av tiden",
            "Gjennomgående uttrykk for tungsinn og fortvilelse",
          ]),
        },
        {
          type: "valg",
          id: "rapportert-tristhet",
          sporsmal: "2. Rapportert tristhet",
          kort: "rapportert tristhet",
          alternativer: ledd([
            "Stemningsleiet veksler i takt med omstendighetene",
            "Trist eller nedfor, men lysner uten vansker",
            "Gjennomgående følelse av tristhet; stemningsleiet påvirkes lite av ytre hendelser",
            "Vedvarende og uforanderlig tungsinn og motløshet",
          ]),
        },
        {
          type: "valg",
          id: "indre-spenning",
          sporsmal: "3. Indre spenning",
          kort: "indre spenning",
          alternativer: ledd([
            "Rolig, kun flyktig indre uro",
            "Tidvis følelse av irritabilitet og indre uro",
            "Vedvarende indre uro eller periodisk angst som krever anstrengelse å mestre",
            "Vedvarende gru eller angst; overveldende panikk",
          ]),
        },
        {
          type: "valg",
          id: "redusert-sovn",
          sporsmal: "4. Redusert søvn",
          kort: "redusert søvn",
          alternativer: ledd([
            "Sover som vanlig",
            "Lette innsovningsvansker eller noe forkortet, lett eller urolig søvn",
            "Søvnen redusert eller avbrutt i minst to timer",
            "Mindre enn to til tre timers søvn",
          ]),
        },
        {
          type: "valg",
          id: "redusert-appetitt",
          sporsmal: "5. Redusert appetitt",
          kort: "redusert appetitt",
          alternativer: ledd([
            "Normal eller økt appetitt",
            "Noe redusert appetitt",
            "Ingen appetitt; maten smaker ingenting",
            "Må overtales til å spise",
          ]),
        },
        {
          type: "valg",
          id: "konsentrasjonsvansker",
          sporsmal: "6. Konsentrasjonsvansker",
          kort: "konsentrasjonsvansker",
          alternativer: ledd([
            "Ingen konsentrasjonsvansker",
            "Tidvis vansker med å samle tankene",
            "Vansker med å konsentrere seg og holde fast ved en tanke, med redusert evne til å lese eller samtale",
            "Ute av stand til å lese eller samtale uten store vansker",
          ]),
        },
        {
          type: "valg",
          id: "initiativlosthet",
          sporsmal: "7. Initiativløshet",
          kort: "initiativløshet",
          alternativer: ledd([
            "Nesten ingen vansker med å komme i gang; ingen treghet",
            "Vansker med å komme i gang med aktiviteter",
            "Vansker med å begynne på enkle rutineaktiviteter; krever anstrengelse",
            "Fullstendig initiativløshet; klarer ingenting uten hjelp",
          ]),
        },
        {
          type: "valg",
          id: "manglende-folelse",
          sporsmal: "8. Manglende evne til å føle",
          kort: "manglende evne til å føle",
          alternativer: ledd([
            "Normal interesse for omgivelsene og andre mennesker",
            "Redusert evne til å glede seg over det som vanligvis interesserer",
            "Tap av interesse for omgivelsene; reduserte følelser for venner og bekjente",
            "Følelsen av å være følelsesmessig lammet; ute av stand til å føle sinne, sorg eller glede",
          ]),
        },
        {
          type: "valg",
          id: "pessimistiske-tanker",
          sporsmal: "9. Pessimistiske tanker",
          kort: "pessimistiske tanker",
          alternativer: ledd([
            "Ingen pessimistiske tanker",
            "Vekslende selvbebreidelser og følelse av mindreverd",
            "Vedvarende selvbebreidelser eller bestemte, men fornuftsbaserte skyldfølelser; økende pessimisme om framtiden",
            "Vrangforestillinger om undergang, anger eller ubotelig synd; absurde og urokkelige selvanklager",
          ]),
        },
        {
          type: "valg",
          id: "selvmordstanker",
          sporsmal: "10. Selvmordstanker",
          kort: "selvmordstanker",
          hjelp: "Skår 4 og høyere krever egen klinisk vurdering av selvmordsrisiko.",
          alternativer: ledd([
            "Livsglede eller nøytralt",
            "Livstrett; kun flyktige selvmordstanker",
            "Tanker om at det ville vært bedre å være død; selvmordstanker er vanlige og betraktes som en mulig løsning, men uten konkrete planer",
            "Konkrete planer om selvmord når anledningen byr seg; aktive forberedelser",
          ]),
        },
      ],
    },
  ],
  terskler: [
    {
      fra: 0,
      til: 6,
      klasse: "Ingen depresjon",
      tekst: "Skår i området uten depressive symptomer",
      farge: "gronn",
    },
    {
      fra: 7,
      til: 19,
      klasse: "Mild depresjon",
      tekst: "Skår forenlig med mild depresjon",
      farge: "gul",
    },
    {
      fra: 20,
      til: 34,
      klasse: "Moderat depresjon",
      tekst: "Skår forenlig med moderat depresjon",
      farge: "rod",
    },
    {
      fra: 35,
      til: 60,
      klasse: "Alvorlig depresjon",
      tekst: "Skår forenlig med alvorlig depresjon",
      farge: "rod",
    },
  ],
  kilde: {
    navn: "Montgomery og Åsberg (MADRS), gradering etter Snaith",
    versjon: "1979/1986",
    sistRevidert: "1986",
  },
  testkasus: [
    {
      navn: "Alle ledd skåret 0",
      svar: {
        "synlig-tristhet": 0,
        "rapportert-tristhet": 0,
        "indre-spenning": 0,
        "redusert-sovn": 0,
        "redusert-appetitt": 0,
        konsentrasjonsvansker: 0,
        initiativlosthet: 0,
        "manglende-folelse": 0,
        "pessimistiske-tanker": 0,
        selvmordstanker: 0,
      },
      forventetSum: 0,
    },
    {
      navn: "Alle ledd skåret 6 (maksimal skår)",
      svar: {
        "synlig-tristhet": 6,
        "rapportert-tristhet": 6,
        "indre-spenning": 6,
        "redusert-sovn": 6,
        "redusert-appetitt": 6,
        konsentrasjonsvansker: 6,
        initiativlosthet: 6,
        "manglende-folelse": 6,
        "pessimistiske-tanker": 6,
        selvmordstanker: 6,
      },
      forventetSum: 60,
    },
    {
      navn: "Moderat depresjon",
      svar: {
        "synlig-tristhet": 2,
        "rapportert-tristhet": 3,
        "indre-spenning": 2,
        "redusert-sovn": 2,
        "redusert-appetitt": 1,
        konsentrasjonsvansker: 3,
        initiativlosthet: 3,
        "manglende-folelse": 2,
        "pessimistiske-tanker": 3,
        selvmordstanker: 1,
      },
      forventetSum: 22,
    },
  ],
  opphav: "innebygd",
}
