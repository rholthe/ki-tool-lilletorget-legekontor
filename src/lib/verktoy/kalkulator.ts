import type {
  Felt,
  Kalkulator,
  KalkulatorResultat,
  Svarverdi,
  VerktoyResultat,
} from "./typer"
import { finnKalkulator } from "./kalkulatorer"

/**
 * Fra kalkulatoroppslag til resultat og notatlinje.
 *
 * Som retningslinjene lagres resultatet som et vanlig `VerktoyResultat` — det
 * gir persistering i IndexedDB, gjenåpning for redigering og motstand mot
 * «Regenerer» uten en egen datamodell. `sum` er null; kalkulatoren har ingen
 * poengsum, bare avledede verdier.
 */

/** Er feltet synlig med de svarene som er gitt? */
export function erSynlig(felt: Felt, svar: Record<string, Svarverdi>): boolean {
  if (!felt.synligNar) return true
  return svar[felt.synligNar.felt] === felt.synligNar.erLik
}

/** Feltene som faktisk vises, gitt gjeldende svar. */
export function synligeFelter(
  kalkulator: Kalkulator,
  svar: Record<string, Svarverdi>
): Felt[] {
  return kalkulator.seksjoner
    .flatMap((s) => s.felter)
    .filter((f) => erSynlig(f, svar))
}

export function beregnKalkulator(
  kalkulator: Kalkulator,
  svar: Record<string, Svarverdi>,
  naa?: Date
): KalkulatorResultat | null {
  const fn = finnKalkulator(kalkulator.kalkulatorId)
  return fn ? fn(svar, naa) : null
}

export function byggKalkulatorResultat(
  kalkulator: Kalkulator,
  svar: Record<string, Svarverdi>,
  resultat: KalkulatorResultat,
  opts: { id: string }
): VerktoyResultat {
  return {
    id: opts.id,
    verktoyId: kalkulator.id,
    navn: kalkulator.navn,
    notatTittel: kalkulator.notatTittel,
    svar,
    sum: null,
    sumEtikett: "",
    detaljer: resultat.notatDetaljer,
    klasse: null,
    tolkning: null,
    kilde: kalkulator.kilde.navn,
    utfortAt: Date.now(),
    aiForhandsutfylt: false,
    bekreftet: true,
  }
}
