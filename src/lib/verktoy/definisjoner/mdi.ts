import type { Alternativ, Svarverdi, Verktoy } from "../typer"

/**
 * MDI — Major Depression Inventory.
 *
 * Selvutfyllingsskjema: pasienten svarer selv, enten på legekontoret eller
 * sammen med legen. Til forskjell fra MADRS, som legen skårer ut fra samtalen.
 *
 * **Om kilden.** Ledd og svaralternativer er hentet fra figur 1a i Bech et al.,
 * BMC Psychiatry 2015;15:190, som er publisert under Creative Commons
 * Attribution 4.0 (fri gjenbruk med kreditering). Skåringsregelen og
 * alvorlighetsbåndene står i figur 1b i samme artikkel.
 *
 * Den norske ordlyden er **vår egen oversettelse av den engelske originalen**.
 * NHIs norske versjon er ikke brukt: den er opphavsrettslig beskyttet av Norsk
 * Helseinformatikk AS, med et uttrykkelig forbehold mot tekst- og datautvinning.
 * NHI opplyser selv at deres norske versjon ikke er klinisk validert — det
 * gjelder like fullt for denne. Det er bare den engelske originalen som er
 * validert, og det står i veiledningen slik at legen ser det.
 *
 * Tallene — poeng per svar, maksregelen for 8a/8b og 10a/10b, og
 * terskeltabellen — er gjengitt fra kilden, ikke skrevet fra hukommelsen.
 */

/**
 * De seks svaralternativene er felles for alle ledd.
 *
 * Kilden setter dem opp vannrett med «All the time» (5) først. Her står de
 * loddrett og stigende, 0 først, som i MADRS. Det gir samtidig invarianten
 * **indeks === poeng**, som `mdi`-formelen i `formler.ts` bygger på: den får
 * bare svarene, ikke definisjonen, og kan derfor ikke slå opp
 * `alternativer[i].poeng`. Referansekasusene under fanger opp hvis rekkefølgen
 * noen gang endres.
 */
function hvorOfte(): Alternativ[] {
  return [
    { tekst: "Ikke på noe tidspunkt", poeng: 0 },
    { tekst: "Noe av tiden", poeng: 1 },
    { tekst: "Litt mindre enn halvparten av tiden", poeng: 2 },
    { tekst: "Litt mer enn halvparten av tiden", poeng: 3 },
    { tekst: "Det meste av tiden", poeng: 4 },
    { tekst: "Hele tiden", poeng: 5 },
  ]
}

/** Leddene som alltid teller med, i kildens rekkefølge (1–7 og 9). */
const ENKELTLEDD = [
  "nedstemt",
  "interesse",
  "energi",
  "selvtillit",
  "skyldfolelse",
  "livslyst",
  "konsentrasjon",
  "sovn",
] as const

/**
 * Bygger et fullt svarsett for et referansekasus. Uten dette blir tabellen under
 * tolv linjer med løse tall per kasus, og en trykkleif går rett gjennom.
 */
function svarsett(
  ledd: [number, number, number, number, number, number, number, number],
  par: { rastlos: number; dempet: number; nedsattAppetitt: number; oktAppetitt: number }
): Record<string, Svarverdi> {
  const svar: Record<string, Svarverdi> = {}
  ENKELTLEDD.forEach((id, i) => {
    svar[id] = ledd[i]
  })
  svar["rastlos"] = par.rastlos
  svar["dempet"] = par.dempet
  svar["nedsatt-appetitt"] = par.nedsattAppetitt
  svar["okt-appetitt"] = par.oktAppetitt
  return svar
}

/**
 * Fast parsett i referansekasusene: 8a=4 mot 8b=1 og 10a=0 mot 10b=3, altså
 * 4+3=7 poeng. Summerer man i stedet alle fire naivt, blir det 8 — nok til å
 * skyve kasusene under over en båndgrense. Maksregelen er dermed ikke bare
 * dekket av testene, den er det de faktisk måler.
 */
const PAR = { rastlos: 4, dempet: 1, nedsattAppetitt: 0, oktAppetitt: 3 }

