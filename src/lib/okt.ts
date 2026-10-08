/**
 * Øktregler (delt mellom server og klient).
 *
 * - Daglig innlogging: en økt varer maks MAKS_OKT_MS fra innlogging.
 * - Inaktivitet: uten aktivitet i INAKTIV_GRENSE_MS logges brukeren ut og
 *   konsultasjonene låses (nøkkelen finnes bare i minnet). De slettes ikke.
 * - Lukket nettleser: OKT_COOKIE er en øktcookie uten utløpsdato. Mangler den,
 *   har nettleseren vært lukket, og brukeren logges ut.
 */
export const INAKTIV_GRENSE_MS = 60 * 60 * 1000 // 1 time
export const INAKTIV_VARSEL_MS = 5 * 60 * 1000 // varsle 5 min før
export const MAKS_OKT_MS = 12 * 60 * 60 * 1000 // én arbeidsdag
export const PULS_INTERVALL_MS = 5 * 60 * 1000 // aktiv klient holder serverøkten i live
export const OKT_COOKIE = "la_okt"
/** Så lenge etter innlogging kan proxyen sette øktcookien første gang. */
export const OKT_COOKIE_FRIST_MS = 30 * 1000

export type UtloggingGrunn = "inaktiv" | "lukket" | "utlogget" | "utlopt"

export interface OktToken {
  id?: string
  oktId?: string
  innlogget?: number
  sistAktiv?: number
}

/**
 * Øktreglene for JWT-callbacken (ren funksjon, testbar). Returnerer null når
 * økten er over: dagsgrensen er nådd eller brukeren har vært inaktiv for lenge.
 */
export function fornyOktToken<T extends OktToken>(
  token: T,
  innloggetBrukerId: string | undefined,
  naa: number,
  nyOktId: () => string
): T | null {
  if (innloggetBrukerId) {
    return { ...token, id: innloggetBrukerId, oktId: nyOktId(), innlogget: naa, sistAktiv: naa }
  }
  if (!token.innlogget || naa - token.innlogget > MAKS_OKT_MS) return null
  if (!token.sistAktiv || naa - token.sistAktiv > INAKTIV_GRENSE_MS) return null
  return { ...token, sistAktiv: naa }
}
