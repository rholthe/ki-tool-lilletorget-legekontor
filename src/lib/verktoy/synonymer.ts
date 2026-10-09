/**
 * Synonymgrupper for fritekstsøket i verktøylisten.
 *
 * Hver gruppe er ord legen kan tenkes å skrive om samme ting — fagterm,
 * folkelig ord og forkortelse. Søker legen på ett av dem, søkes det også på
 * de andre. Gruppene er bevisst brede: et ekstra treff i listen koster ingenting.
 *
 * Gjelder **kun** søkefeltet, ikke forslagene ut fra transkriptet. Der ville
 * brede ord som «trist» eller «barn» foreslått verktøy i annenhver konsultasjon.
 * Søkeord som også skal utløse forslag, hører hjemme i definisjonens `sokeord`.
 *
 * Skriv ordene slik de staves; normaliseringen (store bokstaver, æøå,
 * aksenter) skjer i `sok.ts`.
 */
export const SYNONYMGRUPPER: string[][] = [
  // Hjerte og kar
  ["atrieflimmer", "forkammerflimmer", "hjerteflimmer", "flimmer", "af", "uregelmessig puls", "arytmi"],
  ["blodfortynnende", "antikoagulasjon", "doak", "noak", "warfarin", "marevan", "apixaban", "eliquis", "rivaroksaban", "xarelto"],
  ["hjerneslag", "slag", "drypp", "tia", "apopleksi", "infarkt i hjernen"],
  ["kolesterol", "lipider", "ldl", "statin", "hjerterisiko", "kardiovaskulær risiko", "hjerteinfarkt", "forebygging"],
  ["blodpropp", "trombose", "emboli", "tromboembolisme"],
  ["dvt", "dyp venetrombose", "hoven legg", "hoven fot", "hevelse i benet", "hevelse i beinet", "vondt i leggen"],
  ["lungeemboli", "blodpropp i lungen", "pe"],
  ["tungpust", "tungpustet", "dyspné", "andpusten", "pustebesvær", "åndenød"],
  ["brystsmerter", "vondt i brystet", "trykk i brystet"],

  // Infeksjon og sepsis
  ["sepsis", "blodforgiftning", "septisk", "alvorlig infeksjon"],
  ["antibiotika", "antibiotikum", "penicillin", "antibiotikabehandling"],

  // Psykisk helse
  ["depresjon", "deprimert", "nedstemt", "nedfor", "trist", "lei seg", "motløs", "tungsinn", "stemningsleie"],
  ["selvmord", "selvmordstanker", "suicidal", "suicid", "selvmordsfare"],

  // Kognisjon
  ["demens", "alzheimer", "glemsom", "glemmer", "hukommelse", "hukommelsessvikt", "kognitiv svikt", "kognisjon"],

  // Barn
  ["barn", "sykt barn", "spedbarn", "baby", "småbarn", "nyfødt", "pediatri"],
  ["slapp", "slapt barn", "medtatt", "dårlig allmenntilstand"],

  // Svangerskap
  ["gravid", "graviditet", "svanger", "svangerskap", "termin", "termindato", "gestasjonsalder", "svangerskapsuke"],
  ["siste mens", "siste menstruasjon", "sm"],
  ["ivf", "prøverør", "assistert befruktning", "embryooverføring"],

  // Muskel og skjelett
  ["kne", "kneet", "knær", "knesmerter", "vondt i kneet", "kneskade"],
  ["korsbånd", "acl", "fremre korsbånd"],
  ["skulder", "skulderen", "skuldersmerter", "vondt i skulderen"],
  ["frozen shoulder", "frossen skulder", "adhesiv kapsulitt"],

  // Luftveier
  ["ørebetennelse", "otitt", "mediaotitt", "mellomørebetennelse", "øreverk", "vondt i øret"],
  ["bihulebetennelse", "sinusitt", "tett nese"],
  ["halsbetennelse", "sår hals", "vondt i halsen", "tonsillitt", "angina", "streptokokker", "strep"],
  ["lungebetennelse", "pneumoni", "lungeinfeksjon"],
  ["bronkitt", "hoste", "forkjølelse", "luftveisinfeksjon"],
  ["kols", "kolsforverring", "emfysem", "kronisk bronkitt"],

  // Urinveier
  ["urinveisinfeksjon", "uvi", "cystitt", "blærebetennelse", "blærekatarr", "svie ved vannlating", "svir å tisse", "dysuri"],
  ["nyrebekkenbetennelse", "pyelonefritt", "nyreinfeksjon"],

  // Hud
  ["rosen", "erysipelas", "cellulitt", "hudinfeksjon"],
  ["brennkopper", "impetigo"],
  ["bitt", "bittskade", "hundebitt", "kattebitt", "menneskebitt"],
  ["flått", "flåttbitt", "borrelia", "borreliose", "lyme", "erytema migrans", "vandrende rødme"],

  // Genitalt
  ["klamydia", "chlamydia", "soi", "kjønnssykdom", "seksuelt overførbar"],
  ["mykoplasma", "mycoplasma"],

  // Nevrologi
  ["hjernehinnebetennelse", "meningitt", "meningokokk", "nakkestivhet"],
]
