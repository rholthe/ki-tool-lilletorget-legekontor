import type { Verktoy } from "../typer"

/**
 * Bevisst kort liste. Tester med lav treffsikkerhet (fremre skuffetest, Apleys
 * kompresjonstest) er utelatt til fordel for dem som faktisk endrer vurderingen —
 * legen skal komme gjennom undersøkelsen på en travel dag.
 *
 * Tester som ikke krysses av, tas ikke med i notatet.
 */
export const KNEUNDERSOKELSE: Verktoy = {
  id: "kne",
  navn: "Kneundersøkelse",
  langtNavn: "Strukturert undersøkelse av kne",
  kategori: "undersokelse",
  fagomrader: ["muskel_skjelett"],
  sokeord: [
    "kne",
    "kneet",
    "korsbånd",
    "menisk",
    "acl",
    "lachman",
    "mcmurray",
    "kneskade",
    "vridd kneet",
    "hevelse i kneet",
    "låsning",
    "kollateralligament",
  ],
  notatTittel: "Kneundersøkelse",
  lateralitet: true,
  beregning: { type: "ingen" },
  terskler: [],
  seksjoner: [
    {
      id: "inspeksjon",
      tittel: "Inspeksjon og bevegelse",
      felter: [
        {
          type: "funn",
          id: "effusjon",
          test: "Effusjon (patellaballottement)",
          kort: "effusjon",
          hjelp:
            "Sveip væsken opp fra mediale recess og trykk patella ned. Hydrops innen få timer etter traume taler for hemartros — korsbånd, brusk eller fraktur.",
        },
        {
          type: "funn",
          id: "ekstensjonsdefekt",
          test: "Ekstensjonsdefekt",
          kort: "ekstensjonsdefekt",
          hjelp:
            "Manglende full strekk. Fast, elastisk stopp med låsning gir mistanke om bøttehåndtaksruptur i menisk.",
        },
        {
          type: "funn",
          id: "fleksjonsdefekt",
          test: "Fleksjonsdefekt",
          kort: "fleksjonsdefekt",
          hjelp: "Sammenlign med motsatt side. Smertebetinget innskrenkning er uspesifikk.",
        },
      ],
    },
    {
      id: "palpasjon",
      tittel: "Palpasjon",
      felter: [
        {
          type: "funn",
          id: "leddspalte-medialt",
          test: "Leddspalteømhet medialt",
          kort: "leddspalteømhet medialt",
          hjelp:
            "Den mest sensitive enkelttesten for menisklesjon. Palperes med kneet i 90 graders fleksjon.",
        },
        {
          type: "funn",
          id: "leddspalte-lateralt",
          test: "Leddspalteømhet lateralt",
          kort: "leddspalteømhet lateralt",
        },
      ],
    },
    {
      id: "ligamenter",
      tittel: "Ligamenttester",
      felter: [
        {
          type: "funn",
          id: "lachman",
          test: "Lachman",
          kort: "Lachman",
          hjelp:
            "Beste enkelttest for fremre korsbånd, klart bedre enn fremre skuffetest. 20–30 graders fleksjon; vurder både utslag og endepunkt — mykt endepunkt er patologisk.",
        },
        {
          type: "funn",
          id: "bakre-skuffe",
          test: "Bakre skuffetest",
          kort: "bakre skuffetest",
          hjelp:
            "Bakre korsbånd. Se også etter posterior sag med hoften og kneet i 90 grader.",
        },
        {
          type: "funn",
          id: "valgus-30",
          test: "Valgusstress i 30 grader",
          kort: "valgusstress 30°",
          hjelp: "Mediale kollateralligament.",
        },
        {
          type: "funn",
          id: "valgus-0",
          test: "Valgusstress i full ekstensjon",
          kort: "valgusstress 0°",
          hjelp:
            "Instabilitet også i full ekstensjon taler for kombinert skade med korsbånd eller bakre kapsel, ikke isolert MCL.",
        },
        {
          type: "funn",
          id: "varus-30",
          test: "Varusstress i 30 grader",
          kort: "varusstress 30°",
          hjelp: "Laterale kollateralligament og posterolaterale hjørne.",
        },
      ],
    },
    {
      id: "menisk",
      tittel: "Menisk og patellofemoralledd",
      felter: [
        {
          type: "funn",
          id: "mcmurray",
          test: "McMurray",
          kort: "McMurray",
          hjelp:
            "Høy spesifisitet, lav sensitivitet — en negativ test utelukker ikke menisklesjon. Klikk med smerte i leddspalten er det positive funnet.",
        },
        {
          type: "funn",
          id: "patella-apprehension",
          test: "Patellar apprehensjon",
          kort: "patellar apprehensjon",
          hjelp:
            "Lateral forskyvning av patella med kneet lett bøyd. Uttalt engstelse taler for patellar instabilitet.",
        },
      ],
    },
  ],
  kilde: {
    navn: "Strukturert klinisk kneundersøkelse",
    sistRevidert: "2026",
  },
  opphav: "innebygd",
}
