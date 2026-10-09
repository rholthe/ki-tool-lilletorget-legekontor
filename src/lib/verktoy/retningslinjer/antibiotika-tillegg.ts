import type { Fagomrade } from "../typer"

/**
 * Det API-et ikke vet: hvor tilstandene hører hjemme i oversikten, og hvilke
 * ord legen søker etter. Selve innholdet — indikasjon, preparater, doser —
 * kommer fra Helsedirektoratet og ligger ikke her.
 *
 * Nøkkelen er API-ets `infoId`, ikke URL-sluggen: sluggen er feil for enkelte
 * tilstander («Akutt cystitt hos barn» har sluggen til asymptomatisk bakteriuri)
 * og kan bli rettet. Navnet står i kommentaren for lesbarhetens skyld.
 * Selvtesten feiler hvis en nøkkel ikke lenger finnes i reservekopien.
 */

/** Fagområde for tilstander uten egen oppføring under, ut fra kapittelet. */
export const KAPITTEL_FAGOMRADE: Record<string, Fagomrade[]> = {
  "Øyeinfeksjoner": ["oye"],
  "Øvre luftveisinfeksjoner": ["luftveier"],
  "Infeksjoner i nedre luftveier": ["luftveier"],
  "Mage-tarm-infeksjoner": ["mage_tarm"],
  "Tannhelse": ["tannhelse"],
  "Urinveisinfeksjoner": ["urinveier"],
  "Genitale infeksjoner": ["urinveier"],
  "Hud- og bløtdelsinfeksjoner": ["hud"],
  "Andre infeksjoner": ["akutt"],
}

/** Kapitler uten behandlingsanbefalinger — utelates fra oppslaget. */
export const UTELATTE_KAPITLER = [
  "Metode og prosess",
  "Antibiotikaforskrivning ved telefon- eller e-konsultasjon",
]

export interface TilstandTillegg {
  fagomrader?: Fagomrade[]
  sokeord?: string[]
}

