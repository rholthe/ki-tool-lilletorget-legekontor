import type { KalkulatorResultat, Svarverdi } from "./typer"

/**
 * Navngitte kalkulatorer for `Kalkulator.kalkulatorId`.
 *
 * Samme prinsipp som `formler.ts`: definisjonen viser til en id og forblir ren
 * JSON, mens regnestykket ligger i git og går gjennom code review.
 *
 * **All datoregning skjer i UTC-midnatt.** Legger man dager til en lokal
 * `Date`, gir sommertid av og til 23 eller 25 timers døgn, og en termindato kan
 * bomme med én dag to ganger i året. Det er lett å overse i test og pinlig i
 * bruk.
 */

export type KalkulatorFn = (
  svar: Record<string, Svarverdi>,
  /** Referansedato for «i dag» — injiseres så selvtesten kan være deterministisk. */
  naa?: Date
) => KalkulatorResultat | null

const DOGN = 86_400_000

/**
 * Svangerskapets lengde fra første dag i siste menstruasjon, norsk konvensjon.
 *
 * Internasjonalt regnes 280 dager (40 uker) etter Naegele. Norske kalkulatorer
 * bruker 283, fordi norske data viser at median svangerskapslengde er tre dager
 * lengre. Terminen faller dermed på gestasjonsalder 40+3, ikke 40+0 — det er en
 * konsekvens av konvensjonen, ikke en feil.
 */
export const SVANGERSKAP_DAGER = 283

/** Syklusen kalkulatoren er kalibrert for. */
export const NORMAL_SYKLUS = 28

