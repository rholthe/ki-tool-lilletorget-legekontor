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

/** Én behandlingslinje som lesbar tekst, med kombinasjonspreparater og merknad. */
export function anbefalingTilTekst(anbefaling: Anbefaling): string {
  const hoved = `${anbefaling.legemiddel} ${anbefaling.administrasjon} ${anbefaling.dose}`
  const tillegg = (anbefaling.iTillegg ?? []).map(
    (t) => ` + ${t.legemiddel} ${t.administrasjon} ${t.dose}`
  )
  // Komma, ikke parentes: flere merknader inneholder allerede parenteser
  // («tabletter (erytromycinstearat)»), og nøstede parenteser leser dårlig
  const merknad = anbefaling.merknad ? `, ${anbefaling.merknad}` : ""
  return `${hoved}${tillegg.join("")}${merknad}`
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
    kilde: retningslinje.kilde.versjon
      ? `${retningslinje.kilde.navn} ${retningslinje.kilde.versjon}`
      : retningslinje.kilde.navn,
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
 * Hvor gammel verifiseringen er, i dager. Retningslinjer revideres løpende, og en
 * utdatert dose er en pasientsikkerhetsrisiko — ikke et kosmetisk etterslep.
 */
export function dagerSidenVerifisert(tilstand: Tilstand, naa = new Date()): number {
  const verifisert = new Date(tilstand.sistVerifisert)
  if (Number.isNaN(verifisert.getTime())) return Number.POSITIVE_INFINITY
  return Math.floor((naa.getTime() - verifisert.getTime()) / 86_400_000)
}

/** Over dette antallet dager viser UI-et en påminnelse om å sjekke kilden. */
export const VERIFISERING_ADVARSEL_DAGER = 180
