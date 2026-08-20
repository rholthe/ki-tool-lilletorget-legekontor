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

/** Svangerskapets lengde fra første dag i siste menstruasjon. */
export const SVANGERSKAP_DAGER = 280

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
 * `LMP = overføring − embryoalder − 14`, som gir termin på overføring + 261 for
 * en blastocyst på dag 5 og + 263 for et embryo på dag 3 — de publiserte
 * verdiene.
 */
const svangerskap: KalkulatorFn = (svar, naa) => {
  const modus = tallVerdi(svar.modus)
  if (modus === null) return null

  const iDag = idag(naa)
  let sisteMens: Date | null = null
  const opphav: string[] = []

  if (modus === 0) {
    sisteMens = tilDato(svar.sisteMens)
    if (sisteMens) opphav.push(`siste mens ${norskDato(sisteMens)}`)
  } else if (modus === 1) {
    const termin = tilDato(svar.termin)
    if (termin) {
      sisteMens = plussDager(termin, -SVANGERSKAP_DAGER)
      opphav.push(`oppgitt termin ${norskDato(termin)}`)
    }
  } else if (modus === 2) {
    const uker = tallVerdi(svar.gaUker)
    const dager = tallVerdi(svar.gaDager) ?? 0
    if (uker === null || uker < 0 || uker > 45 || dager < 0 || dager > 6) return null
    // Referansedatoen er valgfri: en ultralyd tatt for en uke siden oppgir
    // gestasjonsalder på undersøkelsesdagen, ikke i dag
    const referanse = tilDato(svar.gaDato) ?? iDag
    sisteMens = plussDager(referanse, -(uker * 7 + dager))
    opphav.push(
      `gestasjonsalder ${formaterGa(uker * 7 + dager)} den ${norskDato(referanse)}`
    )
  } else if (modus === 3) {
    const overforing = tilDato(svar.ivfDato)
    const embryoIdx = tallVerdi(svar.ivfEmbryo)
    if (overforing && embryoIdx !== null && IVF_EMBRYOALDER[embryoIdx] !== undefined) {
      const alder = IVF_EMBRYOALDER[embryoIdx]
      sisteMens = plussDager(overforing, -(alder + 14))
      // «IVF med embryo …», ikke «IVF, embryo …»: notatlinjen skiller
      // bidragene med komma, og to kommaer på rad leser tvetydig
      opphav.push(`IVF med embryo dag ${alder} overført ${norskDato(overforing)}`)
    }
  }

  if (!sisteMens) return null

  const termin = plussDager(sisteMens, SVANGERSKAP_DAGER)
  const gaDager = dagerMellom(sisteMens, iDag)
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
