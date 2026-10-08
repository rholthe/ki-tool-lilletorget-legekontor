/**
 * Felles aktivitetssignal for innloggingsvakten (OktVakt). Tastetrykk og klikk
 * fanges automatisk; kall registrerAktivitet() der brukeren er aktiv uten å
 * røre skjermen — f.eks. under et langt opptak.
 */
export const AKTIVITET_HENDELSE = "legeassist:aktivitet"
export const SIST_AKTIV_NOKKEL = "legeassist:sist-aktiv" // delt mellom faner via localStorage

let sistSendt = 0

export function registrerAktivitet(): void {
  const naa = Date.now()
  if (naa - sistSendt < 10_000) return // nok med ett signal per 10 s
  sistSendt = naa
  window.dispatchEvent(new Event(AKTIVITET_HENDELSE))
}
