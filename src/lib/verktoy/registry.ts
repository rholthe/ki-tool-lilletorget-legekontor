import type { Oppslag, Retningslinje, Verktoy, VerktoyKategori } from "./typer"
import { CHADSVASC } from "./definisjoner/chadsvasc"
import { QSOFA } from "./definisjoner/qsofa"
import { PEVS } from "./definisjoner/pevs"
import { NORRISK2 } from "./definisjoner/norrisk2"
import { WELLS_DVT } from "./definisjoner/wells-dvt"
import { WELLS_LE } from "./definisjoner/wells-le"
import { MADRS } from "./definisjoner/madrs"
import { KLOKKETEST } from "./definisjoner/klokketest"
import { KNEUNDERSOKELSE } from "./definisjoner/kne"
import { SKULDERUNDERSOKELSE } from "./definisjoner/skulder"
import { ANTIBIOTIKA } from "./retningslinjer/antibiotika"

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
  KLOKKETEST,
  KNEUNDERSOKELSE,
  SKULDERUNDERSOKELSE,
]

/** Retningslinjer legen slår opp i, til forskjell fra skjemaer hun fyller ut. */
export const INNEBYGDE_RETNINGSLINJER: Retningslinje[] = [ANTIBIOTIKA]

/** Alt som kan velges i verktøymodalen. */
export const INNEBYGDE_OPPSLAG: Oppslag[] = [
  ...INNEBYGDE_VERKTOY,
  ...INNEBYGDE_RETNINGSLINJER,
]

export const KATEGORI_LABEL: Record<VerktoyKategori, string> = {
  score: "Skåringsverktøy",
  undersokelse: "Strukturert undersøkelse",
  kalkulator: "Kalkulator",
  retningslinje: "Retningslinje",
}

export function erRetningslinje(oppslag: Oppslag): oppslag is Retningslinje {
  return oppslag.kategori === "retningslinje"
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

export function finnRetningslinje(
  id: string,
  retningslinjer: Retningslinje[] = INNEBYGDE_RETNINGSLINJER
): Retningslinje | undefined {
  return retningslinjer.find((r) => r.id === id)
}
