import type { Verktoy } from "../typer"

/**
 * Kort liste med de testene som faktisk skiller mellom de vanlige
 * differensialdiagnosene: adhesiv kapsulitt, rotatorcuffpatologi, instabilitet og
 * AC-leddsaffeksjon. Biceps-tester (Speed, Yergason) er utelatt — de har svak
 * treffsikkerhet og endrer sjelden vurderingen.
 *
 * Tester som ikke krysses av, tas ikke med i notatet.
 */
export const SKULDERUNDERSOKELSE: Verktoy = {
  id: "skulder",
  navn: "Skulderundersøkelse",
  langtNavn: "Strukturert undersøkelse av skulder",
  kategori: "undersokelse",
  sokeord: [
    "skulder",
    "skulderen",
    "rotatorcuff",
    "supraspinatus",
    "impingement",
    "frozen shoulder",
    "adhesiv kapsulitt",
    "kalkskulder",
    "ac-ledd",
    "skulderluksasjon",
    "vondt i skulderen",
  ],
  notatTittel: "Skulderundersøkelse",
  lateralitet: true,
  beregning: { type: "ingen" },
  terskler: [],
  seksjoner: [
    {
      id: "bevegelighet",
      tittel: "Bevegelighet",
      felter: [
        {
          type: "funn",
          id: "aktiv-bevegelighet",
          test: "Aktiv bevegelighet",
          kort: "aktiv bevegelighet",
          hjelp: "Abduksjon, fleksjon og utrotasjon. Sammenlign alltid med motsatt side.",
        },
        {
          type: "funn",
          id: "passiv-utrotasjon",
          test: "Passiv utrotasjon",
          kort: "passiv utrotasjon",
          hjelp:
            "Det viktigste skillet i skulderundersøkelsen: innskrenket PASSIV utrotasjon med armen inntil kroppen er nøkkelfunnet ved adhesiv kapsulitt. Ved rotatorcuffpatologi er den passive bevegeligheten bevart.",
        },
        {
          type: "funn",
          id: "smertebue",
          test: "Smertebue 60–120 grader",
          kort: "smertebue",
          hjelp:
            "Smerte i midtre del av abduksjonsbanen taler for subakromial patologi. Smerte først over 120 grader peker mot AC-leddet.",
        },
      ],
    },
    {
      id: "impingement",
      tittel: "Impingementtester",
      felter: [
        {
          type: "funn",
          id: "neer",
          test: "Neer",
          kort: "Neer",
          hjelp:
            "Passiv fleksjon med innrotert arm. Sensitiv, men lite spesifikk — positiv test lokaliserer ikke hvilken struktur som er affisert.",
        },
        {
          type: "funn",
          id: "hawkins",
          test: "Hawkins-Kennedy",
          kort: "Hawkins-Kennedy",
          hjelp: "90 graders fleksjon med innrotasjon. Samme forbehold som Neer.",
        },
      ],
    },
    {
      id: "cuff",
      tittel: "Rotatorcuff",
      felter: [
        {
          type: "funn",
          id: "jobe",
          test: "Jobe (empty can)",
          kort: "Jobe",
          hjelp: "Supraspinatus. Kraftsvikt veier tyngre enn smerte alene.",
        },
        {
          type: "funn",
          id: "utrotasjon-motstand",
          test: "Utrotasjon mot motstand",
          kort: "utrotasjon mot motstand",
          hjelp: "Infraspinatus. Utrotasjonssvikt (lag sign) taler for større ruptur.",
        },
        {
          type: "funn",
          id: "belly-press",
          test: "Belly-press eller lift-off",
          kort: "belly-press",
          hjelp: "Subscapularis. Lift-off krever at hånden kan føres bak ryggen.",
        },
        {
          type: "funn",
          id: "drop-arm",
          test: "Drop arm",
          kort: "drop arm",
          hjelp:
            "Armen faller ukontrollert fra abdusert stilling. Høy spesifisitet for gjennomgående supraspinatusruptur.",
        },
      ],
    },
    {
      id: "instabilitet",
      tittel: "Instabilitet og AC-ledd",
      felter: [
        {
          type: "funn",
          id: "apprehension",
          test: "Apprehensjonstest",
          kort: "apprehensjonstest",
          hjelp:
            "Abduksjon og utrotasjon i 90 grader. Engstelse — ikke smerte alene — er det positive funnet ved fremre instabilitet.",
        },
        {
          type: "funn",
          id: "cross-body",
          test: "Cross-body adduksjon",
          kort: "cross-body adduksjon",
          hjelp: "Smerte lokalisert til AC-leddet taler for AC-leddsartrose eller -skade.",
        },
      ],
    },
  ],
  kilde: {
    navn: "Strukturert klinisk skulderundersøkelse",
    sistRevidert: "2026",
  },
  opphav: "innebygd",
}