export const TILSTAND_TILLEGG: Record<string, TilstandTillegg> = {
  // Bakteriell meningitt
  "1023e549-8b48-4df1-89dd-53ab03d76e21": {
    fagomrader: ["akutt", "nevrologi"],
    sokeord: ["meningitt", "hjernehinnebetennelse", "meningokokk", "nakkestivhet", "petekkier"],
  },
  // Borreliose – andre manifestasjoner
  "65f4a277-538a-4e57-afa0-b3f58e51d627": {
    fagomrader: ["nevrologi"],
    sokeord: ["nevroborreliose", "facialisparese", "borrelia", "flått"],
  },
  // Borreliose – erytema migrans
  "34316126-8d88-41f3-8ed0-91db40b83705": {
    fagomrader: ["hud"],
    sokeord: ["borreliose", "erytema migrans", "flåttbitt", "flått", "borrelia", "lyme", "skogflått"],
  },
  // MRSA
  "b1b59904-e76d-4de0-8e5c-899e2513b009": {
    fagomrader: ["hud"],
    sokeord: ["resistente stafylokokker"],
  },
  // Sepsis
  "69be96f4-f994-4ecb-a822-bf69c3a5c737": {
    fagomrader: ["akutt"],
    sokeord: ["sepsis", "septisk", "blodforgiftning", "news2", "alvorlig infeksjon", "prehospital antibiotika"],
  },
  // Genital klamydiainfeksjon
  "cce57fef-791e-4cb6-be57-377a1d8bbc83": {
    fagomrader: ["urinveier"],
    sokeord: ["klamydia", "chlamydia", "chlamydia trachomatis", "soi", "seksuelt overførbar", "uretritt"],
  },
  // Genital mykoplasmainfeksjon
  "176fc5dd-ce5e-4f12-8c6c-de03044eb1ec": {
    fagomrader: ["urinveier"],
    sokeord: ["mycoplasma genitalium", "genital mykoplasma", "makrolidresistens", "moksifloksacin"],
  },
  // Bittskader og infeksjon
  "8b0dbd6e-fe5d-467f-9724-e920e90cbe5d": {
    fagomrader: ["hud"],
    sokeord: ["bitt", "bittskade", "hundebitt", "kattebitt", "menneskebitt", "bittsår"],
  },
  // Erysipelas
  "35992c75-9ab5-4734-8352-436386b709d6": {
    fagomrader: ["hud"],
    sokeord: ["erysipelas", "rosen", "hudinfeksjon", "erysipelas legg"],
  },
  // Impetigo
  "08a9e109-32f2-49e2-b53c-7bfc615b33df": {
    fagomrader: ["hud", "barn"],
    sokeord: ["impetigo", "brennkopper", "sårskorper", "gule skorper"],
  },
  // Mastitt
  "b77f7d33-9526-49fd-8cff-b09f79e65ead": {
    fagomrader: ["hud", "svangerskap"],
    sokeord: ["brystbetennelse", "amming"],
  },
  // Akutt bronkitt
  "a99cf032-ef23-4c76-8e54-e0955bb981cd": {
    fagomrader: ["luftveier"],
    sokeord: ["bronkitt", "hoste", "luftveisinfeksjon", "forkjølelse"],
  },
  // Atypisk pneumoni
  "9f49f561-b782-4d0a-9e32-794e0c11e8b8": {
    fagomrader: ["luftveier"],
    sokeord: ["atypisk pneumoni", "mykoplasma", "mycoplasma pneumoniae", "chlamydia pneumoniae", "nasofarynksprøve"],
  },
  // Kols-forverring
  "a85ce4fe-0a16-4c86-a8ba-c256c048cda4": {
    fagomrader: ["luftveier"],
    sokeord: ["kols", "kolsforverring", "eksaserbasjon", "purulens", "obstruktiv lungesykdom"],
  },
  // Pneumoni
  "88c623dd-f6aa-4c02-ac05-8022fcae70c0": {
    fagomrader: ["luftveier"],
    sokeord: ["pneumoni", "lungebetennelse", "crp", "røntgen thorax", "lungeinfeksjon"],
  },
  // Pneumoni hos sykehjemspasienter
  "4f69ac4f-49fd-43dd-a10f-7168191ffd74": {
    fagomrader: ["luftveier", "geriatri"],
    sokeord: ["sykehjem", "lungebetennelse sykehjem"],
  },
  // Dyspepsi og Helicobacter pylori-infeksjon
  "c272e1ab-8c94-4bfb-8aed-388218f0700f": {
    fagomrader: ["mage_tarm"],
    sokeord: ["helicobacter", "magesår", "h pylori"],
  },
  // Akutt bakteriell prostatitt
  "34c50d2b-0dac-4ecf-8e43-a777292df233": {
    fagomrader: ["urinveier"],
    sokeord: ["prostatabetennelse"],
  },
  // Akutt cystitt hos barn
  "ffd36d18-9f48-46e3-bcf7-dad937f42956": {
    fagomrader: ["urinveier", "barn"],
    sokeord: ["uvi barn", "urinveisinfeksjon barn"],
  },
  // Akutt cystitt hos ikke-gravid kvinne uten kompliserende forhold
  "e9f00979-b855-4652-b4a0-3e5ba0f653aa": {
    fagomrader: ["urinveier"],
    sokeord: ["cystitt", "blærekatarr", "urinveisinfeksjon", "uvi", "svie ved vannlating", "dysuri"],
  },
  // Akutt cystitt hos menn, gravide og kvinner med kompliserende forhold
  "661f17e4-aa34-40b1-84db-3f9668508700": {
    fagomrader: ["urinveier", "svangerskap"],
    sokeord: ["cystitt gravid", "cystitt mann", "urinveisinfeksjon gravid", "komplisert uvi"],
  },
  // Akutt cystitt hos sykehjemspasienter
  "79109078-c5c4-4b52-9ac1-f41e9235886e": {
    fagomrader: ["urinveier", "geriatri"],
    sokeord: ["sykehjem", "uvi sykehjem"],
  },
  // Pyelonefritt
  "3c8e8eb8-fd4f-474b-9ea6-e88bec98369a": {
    fagomrader: ["urinveier"],
    sokeord: ["pyelonefritt", "nyrebekkenbetennelse", "flankesmerter", "øvre urinveisinfeksjon"],
  },
  // Akutt mediaotitt
  "4cee7335-124b-47cd-9ba0-470788969408": {
    fagomrader: ["luftveier", "barn"],
    sokeord: ["otitt", "mediaotitt", "mellomørebetennelse", "ørebetennelse", "øreverk", "øresmerter", "otitis media"],
  },
  // Akutt sinusitt
  "b03ad672-0de3-4408-950d-c424a2ab6f21": {
    fagomrader: ["luftveier"],
    sokeord: ["sinusitt", "bihulebetennelse", "bihuler", "rhinosinusitt", "nesesekresjon"],
  },
  // Kikhoste
  "c69ff697-5038-48d9-a486-1f39bf46ec08": {
    fagomrader: ["luftveier", "barn"],
    sokeord: ["pertussis"],
  },
  // Streptokokkhalsinfeksjon og skarlagensfeber
  "dd48ee61-5a5f-4241-9e67-0b33a180a5f5": {
    fagomrader: ["luftveier"],
    sokeord: ["halsbetennelse", "tonsillitt", "streptokokker", "gas", "skarlagensfeber", "sår hals", "halsinfeksjon", "centor", "strep a"],
  },
  // Herpes zoster ophtalmicus (helvetesild)
  "f10d492e-2ce6-467c-82bd-717e0c85c483": {
    fagomrader: ["oye"],
    sokeord: ["helvetesild", "zoster"],
  },
}

/** Retningslinjens egne søkeord. Teller ikke i forslagene — de er for generelle. */
export const RETNINGSLINJE_SOKEORD = [
  "antibiotika",
  "antibiotikum",
  "infeksjon",
  "penicillin",
  "resistens",
  "retningslinje",
  "antibiotikabruk",
]
