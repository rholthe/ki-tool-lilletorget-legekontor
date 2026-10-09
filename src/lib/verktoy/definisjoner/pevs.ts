import type { Veiledning, Verktoy } from "../typer"

/**
 * PEVS — Pediatric Early Warning Score.
 *
 * Skåren avhenger av barnets alder: kriteriene er formulert som avvik fra
 * normalverdi («≥ 10 over normalverdi»), og normalverdien slås opp i tabellen
 * under. Aldersgruppen er derfor et eget felt, og normalverdiene ligger både som
 * `kriterium` på hvert alternativ og i veiledningen.
 *
 * Alle tekster er gjengitt fra metodeboken ved Asker og Bærum legevakt.
 */

const NORMALVERDIER = {
  type: "tabell" as const,
  kolonner: ["Alder", "Respirasjonsfrekvens", "Puls i hvile", "Systolisk BT", "Diastolisk BT"],
  rader: [
    ["Nyfødt, under 1 mnd", "40–55", "100–160", "65–95", "35–55"],
    ["1 mnd – under 13 mnd", "35–45", "100–160", "75–100", "40–55"],
    ["13 mnd – under 4 år", "25–35", "90–130", "80–105", "40–60"],
    ["4 år – under 7 år", "20–24", "70–120", "85–110", "45–70"],
    ["7 år – under 13 år", "19–22", "70–110", "95–115", "50–75"],
    ["13 år – 18 år", "14–19", "55–95", "105–125", "50–80"],
  ],
  fotnote:
    "Blodtrykk inngår ikke i PEVS. BT-verdiene er 10–90-percentiler og må tolkes i lys av dette.",
}

const ALDER_VEILEDNING: Veiledning = {
  tittel: "Normalverdier per aldersgruppe",
  blokker: [
    {
      type: "avsnitt",
      tekst:
        "Man differensierer ikke mellom aldre innenfor hver alderskategori — referanseområdene gjelder på samme måte enten barnet er 13 måneder eller 3 år. Et barn på 13 måneder plasseres altså ikke i øvre del av referanseområdet; poeng gis kun når verdiene er over eller under referanseverdien. Endringer innenfor referanseverdiene gir ikke poeng.",
    },
    NORMALVERDIER,
  ],
}

const RESPIRASJON_VEILEDNING: Veiledning = {
  tittel: "A Luftveier og B Respirasjon",
  blokker: [
    { type: "overskrift", tekst: "A Luftveier" },
    {
      type: "punkter",
      punkter: ["Respirasjonen skal telles i 1 minutt mens barnet er i hvile."],
    },
    { type: "overskrift", tekst: "B Respirasjon" },
    {
      type: "punkter",
      punkter: [
        "Costale, subcostale og intercostale inndragninger gir 1 poeng.",
        "Jugulære inndragninger utløser 2 poeng.",
        "Isolert stønning, nesevingespill og fremmedlyder er viktig ved observasjon av respirasjonsarbeidet og må formidles i kommunikasjonen rundt barnet, men utløser ikke poeng i skåren.",
        "Behov for ekstra oksygen gir 1 poeng, for eksempel på nesegrime eller løs maske.",
        "Oksygen på fast maske utløser 2 poeng ved flow ≥ 5 l/min og 3 poeng ved flow ≥ 8 l/min.",
      ],
    },
    { type: "overskrift", tekst: "Normalverdier" },
    NORMALVERDIER,
  ],
}

const SIRKULASJON_VEILEDNING: Veiledning = {
  tittel: "C Sirkulasjon",
  blokker: [
    {
      type: "punkter",
      punkter: [
        "Er du i tvil, spør foreldrene hva som er normal hudfarge for barnet.",
        "Kjenn etter om huden er kald, varm, svett eller klam. Dette utløser ikke poeng, men er viktige observasjoner som må formidles.",
        "Kapillærfylning: trykk med en finger mot huden i pannen eller over sternum i 5 sekunder, og tell sentral kapillærfylning ved å vurdere hvor lenge avblekningen holder seg.",
        "Blodtrykk inngår ikke i PEVS. Vurdering av sirkulasjonen hos et sykt barn må baseres på en samlet vurdering av hudfarge, kapillær fylningstid, våkenhet, diurese og blodtrykk.",
      ],
    },
    { type: "overskrift", tekst: "Normalverdier" },
    NORMALVERDIER,
  ],
}

