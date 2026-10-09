import type {
  Anbefaling,
  Retningslinje,
  Tilstand,
  VerktoyResultat,
} from "./typer"

/**
 * Fra retningslinjeoppslag til notatlinje.
 *
 * Resultatet lagres som et `VerktoyResultat`, samme form som skåringsverktøyene.
 * Det gir gratis persistering i IndexedDB, gjenåpning for redigering, og at
 * seksjonen overlever «Regenerer» — uten en egen datamodell.
 *
 * Teksten settes inn ordrett av koden. Doser går aldri gjennom språkmodellen:
 * en omskrevet «660 mg x 4» ville vært like usynlig i en velformulert setning
 * som en feilsummert skår.
 */

/** Velges når legen vil journalføre at antibiotika ikke er indisert. */
export const INGEN_BEHANDLING = "__ingen__"

/**
 * Én behandlingslinje som lesbar tekst: kildens visningstekst ordrett, med
 * «+» mellom preparatene ved kombinasjonsbehandling.
 */
export function anbefalingTilTekst(anbefaling: Anbefaling): string {
  return anbefaling.regimer.join(" + ")
}

/** «05.07.2026» — tom streng hvis datoen mangler eller er ugyldig. */
export function norskDato(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function utenPunktum(tekst: string): string {
  return tekst.trim().replace(/\.+$/, "")
}

export function byggRetningslinjeResultat(
  retningslinje: Retningslinje,
  tilstand: Tilstand,
  valgte: string[],
  opts: { id: string }
): VerktoyResultat {
  const detaljer: string[] = []

  if (valgte.includes(INGEN_BEHANDLING)) {
    detaljer.push("ikke indisert")
  } else {
    for (const id of valgte) {
      const anbefaling = tilstand.anbefalinger.find((a) => a.id === id)
      if (!anbefaling) continue
      detaljer.push(`${anbefalingTilTekst(anbefaling)} — ${anbefaling.etikett}`)
    }
    if (detaljer.length > 0 && tilstand.varighet) {
      detaljer.push(`behandlingsvarighet ${utenPunktum(tilstand.varighet)}`)
    }
  }

  return {
    id: opts.id,
    verktoyId: retningslinje.id,
    navn: tilstand.navn,
    notatTittel: `Antibiotika (${tilstand.navn.toLowerCase()})`,
    svar: { tilstand: tilstand.id, valgte: valgte.join(",") },
    sum: null,
    sumEtikett: "poeng",
    detaljer,
    klasse: null,
    tolkning: null,
    // Kildeangivelse etter NLOD: Helsedirektoratet, retningslinjen og datoen
    // for siste faglige endring av tilstanden legen faktisk slo opp i
    kilde: [
      `${retningslinje.kilde.navn}, ${retningslinje.langtNavn}`,
      norskDato(tilstand.sistFagligOppdatert) &&
        `(faglig oppdatert ${norskDato(tilstand.sistFagligOppdatert)})`,
    ]
      .filter(Boolean)
      .join(" "),
    // Undersøkelser dropper kildelinjen bevisst, men for et retningslinjeoppslag
    // er provenienser hele poenget — legen må kunne se hva anbefalingen bygger på
    visKilde: true,
    utfortAt: Date.now(),
    aiForhandsutfylt: false,
    bekreftet: true,
  }
}

/** Leser tilbake hvilken tilstand og hvilke linjer et lagret resultat gjelder. */
export function lesRetningslinjeValg(resultat: VerktoyResultat): {
  tilstandId: string
  valgte: string[]
} {
  const tilstandId = typeof resultat.svar.tilstand === "string" ? resultat.svar.tilstand : ""
  const rå = typeof resultat.svar.valgte === "string" ? resultat.svar.valgte : ""
  return { tilstandId, valgte: rå ? rå.split(",") : [] }
}

/**
 * Dager siden innholdet sist ble hentet fra kilden. Serveren henter daglig, så
 * et høyt tall betyr at hentingen har feilet en stund — da kan en dose ha
 * endret seg uten at vi vet det.
 */
export function dagerSidenHentet(retningslinje: Retningslinje, naa = new Date()): number {
  const hentet = new Date(retningslinje.hentetAt)
  if (Number.isNaN(hentet.getTime())) return Number.POSITIVE_INFINITY
  return Math.floor((naa.getTime() - hentet.getTime()) / 86_400_000)
}

/** Over dette antallet dager viser UI-et en advarsel om at innholdet kan være utdatert. */
export const HENTING_ADVARSEL_DAGER = 7