export const MDI: Verktoy = {
  id: "mdi",
  navn: "MDI",
  langtNavn: "Major Depression Inventory (selvutfylling)",
  kategori: "score",
  fagomrader: ["psykisk_helse"],
  sokeord: [
    "mdi",
    "depresjon",
    "deprimert",
    "nedstemt",
    "depresjonsskjema",
    "selvutfylling",
    "pasientutfylt",
    "stemningsleie",
    "tungsinn",
    "psykisk helse",
    "icd-10",
    "major depression inventory",
  ],
  notatTittel: "MDI",
  // Tolv ledd med hver sin alternativtekst ville gitt en avsnittslang notatlinje
  detaljStil: "poeng",
  /*
   * Ikke `sum`: leddene 8a/8b og 10a/10b er par der bare det høyeste svaret
   * teller. En vanlig sum ville gitt inntil 60 poeng på en skala som går til 50.
   */
  beregning: { type: "formel", formelId: "mdi", desimaler: 0 },
  veiledning: {
    tittel: "MDI — utfylling og skåring",
    blokker: [
      {
        type: "avsnitt",
        tekst:
          "Pasienten fyller ut skjemaet selv. Spørsmålene handler om hvordan " +
          "hun eller han har hatt det i den aktuelle perioden — sett av det " +
          "svaret som ligger nærmest.",
      },
      { type: "overskrift", tekst: "Hvilken periode pasienten skal svare for" },
      {
        type: "punkter",
        punkter: [
          "Som mål på alvorlighetsgrad hos en pasient som allerede har fått diagnosen depresjon: siste uke.",
          "Som kartleggingsskjema ved diagnostikk: de to siste ukene.",
        ],
      },
      { type: "overskrift", tekst: "Skåring" },
      {
        type: "punkter",
        punkter: [
          "Hvert ledd skåres 0–5.",
          "For 8a mot 8b, og for 10a mot 10b, teller kun det høyeste av de to svarene.",
          "Totalskåren er summen av de ti leddene og går fra 0 (ingen depresjon) til 50 (maksimal depresjon).",
        ],
      },
      {
        type: "tabell",
        kolonner: ["Totalskår", "Alvorlighetsgrad"],
        rader: [
          ["0–20", "Ingen eller tvilsom depresjon"],
          ["21–25", "Lett depresjon"],
          ["26–30", "Moderat depresjon"],
          ["31–50", "Alvorlig depresjon"],
        ],
      },
      { type: "overskrift", tekst: "Forbehold" },
      {
        type: "avsnitt",
        tekst:
          "Diagnosen depresjon stilles på bakgrunn av klinisk vurdering, " +
          "eventuelt supplert med kartleggingsskjema. MDI erstatter ikke samtalen.",
      },
      {
        type: "avsnitt",
        tekst:
          "Det er den engelske originalen som er klinisk validert. Den norske " +
          "ordlyden her er en oversettelse av originalen og er ikke validert " +
          "på norsk. Skåringsregler og terskler er uendret fra kilden.",
      },
      {
        type: "lenke",
        tekst: "Bech et al., BMC Psychiatry 2015 (åpen tilgang, CC BY 4.0)",
        url: "https://doi.org/10.1186/s12888-015-0529-3",
      },
    ],
  },
  seksjoner: [
    {
      id: "ledd",
      tittel: "Hvor mye av tiden …",
      felter: [
        {
          type: "valg",
          id: "nedstemt",
          sporsmal: "1. Har du følt deg nedstemt eller trist?",
          kort: "nedstemt",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "interesse",
          sporsmal: "2. Har du mistet interessen for dine daglige gjøremål?",
          kort: "interesse",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "energi",
          sporsmal: "3. Har du følt at du manglet energi og krefter?",
          kort: "energi",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "selvtillit",
          sporsmal: "4. Har du følt deg mindre selvsikker?",
          kort: "selvtillit",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "skyldfolelse",
          sporsmal: "5. Har du hatt dårlig samvittighet eller skyldfølelse?",
          kort: "skyldfølelse",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "livslyst",
          sporsmal: "6. Har du følt at livet ikke var verdt å leve?",
          kort: "livslyst",
          hjelp: "Et svar over 0 her bør følges opp med egen vurdering av selvmordsrisiko.",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "konsentrasjon",
          sporsmal:
            "7. Har du hatt konsentrasjonsvansker, for eksempel når du leser avisen eller ser på TV?",
          kort: "konsentrasjon",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "rastlos",
          sporsmal: "8a. Har du følt deg svært rastløs?",
          kort: "rastløs (8a)",
          hjelp: "Av 8a og 8b teller kun det høyeste svaret i totalskåren. Begge må besvares.",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "dempet",
          sporsmal: "8b. Har du følt deg dempet, eller som om alt gikk langsommere?",
          kort: "dempet (8b)",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "sovn",
          sporsmal: "9. Har du hatt problemer med å sove om natten?",
          kort: "søvn",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "nedsatt-appetitt",
          sporsmal: "10a. Har du hatt nedsatt appetitt?",
          kort: "nedsatt appetitt (10a)",
          hjelp: "Av 10a og 10b teller kun det høyeste svaret i totalskåren. Begge må besvares.",
          alternativer: hvorOfte(),
        },
        {
          type: "valg",
          id: "okt-appetitt",
          sporsmal: "10b. Har du hatt økt appetitt?",
          kort: "økt appetitt (10b)",
          alternativer: hvorOfte(),
        },
      ],
    },
  ],
  terskler: [
    {
      fra: 0,
      til: 20,
      klasse: "Ingen eller tvilsom depresjon",
      tekst: "Skår i området uten sikre tegn til depresjon",
      farge: "gronn",
    },
    {
      fra: 21,
      til: 25,
      klasse: "Lett depresjon",
      tekst: "Skår forenlig med lett depresjon",
      farge: "gul",
    },
    {
      fra: 26,
      til: 30,
      klasse: "Moderat depresjon",
      tekst: "Skår forenlig med moderat depresjon",
      farge: "rod",
    },
    {
      fra: 31,
      til: 50,
      klasse: "Alvorlig depresjon",
      tekst: "Skår forenlig med alvorlig depresjon",
      farge: "rod",
    },
  ],
  kilde: {
    navn: "Major Depression Inventory (MDI), Bech et al. BMC Psychiatry 2015",
    url: "https://doi.org/10.1186/s12888-015-0529-3",
    sistRevidert: "2015",
  },
  /*
   * Kasusene dekker begge ytterpunktene og begge sidene av hver båndgrense.
   * Terskeltabellen er hele det kliniske utbyttet av skjemaet, og en grense som
   * ligger ett poeng feil er usynlig i bruk.
   */
  testkasus: [
    {
      navn: "Alle ledd 0",
      svar: svarsett([0, 0, 0, 0, 0, 0, 0, 0], {
        rastlos: 0,
        dempet: 0,
        nedsattAppetitt: 0,
        oktAppetitt: 0,
      }),
      forventetSum: 0,
      forventetKlasse: "Ingen eller tvilsom depresjon",
    },
    {
      navn: "Øvre grense for ingen/tvilsom depresjon",
      svar: svarsett([2, 2, 3, 2, 1, 0, 2, 1], PAR),
      forventetSum: 20,
      forventetKlasse: "Ingen eller tvilsom depresjon",
    },
    {
      navn: "Nedre grense for lett depresjon",
      svar: svarsett([3, 2, 3, 2, 1, 0, 2, 1], PAR),
      forventetSum: 21,
      forventetKlasse: "Lett depresjon",
    },
    {
      navn: "Øvre grense for lett depresjon",
      svar: svarsett([3, 3, 3, 2, 2, 1, 3, 1], PAR),
      forventetSum: 25,
      forventetKlasse: "Lett depresjon",
    },
    {
      navn: "Nedre grense for moderat depresjon",
      svar: svarsett([4, 3, 3, 2, 2, 1, 3, 1], PAR),
      forventetSum: 26,
      forventetKlasse: "Moderat depresjon",
    },
    {
      navn: "Øvre grense for moderat depresjon",
      svar: svarsett([4, 4, 4, 3, 2, 1, 3, 2], PAR),
      forventetSum: 30,
      forventetKlasse: "Moderat depresjon",
    },
    {
      navn: "Nedre grense for alvorlig depresjon",
      svar: svarsett([5, 4, 4, 3, 2, 1, 3, 2], PAR),
      forventetSum: 31,
      forventetKlasse: "Alvorlig depresjon",
    },
    {
      navn: "Alle ledd 5 (maksimal skår)",
      svar: svarsett([5, 5, 5, 5, 5, 5, 5, 5], {
        rastlos: 5,
        dempet: 5,
        nedsattAppetitt: 5,
        oktAppetitt: 5,
      }),
      forventetSum: 50,
      forventetKlasse: "Alvorlig depresjon",
    },
  ],
  opphav: "innebygd",
}