const ADFERD_VEILEDNING: Veiledning = {
  tittel: "D Adferd",
  blokker: [
    {
      type: "punkter",
      punkter: [
        "Observer bevissthetstilstanden til barnet og gi poeng som anvist.",
        "Smerte og feber er også viktige observasjoner som må tas med i vurderingen av det syke barnet, men inngår ikke i skåren.",
      ],
    },
  ],
}

const TILLEGG_VEILEDNING: Veiledning = {
  tittel: "Tilleggspoeng",
  blokker: [
    { type: "avsnitt", tekst: "2 ekstra poeng tildeles ved:" },
    {
      type: "punkter",
      punkter: [
        "Inhalasjoner hvert 15. minutt, kontinuerlig inhalasjonsmedisin, HFNC eller kontinuerlig CPAP/BIPAP.",
        "Vedvarende postoperative brekninger/oppkast. Med vedvarende postoperative brekninger/oppkast menes oppkast mer enn 2 ganger per time.",
      ],
    },
    { type: "avsnitt", tekst: "Maksimal PEVS-skår er 9 poeng." },
  ],
}

const FULL_VEILEDNING: Veiledning = {
  tittel: "PEVS — full veiledning",
  blokker: [
    { type: "overskrift", tekst: "Generelt" },
    {
      type: "punkter",
      punkter: [
        "Early warning skåre til barn brukes for å vurdere potensielt syke pasienter i alder under 18 år.",
        "Husk at early warning skåre som PEVS bare er et verktøy til beslutningsstøtte.",
        "Feber, smerter, EKG, blodprøver og lignende er ikke del av PEVS, men er fortsatt viktige aspekter i totalvurderingen av pasienten.",
        "Journalfør PEVS sammen med andre observasjoner.",
        "Summen av PEVS på ≥ 5 eller en enkeltverdi på 3 indikerer umiddelbar legekontakt uavhengig av MTS.",
      ],
    },
    { type: "overskrift", tekst: "Normalverdier" },
    NORMALVERDIER,
    {
      type: "avsnitt",
      tekst:
        "Man differensierer ikke mellom aldre innenfor hver alderskategori — referanseområdene gjelder på samme måte enten barnet er 13 måneder eller 3 år. Poeng gis kun når verdiene er over eller under referanseverdien; endringer innenfor referanseverdiene gir ikke poeng.",
    },
    { type: "overskrift", tekst: "Summering av poeng" },
    {
      type: "punkter",
      punkter: [
        "Høyeste skår i hver kategori definerer antall poeng som skal summeres, og gir en PEVS-skår mellom 0 og 9 poeng.",
        "Dersom en observasjon ligger mellom to poengskår, utløses den høyeste poengsummen.",
        "Dersom flere parametere i en kategori er utenfor normalområdet, er det bare den alvorligste som utløser poeng. Selv om det ikke utløser poeng, er det likevel viktig å vektlegge og formidle dette.",
        "Dersom barnet har en grunnsykdom som kan påvirke dets fysiologiske parametere og dermed gi forhøyet PEVS i barnets normaltilstand, må legen ta stilling til dette.",
        "2 ekstra poeng tildeles ved inhalasjoner hvert 15. minutt, kontinuerlig inhalasjonsmedisin, HFNC eller kontinuerlig CPAP/BIPAP.",
        "2 ekstra poeng tildeles ved vedvarende postoperative brekninger/oppkast, det vil si oppkast mer enn 2 ganger per time.",
        "Maksimal PEVS-skår er 9 poeng.",
      ],
    },
    { type: "overskrift", tekst: "Responskriterier" },
    {
      type: "tabell",
      kolonner: ["PEVS-skår totalt", "Respons"],
      rader: [
        ["0–3", "Ingen spesielle tiltak"],
        ["4", "Legetilsyn innen 30 min."],
        ["≥ 5 eller 3 poeng på en parameter", "Legetilsyn umiddelbart"],
      ],
    },
    { type: "overskrift", tekst: "A Luftveier" },
    {
      type: "punkter",
      punkter: ["Respirasjonen skal telles i 1 minutt mens barnet er i hvile."],
    },
    { type: "overskrift", tekst: "B Respirasjon" },
    {
      type: "punkter",
      punkter: [
        "Costale, subcostale og intercostale inndragninger gir 1 poeng.",
        "Jugulære inndragninger utløser 2 poeng.",
        "Isolert stønning, nesevingespill og fremmedlyder er viktig ved observasjon av respirasjonsarbeidet og må formidles i kommunikasjonen rundt barnet, men utløser ikke poeng i skåren.",
        "Behov for ekstra oksygen gir 1 poeng, for eksempel på nesegrime eller løs maske.",
        "Oksygen på fast maske utløser 2 poeng ved flow ≥ 5 l/min og 3 poeng ved flow ≥ 8 l/min.",
      ],
    },
    { type: "overskrift", tekst: "C Sirkulasjon" },
    {
      type: "punkter",
      punkter: [
        "Er du i tvil, spør foreldrene hva som er normal hudfarge for barnet.",
        "Kjenn etter om huden er kald, varm, svett eller klam. Dette utløser ikke poeng, men er viktige observasjoner som må formidles.",
        "Kapillærfylning: trykk med en finger mot huden i pannen eller over sternum i 5 sekunder, og tell sentral kapillærfylning ved å vurdere hvor lenge avblekningen holder seg.",
        "Blodtrykk inngår ikke i PEVS. Vurdering av sirkulasjonen hos et sykt barn må baseres på en samlet vurdering av hudfarge, kapillær fylningstid, våkenhet, diurese og blodtrykk.",
      ],
    },
    { type: "overskrift", tekst: "D Adferd" },
    {
      type: "punkter",
      punkter: [
        "Observer bevissthetstilstanden til barnet og gi poeng som anvist.",
        "Smerte og feber er også viktige observasjoner som må tas med i vurderingen av det syke barnet, men inngår ikke i skåren.",
      ],
    },
    { type: "overskrift", tekst: "Praktisk fremgangsmåte ved legevakt" },
    {
      type: "punkter",
      punkter: [
        "Sykepleieren som tar imot pasienten tar en PEVS-skår i forbindelse med triage.",
        "Alle pasienter med triage-kartblad som har diskriminator «mulig sepsis» blir skåret ved innkomst. Skåren dokumenteres i innkomstjournalen.",
        "En skår på ≥ 4 gir positivt utslag på «mulig sepsis», og pasienten får dermed oransje hastegrad.",
        "Ved skår på 3 på en enkeltparameter eller en totalskår på ≥ 5 prioriteres pasienten blant pasientene med oransje hastegrad og vurderes av lege innen få minutter.",
      ],
    },
  ],
}

