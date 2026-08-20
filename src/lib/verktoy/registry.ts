import type { Verktoy, VerktoyKategori } from "./typer"
import { CHADSVASC } from "./definisjoner/chadsvasc"
import { QSOFA } from "./definisjoner/qsofa"
import { PEVS } from "./definisjoner/pevs"
import { WELLS_DVT } from "./definisjoner/wells-dvt"
import { WELLS_LE } from "./definisjoner/wells-le"
import { MADRS } from "./definisjoner/madrs"
import { KLOKKETEST } from "./definisjoner/klokketest"
import { KNEUNDERSOKELSE } from "./definisjoner/kne"
import { SKULDERUNDERSOKELSE } from "./definisjoner/skulder"

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
  WELLS_DVT,
  WELLS_LE,
  MADRS,
  KLOKKETEST,
  KNEUNDERSOKELSE,
  SKULDERUNDERSOKELSE,
]

export const KATEGORI_LABEL: Record<VerktoyKategori, string> = {
  score: "Skåringsverktøy",
  undersokelse: "Strukturert undersøkelse",
  kalkulator: "Kalkulator",
  retningslinje: "Retningslinje",
}

export function finnVerktoy(id: string, verktoy: Verktoy[] = INNEBYGDE_VERKTOY): Verktoy | undefined {
  return verktoy.find((v) => v.id === id)
}