function tilDato(verdi: Svarverdi): Date | null {
  if (typeof verdi !== "string") return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(verdi.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  // Fanger 2026-02-31 og lignende: Date normaliserer i stillhet
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null
  return Number.isNaN(d.getTime()) ? null : d
}

function plussDager(dato: Date, dager: number): Date {
  return new Date(dato.getTime() + dager * DOGN)
}

function dagerMellom(fra: Date, til: Date): number {
  return Math.round((til.getTime() - fra.getTime()) / DOGN)
}

/** Dagens dato som UTC-midnatt, lest fra lokal kalender. */
export function idag(naa: Date = new Date()): Date {
  return new Date(Date.UTC(naa.getFullYear(), naa.getMonth(), naa.getDate()))
}

export function norskDato(dato: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(dato.getUTCDate())}.${p(dato.getUTCMonth() + 1)}.${dato.getUTCFullYear()}`
}

/** Gestasjonsalder som «uke+dager», norsk standardnotasjon. */
export function formaterGa(dager: number): string {
  const uker = Math.floor(dager / 7)
  const rest = dager - uker * 7
  return `${uker}+${rest}`
}

function tallVerdi(verdi: Svarverdi): number | null {
  return typeof verdi === "number" && Number.isFinite(verdi) ? verdi : null
}

/** Hvor mange dager før overføringen den «siste menstruasjonen» tilsvarer. */
const IVF_EMBRYOALDER = [2, 3, 5, 6]

/**
 * Svangerskapskalkulator.
 *
 * Alle fire inngangsveiene fastsetter én og samme størrelse — første dag i siste
 * menstruasjon. Termin og gestasjonsalder er rene avledninger av den, så
 * regnestykket er ett, ikke fire.
 *
 * Ved IVF er «siste menstruasjon» en ekvivalent, ikke en observert dato:
 * befruktningen skjer på overføringsdagen minus embryoets alder, og eggløsning
 * regnes 14 dager etter menstruasjonens første dag. Dermed er
 * `LMP = overføring − embryoalder − 14`.
 *
 * Med norsk konvensjon (283 dager) gir det termin på overføring + 264 for en
 * blastocyst på dag 5, mot + 261 internasjonalt. Samme tre dagers forskjell som
 * ellers, og valgt bevisst: ville IVF fulgt 280-dagersregelen, ville samme
 * svangerskap fått to ulike terminer avhengig av hvilken inngangsvei legen
 * brukte.
 */
const svangerskap: KalkulatorFn = (svar, naa) => {
  const modus = tallVerdi(svar.modus)
  if (modus === null) return null

  const iDag = idag(naa)
  /**
   * En lengre syklus betyr senere eggløsning, altså at svangerskapet reelt er
   * kortere enn kalenderen fra siste menstruasjon tilsier. Justeringen flytter
   * referansepunktet, og påvirker både termin og gestasjonsalder.
   */
  const syklus = tallVerdi(svar.syklus) ?? NORMAL_SYKLUS
  const justering = modus === 0 || modus === 1 ? syklus - NORMAL_SYKLUS : 0

  /** Referansepunktet all avledning skjer fra, etter syklusjustering. */
  let effektiv: Date | null = null
  let sisteMens: Date | null = null
  const opphav: string[] = []

  if (modus === 0) {
    const oppgitt = tilDato(svar.sisteMens)
    if (oppgitt) {
      sisteMens = oppgitt
      effektiv = plussDager(oppgitt, justering)
      opphav.push(`siste mens ${norskDato(oppgitt)}`)
      if (justering !== 0) opphav.push(`syklus ${syklus} dager`)
    }
  } else if (modus === 1) {
    const termin = tilDato(svar.termin)
    if (termin) {
      effektiv = plussDager(termin, -SVANGERSKAP_DAGER)
      sisteMens = plussDager(effektiv, -justering)
      opphav.push(`oppgitt termin ${norskDato(termin)}`)
      if (justering !== 0) opphav.push(`syklus ${syklus} dager`)
    }
  } else if (modus === 2) {
    const uker = tallVerdi(svar.gaUker)
    const dager = tallVerdi(svar.gaDager) ?? 0
    if (uker === null || uker < 0 || uker > 45 || dager < 0 || dager > 6) return null
    // Referansedatoen er valgfri: en ultralyd tatt for en uke siden oppgir
    // gestasjonsalder på undersøkelsesdagen, ikke i dag
    const referanse = tilDato(svar.gaDato) ?? iDag
    effektiv = plussDager(referanse, -(uker * 7 + dager))
    sisteMens = effektiv
    opphav.push(
      `gestasjonsalder ${formaterGa(uker * 7 + dager)} den ${norskDato(referanse)}`
    )
  } else if (modus === 3) {
    const overforing = tilDato(svar.ivfDato)
    const embryoIdx = tallVerdi(svar.ivfEmbryo)
    if (overforing && embryoIdx !== null && IVF_EMBRYOALDER[embryoIdx] !== undefined) {
      const alder = IVF_EMBRYOALDER[embryoIdx]
      effektiv = plussDager(overforing, -(alder + 14))
      sisteMens = effektiv
      // «IVF med embryo …», ikke «IVF, embryo …»: notatlinjen skiller
      // bidragene med komma, og to kommaer på rad leser tvetydig
      opphav.push(`IVF med embryo dag ${alder} overført ${norskDato(overforing)}`)
    }
  }

  if (!effektiv || !sisteMens) return null

  const termin = plussDager(effektiv, SVANGERSKAP_DAGER)
  const gaDager = dagerMellom(effektiv, iDag)
  const tilTermin = dagerMellom(iDag, termin)

  const gaTekst =
    gaDager < 0
      ? "svangerskapet har ikke startet på denne datoen"
      : formaterGa(gaDager)

  const linjer: KalkulatorResultat["linjer"] = [
    { etikett: "Termin", verdi: norskDato(termin), uthevet: true },
    {
      etikett: modus === 3 ? "Tilsvarende siste menstruasjon" : "Siste menstruasjon",
      verdi: norskDato(sisteMens),
      merknad: modus === 3 ? "beregnet ekvivalent, ikke en observert dato" : undefined,
    },
    {
      etikett: `Gestasjonsalder i dag (${norskDato(iDag)})`,
      verdi: gaTekst,
      uthevet: true,
      merknad:
        gaDager >= 0
          ? tilTermin >= 0
            ? `${tilTermin} dager til termin`
            : `${Math.abs(tilTermin)} dager over termin`
          : undefined,
    },
  ]

  const notatDetaljer = [
    `termin ${norskDato(termin)}`,
    ...opphav,
    gaDager >= 0
      ? `gestasjonsalder ${formaterGa(gaDager)} per ${norskDato(iDag)}`
      : `termin ligger fram i tid per ${norskDato(iDag)}`,
  ]

  return { linjer, notatDetaljer }
}

export const KALKULATORER: Record<string, KalkulatorFn> = {
  svangerskap,
}

export function finnKalkulator(id: string): KalkulatorFn | undefined {
  return KALKULATORER[id]
}