export const PEVS: Verktoy = {
  id: "pevs",
  navn: "PEVS",
  langtNavn: "Pediatric Early Warning Score — potensielt sykt barn under 18 år",
  kategori: "score",
  fagomrader: ["akutt", "barn"],
  sokeord: [
    "pevs",
    "pediatric early warning score",
    "early warning",
    "sykt barn",
    "spedbarn",
    "nyfødt",
    "mulig sepsis",
    "sepsis",
    "inndragninger",
    "kapillærfylning",
    "respirasjonsbesvær",
    "slapt barn",
    "barn",
  ],
  notatTittel: "PEVS",
  beregning: { type: "sum", maks: 9 },
  detaljStil: "poeng",
  veiledning: FULL_VEILEDNING,
  seksjoner: [
    {
      id: "alder",
      tittel: "Barnets alder",
      felter: [
        {
          type: "valg",
          id: "aldersgruppe",
          sporsmal: "Aldersgruppe",
          kort: "alder",
          detaljStil: "uten_poeng",
          hjelp: "Normalverdiene for respirasjonsfrekvens og puls følger alderskategorien.",
          veiledning: ALDER_VEILEDNING,
          alternativer: [
            {
              tekst: "Nyfødt, under 1 måned",
              poeng: 0,
              kriterium: "Normalt: respirasjonsfrekvens 40–55 · puls 100–160",
            },
            {
              tekst: "1 måned – under 13 måneder",
              poeng: 0,
              kriterium: "Normalt: respirasjonsfrekvens 35–45 · puls 100–160",
            },
            {
              tekst: "13 måneder – under 4 år",
              poeng: 0,
              kriterium: "Normalt: respirasjonsfrekvens 25–35 · puls 90–130",
            },
            {
              tekst: "4 år – under 7 år",
              poeng: 0,
              kriterium: "Normalt: respirasjonsfrekvens 20–24 · puls 70–120",
            },
            {
              tekst: "7 år – under 13 år",
              poeng: 0,
              kriterium: "Normalt: respirasjonsfrekvens 19–22 · puls 70–110",
            },
            {
              tekst: "13 år – 18 år",
              poeng: 0,
              kriterium: "Normalt: respirasjonsfrekvens 14–19 · puls 55–95",
            },
          ],
        },
      ],
    },
    {
      id: "vurdering",
      tittel: "Vurdering",
      maksPoeng: 9,
      felter: [
        {
          type: "valg",
          id: "respirasjon",
          sporsmal: "Respirasjon (A og B)",
          kort: "respirasjon",
          hjelp:
            "Høyeste kriterium som er oppfylt gir poengene. Tell respirasjonen i 1 minutt mens barnet er i hvile.",
          veiledning: RESPIRASJON_VEILEDNING,
          alternativer: [
            {
              tekst:
                "Normal respirasjonsfrekvens, ingen inndragninger og ikke behov for ekstra oksygen",
              poeng: 0,
            },
            {
              tekst:
                "Respirasjonsfrekvens ≥ 10 over normalverdi, inndragninger, eller behov for ekstra O₂ inntil 4 l/min",
              poeng: 1,
              kriterium:
                "Costale, subcostale og intercostale inndragninger. Oksygen på nesegrime eller løs maske.",
            },
            {
              tekst:
                "Respirasjonsfrekvens ≥ 20 over normalverdi, jugulære inndragninger, eller behov for O₂ ≥ 5 l/min",
              poeng: 2,
              kriterium: "Oksygen på fast maske med flow ≥ 5 l/min.",
            },
            {
              tekst:
                "Respirasjonsfrekvens ≥ 30 over normalverdi, ≥ 5 under normalverdi med inndragninger og stønning eller ved respirasjonshemmende medikamenter, eller O₂ på maske ≥ 8 l/min",
              poeng: 3,
              kriterium: "Oksygen på fast maske med flow ≥ 8 l/min.",
            },
          ],
        },
        {
          type: "valg",
          id: "sirkulasjon",
          sporsmal: "Sirkulasjon (C)",
          kort: "sirkulasjon",
          hjelp:
            "Høyeste kriterium som er oppfylt gir poengene. Kapillærfylning måles sentralt i pannen eller over sternum.",
          veiledning: SIRKULASJON_VEILEDNING,
          alternativer: [
            {
              tekst: "Normal og upåfallende hudfarge og kapillær fylningstid 1–2 sek.",
              poeng: 0,
            },
            { tekst: "Blek, eller kapillær fylningstid 3 sek.", poeng: 1 },
            {
              tekst:
                "Grå/cyanotisk, takykardi ≥ 20 over normalverdi, eller kapillær fylningstid 4 sek.",
              poeng: 2,
            },
            {
              tekst:
                "Grå/cyanotisk og marmorert, takykardi ≥ 30 over normalverdi, bradykardi ≥ 5 under normalverdi, eller kapillær fylningstid ≥ 5 sek.",
              poeng: 3,
            },
          ],
        },
        {
          type: "valg",
          id: "adferd",
          sporsmal: "Adferd (D)",
          kort: "adferd",
          hjelp: "Høyeste kriterium som er oppfylt gir poengene.",
          veiledning: ADFERD_VEILEDNING,
          alternativer: [
            {
              tekst:
                "Våken med normal kontakt, interesse for omgivelsen, reagerer normalt på stimuli",
              poeng: 0,
            },
            { tekst: "Slapp, redusert aktivitet, trøtt, sover", poeng: 1 },
            { tekst: "Somnolent (vanskelig å vekke), irritabel", poeng: 2 },
            { tekst: "Bevisstløs, kramper, redusert respons på smertestimuli", poeng: 3 },
          ],
        },
      ],
    },
    {
      id: "tillegg",
      tittel: "Tilleggspoeng",
      felter: [
        {
          type: "ja_nei",
          id: "inhalasjon",
          sporsmal:
            "Inhalasjoner hvert 15. minutt, kontinuerlig inhalasjonsmedisin, HFNC eller kontinuerlig CPAP/BIPAP",
          kort: "kontinuerlig inhalasjon/HFNC/CPAP",
          poeng: 2,
          veiledning: TILLEGG_VEILEDNING,
        },
        {
          type: "ja_nei",
          id: "oppkast",
          sporsmal: "Vedvarende postoperative brekninger/oppkast",
          kort: "vedvarende postoperativt oppkast",
          poeng: 2,
          hjelp: "Oppkast mer enn 2 ganger per time.",
          veiledning: TILLEGG_VEILEDNING,
        },
      ],
    },
  ],
  terskler: [
    {
      fra: 0,
      til: 3,
      klasse: "Ingen spesielle tiltak",
      tekst: "Skår 0–3 gir ingen spesielle tiltak etter PEVS sine responskriterier",
      farge: "gronn",
    },
    {
      fra: 4,
      til: 4,
      klasse: "Legetilsyn innen 30 minutter",
      tekst:
        "Skår 4 gir legetilsyn innen 30 minutter, og gir positivt utslag på «mulig sepsis» ved triagering",
      farge: "gul",
    },
    {
      fra: 5,
      til: 9,
      klasse: "Legetilsyn umiddelbart",
      tekst: "Skår 5 eller mer indikerer umiddelbar legekontakt uavhengig av MTS",
      farge: "rod",
    },
  ],
  overstyringer: [
    {
      type: "enkeltfelt_minst",
      poeng: 3,
      klasse: "Legetilsyn umiddelbart",
      tekst:
        "3 poeng på en enkeltparameter indikerer umiddelbar legekontakt uavhengig av totalskår og MTS",
      farge: "rod",
    },
  ],
  kilde: {
    navn: "Metodebok, Asker og Bærum legevakt",
    versjon: "1.6",
    sistRevidert: "2025-04-07",
  },
  testkasus: [
    {
      navn: "Friskt barn, alle parametere normale",
      svar: { aldersgruppe: 2, respirasjon: 0, sirkulasjon: 0, adferd: 0 },
      forventetSum: 0,
      forventetKlasse: "Ingen spesielle tiltak",
    },
    {
      navn: "Lett påvirket: takypné, blek og slapp",
      svar: { aldersgruppe: 3, respirasjon: 1, sirkulasjon: 1, adferd: 1 },
      forventetSum: 3,
      forventetKlasse: "Ingen spesielle tiltak",
    },
    {
      navn: "Skår 4 gir legetilsyn innen 30 minutter",
      svar: { aldersgruppe: 3, respirasjon: 2, sirkulasjon: 1, adferd: 1 },
      forventetSum: 4,
      forventetKlasse: "Legetilsyn innen 30 minutter",
    },
    {
      navn: "Enkeltparameter på 3 overstyrer totalskåren",
      svar: { aldersgruppe: 1, respirasjon: 3, sirkulasjon: 0, adferd: 0 },
      forventetSum: 3,
      forventetKlasse: "Legetilsyn umiddelbart",
    },
    {
      navn: "Tilleggspoeng for kontinuerlig inhalasjon løfter skåren til 5",
      svar: { aldersgruppe: 2, respirasjon: 2, sirkulasjon: 1, adferd: 0, inhalasjon: true },
      forventetSum: 5,
      forventetKlasse: "Legetilsyn umiddelbart",
    },
    {
      navn: "Råsum 13 kappes til maksimal skår 9",
      svar: {
        aldersgruppe: 0,
        respirasjon: 3,
        sirkulasjon: 3,
        adferd: 3,
        inhalasjon: true,
        oppkast: true,
      },
      forventetSum: 9,
      forventetKlasse: "Legetilsyn umiddelbart",
    },
  ],
  opphav: "innebygd",
}
