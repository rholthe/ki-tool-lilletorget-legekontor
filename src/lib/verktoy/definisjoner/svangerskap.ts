import type { Kalkulator } from "../typer"

/**
 * Svangerskapskalkulator — termin, siste menstruasjon og aktuell
 * gestasjonsalder, med fire inngangsveier til samme underliggende dato.
 *
 * Feltene for de andre veiene skjules via `synligNar`, slik at skjemaet viser én
 * vei om gangen.
 */
export const SVANGERSKAP: Kalkulator = {
  id: "svangerskap",
  navn: "Svangerskapskalkulator",
  langtNavn: "Termin, siste menstruasjon og gestasjonsalder",
  kategori: "kalkulator",
  kalkulatorId: "svangerskap",
  notatTittel: "Svangerskap",
  sokeord: [
    "termin",
    "termindato",
    "svangerskap",
    "gravid",
    "graviditet",
    "gestasjonsalder",
    "gestasjonsuke",
    "svangerskapsuke",
    "siste mens",
    "siste menstruasjon",
    "naegele",
    "ivf",
    "embryo",
    "blastocyst",
  ],
  veiledning: {
    tittel: "Svangerskapskalkulator — metode",
    blokker: [
      { type: "overskrift", tekst: "Termin fra siste menstruasjon" },
      {
        type: "avsnitt",
        tekst:
          "Termin settes til første dag i siste menstruasjon pluss 283 dager ved 28 dagers syklus. Internasjonalt regnes 280 dager (40 uker) etter Naegele, men norske kalkulatorer bruker 283 fordi norske data viser at median svangerskapslengde er tre dager lengre. Terminen faller dermed på gestasjonsalder 40+3, ikke 40+0 — det er en konsekvens av konvensjonen, ikke en feil.",
      },
      {
        type: "avsnitt",
        tekst:
          "Terminen bygger på antatt eggløsning 14 dager ut i syklusen. Oppgir du en annen sykluslengde, forskyves både termin og gestasjonsalder like mye: en syklus på 35 dager gir termin sju dager senere og gestasjonsalder sju dager lavere. Ved uregelmessig syklus er ultralyd mer pålitelig.",
      },
      { type: "overskrift", tekst: "Termin ved IVF" },
      {
        type: "avsnitt",
        tekst:
          "Ved IVF er befruktningsdatoen kjent, og «siste menstruasjon» regnes tilbake fra den: overføringsdato minus embryoets alder minus 14 dager. Deretter legges de samme 283 dagene til. Internasjonale kalkulatorer bruker 280 dager her og gir derfor termin tre dager tidligere.",
      },
      {
        type: "tabell",
        kolonner: ["Embryo ved overføring", "Termin (norsk, 283 d)", "Internasjonalt (280 d)"],
        rader: [
          ["Dag 2", "overføring + 267 dager", "+ 264 dager"],
          ["Dag 3", "overføring + 266 dager", "+ 263 dager"],
          ["Dag 5 (blastocyst)", "overføring + 264 dager", "+ 261 dager"],
          ["Dag 6 (blastocyst)", "overføring + 263 dager", "+ 260 dager"],
        ],
      },
      { type: "overskrift", tekst: "Gestasjonsalder" },
      {
        type: "avsnitt",
        tekst:
          "Gestasjonsalder oppgis som fullførte uker pluss dager, regnet fra første dag i siste menstruasjon (justert for sykluslengde). Ved termin er den 40+3, siden terminen settes 283 dager ut. Verdien som vises gjelder dagens dato og endrer seg hver dag — derfor skriver notatet alltid hvilken dato den ble regnet på.",
      },
      { type: "overskrift", tekst: "Videre lesning" },
      {
        type: "lenke",
        tekst: "Nasjonal faglig retningslinje for svangerskapsomsorgen (Helsedirektoratet)",
        url: "https://www.helsedirektoratet.no/retningslinjer/svangerskapsomsorgen",
      },
      {
        type: "lenke",
        tekst: "Terminkalkulator (NHI)",
        url: "https://nhi.no/graviditetsorakelet/terminkalkulator",
      },
    ],
  },
  seksjoner: [
    {
      id: "metode",
      tittel: "Beregn ut fra",
      felter: [
        {
          type: "valg",
          id: "modus",
          sporsmal: "Hva vet du?",
          kort: "metode",
          alternativer: [
            { tekst: "Første dag i siste menstruasjon", poeng: 0 },
            { tekst: "Kjent termindato", poeng: 0 },
            { tekst: "Kjent gestasjonsalder", poeng: 0 },
            { tekst: "IVF — overføringsdato", poeng: 0 },
          ],
        },
      ],
    },
    {
      id: "inndata",
      tittel: "Inndata",
      felter: [
        {
          type: "dato",
          id: "sisteMens",
          sporsmal: "Første dag i siste menstruasjon",
          kort: "siste mens",
          synligNar: { felt: "modus", erLik: 0 },
        },
        {
          type: "dato",
          id: "termin",
          sporsmal: "Termindato",
          kort: "termin",
          synligNar: { felt: "modus", erLik: 1 },
        },
        {
          type: "tall",
          id: "syklus",
          sporsmal: "Sykluslengde",
          kort: "syklus",
          enhet: "dager",
          min: 20,
          max: 45,
          hjelp: "La stå tom for 28 dager. Lengre syklus betyr senere eggløsning og forskyver både termin og gestasjonsalder tilsvarende.",
          synligNar: { felt: "modus", erLik: [0, 1] },
        },
        {
          type: "tall",
          id: "gaUker",
          sporsmal: "Gestasjonsalder — uker",
          kort: "uker",
          enhet: "uker",
          min: 0,
          max: 45,
          synligNar: { felt: "modus", erLik: 2 },
        },
        {
          type: "tall",
          id: "gaDager",
          sporsmal: "Gestasjonsalder — dager",
          kort: "dager",
          enhet: "dager",
          min: 0,
          max: 6,
          synligNar: { felt: "modus", erLik: 2 },
        },
        {
          type: "dato",
          id: "gaDato",
          sporsmal: "Gestasjonsalderen gjelder denne datoen",
          kort: "gjelder dato",
          hjelp: "La stå tom for å bruke dagens dato. Sett datoen for undersøkelsen hvis alderen er fra en tidligere ultralyd.",
          synligNar: { felt: "modus", erLik: 2 },
        },
        {
          type: "dato",
          id: "ivfDato",
          sporsmal: "Overføringsdato",
          kort: "overføring",
          synligNar: { felt: "modus", erLik: 3 },
        },
        {
          type: "valg",
          id: "ivfEmbryo",
          sporsmal: "Embryoets alder ved overføring",
          kort: "embryo",
          synligNar: { felt: "modus", erLik: 3 },
          alternativer: [
            { tekst: "Dag 2", poeng: 0 },
            { tekst: "Dag 3", poeng: 0 },
            { tekst: "Dag 5 (blastocyst)", poeng: 0 },
            { tekst: "Dag 6 (blastocyst)", poeng: 0 },
          ],
        },
      ],
    },
  ],
  kilde: {
    navn: "Svangerskapsomsorgen, Helsedirektoratet",
    url: "https://www.helsedirektoratet.no/retningslinjer/svangerskapsomsorgen",
    sistRevidert: "2026",
  },
  /**
   * Referanseverdier avlest fra NHIs terminkalkulator, som bruker den norske
   * 283-dagerskonvensjonen. Både 28 og 35 dagers syklus er kontrollert der.
   */
  testkasus: [
    {
      navn: "Siste mens 1. mars 2026, syklus 28, gir termin 9. desember 2026",
      svar: { modus: 0, sisteMens: "2026-03-01" },
      forventet: { Termin: "09.12.2026" },
    },
    {
      navn: "Syklus 35 forskyver terminen sju dager",
      svar: { modus: 0, sisteMens: "2026-03-01", syklus: 35 },
      forventet: { Termin: "16.12.2026" },
    },
    {
      navn: "Kjent termin regner tilbake til siste mens",
      svar: { modus: 1, termin: "2026-12-09" },
      forventet: { Termin: "09.12.2026", "Siste menstruasjon": "01.03.2026" },
    },
    {
      navn: "Gestasjonsalder 12+3 på en gitt dato",
      svar: { modus: 2, gaUker: 12, gaDager: 3, gaDato: "2026-05-27" },
      forventet: { Termin: "09.12.2026", "Siste menstruasjon": "01.03.2026" },
    },
    {
      navn: "IVF blastocyst dag 5 gir termin på overføring + 264 dager",
      svar: { modus: 3, ivfDato: "2026-03-20", ivfEmbryo: 2 },
      forventet: {
        Termin: "09.12.2026",
        "Tilsvarende siste menstruasjon": "01.03.2026",
      },
    },
    {
      navn: "IVF embryo dag 3 gir termin på overføring + 266 dager",
      svar: { modus: 3, ivfDato: "2026-03-18", ivfEmbryo: 1 },
      forventet: { Termin: "09.12.2026" },
    },
    {
      navn: "Termin over sommertidsskiftet regnes riktig",
      svar: { modus: 0, sisteMens: "2026-01-15" },
      forventet: { Termin: "25.10.2026" },
    },
  ],
  opphav: "innebygd",
}
