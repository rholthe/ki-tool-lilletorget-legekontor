import type {
  Fagomrade,
  Kalkulator,
  Oppslag,
  Retningslinje,
  Verktoy,
  VerktoyKategori,
} from "./typer"
import { CHADSVASC } from "./definisjoner/chadsvasc"
import { QSOFA } from "./definisjoner/qsofa"
import { PEVS } from "./definisjoner/pevs"
import { NORRISK2 } from "./definisjoner/norrisk2"
import { WELLS_DVT } from "./definisjoner/wells-dvt"
import { WELLS_LE } from "./definisjoner/wells-le"
import { MADRS } from "./definisjoner/madrs"
import { MDI } from "./definisjoner/mdi"
import { KLOKKETEST } from "./definisjoner/klokketest"
import { KNEUNDERSOKELSE } from "./definisjoner/kne"
import { SKULDERUNDERSOKELSE } from "./definisjoner/skulder"
import { SVANGERSKAP } from "./definisjoner/svangerskap"

/**
 * Innebygde verktøy fra repoet. Definisjonene ligger i git slik at kliniske
 * terskler og poeng går gjennom code review og har sporbar historikk.
 *
 * Admin-opprettede verktøy legges senere på toppen av denne listen fra databasen,
 * etter samme mønster som `staging-registry.ts` + `staging-server.ts`.
 */
export const INNEBYGDE_VERKTOY: Verktoy[] = [
  CHADSVASC,
  QSOFA,
  PEVS,
  NORRISK2,
  WELLS_DVT,
  WELLS_LE,
  MADRS,
  MDI,
  KLOKKETEST,
  KNEUNDERSOKELSE,
  SKULDERUNDERSOKELSE,
]

/** Kalkulatorer med flere inngangsveier og flere utdata. */
export const INNEBYGDE_KALKULATORER: Kalkulator[] = [SVANGERSKAP]

/**
 * Det som ligger i koden. Retningslinjene hentes fra Helsedirektoratets API og
 * lastes i tillegg (`useRetningslinjer`), så funksjonene under tar listen som
 * parameter.
 */
export const INNEBYGDE_OPPSLAG: Oppslag[] = [...INNEBYGDE_VERKTOY, ...INNEBYGDE_KALKULATORER]

export const KATEGORI_LABEL: Record<VerktoyKategori, string> = {
  score: "Skåringsverktøy",
  undersokelse: "Strukturert undersøkelse",
  kalkulator: "Kalkulator",
  retningslinje: "Retningslinje",
}

/** Rekkefølgen her er rekkefølgen i oversikten. */
export const FAGOMRADE_LABEL: Record<Fagomrade, string> = {
  akutt: "Akuttmedisin",
  barn: "Barn",
  hjerte_kar: "Hjerte og kar",
  luftveier: "Luftveier og ØNH",
  urinveier: "Urinveier og seksuell helse",
  hud: "Hud og bløtvev",
  muskel_skjelett: "Muskel og skjelett",
  psykisk_helse: "Psykisk helse",
  nevrologi: "Nevrologi og kognisjon",
  geriatri: "Geriatri",
  svangerskap: "Svangerskap",
  oye: "Øye",
  mage_tarm: "Mage og tarm",
  tannhelse: "Tannhelse",
}

export const FAGOMRADER = Object.keys(FAGOMRADE_LABEL) as Fagomrade[]

export function erRetningslinje(oppslag: Oppslag): oppslag is Retningslinje {
  return oppslag.kategori === "retningslinje"
}

/**
 * NORRISK 2 har også `kategori: "kalkulator"`, men er et `Verktoy`. Det er
 * `kalkulatorId` som skiller typen, ikke kategorien — kategorien styrer bare
 * hvilken overskrift oppslaget havner under i listen.
 */
export function erKalkulator(oppslag: Oppslag): oppslag is Kalkulator {
  return "kalkulatorId" in oppslag
}

export function finnOppslag(
  id: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG
): Oppslag | undefined {
  return oppslag.find((o) => o.id === id)
}

export function finnVerktoy(id: string, verktoy: Verktoy[] = INNEBYGDE_VERKTOY): Verktoy | undefined {
  return verktoy.find((v) => v.id === id)
}
