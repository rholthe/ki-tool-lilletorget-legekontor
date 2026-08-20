/**
 * Deterministisk beregning, tolkning og notatformatering for kliniske verktøy.
 *
 * All poengsummering skjer her — aldri i språkmodellen. Funksjonene er rene og
 * uten sideeffekter, slik at de kan kjøres både i UI-et og som selvtest mot
 * referansekasus (`kjorTestkasus`).
 */

import type {
  Delscore,
  DetaljStil,
  Farge,
  Felt,
  Funnverdi,
  Overstyring,
  Side,
  Svarverdi,
  Terskel,
  Verktoy,
  VerktoyResultat,
} from "./typer"
import { finnFormel } from "./formler"

export const VERKTOY_OVERSKRIFT = "--- KLINISKE VERKTØY ---"
const OCR_OVERSKRIFT_MONSTER = /^--- OCR ---$/m
const ENHVER_OVERSKRIFT_MONSTER = /^--- .+ ---$/m

const SIDE_LABEL: Record<Side, string> = {
  venstre: "venstre",
  hoyre: "høyre",
}

const FUNN_LABEL: Record<Funnverdi, string> = {
  normal: "normal",
  patologisk: "patologisk",
  ikke_utfort: "ikke utført",
}

/** Desimaltall med komma — norsk journaltekst skriver 12,5, ikke 12.5. */
export function norskTall(verdi: number): string {
  return Number.isInteger(verdi) ? String(verdi) : String(verdi).replace(".", ",")
}

/** Alle felter på tvers av seksjoner, i rekkefølge. */
export function alleFelter(verktoy: Verktoy): Felt[] {
  return verktoy.seksjoner.flatMap((s) => s.felter)
}

/** Tomt svarsett for et verktøy — brukes når skjemaet åpnes. */
export function standardSvar(verktoy: Verktoy): Record<string, Svarverdi> {
  const svar: Record<string, Svarverdi> = {}
  for (const felt of alleFelter(verktoy)) {
    svar[felt.id] = felt.type === "ja_nei" ? false : null
  }
  return svar
}

/** Poengbidraget fra ett felt. Felttyper uten poeng bidrar med 0. */
export function feltPoeng(felt: Felt, verdi: Svarverdi): number {
  switch (felt.type) {
    case "ja_nei":
      return verdi === true ? felt.poeng : 0
    case "valg": {
      if (typeof verdi !== "number") return 0
      return felt.alternativer[verdi]?.poeng ?? 0
    }
    default:
      return 0
  }
}

/**
 * Menneskelesbart bidrag fra ett felt, f.eks. «hypertensjon 1» eller
 * «Lachman patologisk». Returnerer null når feltet ikke skal med i notatet.
 */
export function feltDetalj(
  felt: Felt,
  verdi: Svarverdi,
  stil: DetaljStil = "full"
): string | null {
  switch (felt.type) {
    case "ja_nei": {
      if (verdi !== true) return null
      const etikett = felt.kort ?? felt.sporsmal
      return stil === "uten_poeng" ? etikett : `${etikett} ${felt.poeng}`
    }
    case "valg": {
      if (typeof verdi !== "number") return null
      const alt = felt.alternativer[verdi]
      if (!alt) return null
      const etikett = felt.kort ?? felt.sporsmal
      if (stil === "tekst") return alt.tekst
      if (stil === "poeng") return `${etikett} ${alt.poeng}`
      if (stil === "uten_poeng") return `${etikett}: ${alt.tekst}`
      return `${etikett}: ${alt.tekst} ${alt.poeng}`
    }
    case "tall":
      return typeof verdi === "number"
        ? `${felt.kort ?? felt.sporsmal} ${norskTall(verdi)} ${felt.enhet}`
        : null
    case "funn": {
      if (typeof verdi !== "string" || verdi === "ikke_utfort") return null
      return `${felt.kort ?? felt.test} ${FUNN_LABEL[verdi as Funnverdi] ?? verdi}`
    }
    case "fritekst":
      return typeof verdi === "string" && verdi.trim() ? `${felt.sporsmal}: ${verdi.trim()}` : null
  }
}

/**
 * Id-ene til `valg`-felter som ikke er besvart.
 *
 * En delvis utfylt skala gir en totalsum som ser gyldig ut, men er for lav — et
 * MADRS med tre besvarte ledd ville landet i «ingen depresjon». Modalen bruker
 * dette til å blokkere lagring til alle leddene er skåret.
 */
export function ubesvarteValg(
  verktoy: Verktoy,
  svar: Record<string, Svarverdi>
): string[] {
  return alleFelter(verktoy)
    .filter((f) => f.type === "valg" && typeof svar[f.id] !== "number")
    .map((f) => f.id)
}

/**
 * Terskelen som dekker summen, eller null om ingen passer.
 *
 * En terskel kan i tillegg ha en `betingelse` på et annet felt — NORRISK 2 har
 * aldersbåndede grenser, der 9 % er «lav» hos en 70-åring og «høy» hos en
 * 50-åring. Første terskel som matcher både sum og betingelse vinner, som i
 * kildens egen tabell.
 */
export function finnTerskel(
  verktoy: Verktoy,
  sum: number,
  svar: Record<string, Svarverdi> = {}
): Terskel | null {
  return (
    verktoy.terskler.find((t) => {
      if (sum < t.fra || sum > t.til) return false
      if (!t.betingelse) return true
      const verdi = svar[t.betingelse.felt]
      if (typeof verdi !== "number") return false
      if (t.betingelse.min !== undefined && verdi < t.betingelse.min) return false
      if (t.betingelse.maks !== undefined && verdi > t.betingelse.maks) return false
      return true
    }) ?? null
  )
}

/**
 * Regelen som slår ut på ett enkeltfelt uavhengig av totalsummen — den strengeste
 * av dem som er utløst. PEVS med 3 poeng på én parameter krever umiddelbart
 * legetilsyn selv når totalen bare er 3.
 */
export function finnOverstyring(
  verktoy: Verktoy,
  hoyesteFeltPoeng: number
): Overstyring | null {
  const utlost = (verktoy.overstyringer ?? []).filter((o) => hoyesteFeltPoeng >= o.poeng)
  if (utlost.length === 0) return null
  return utlost.reduce((a, b) => (b.poeng > a.poeng ? b : a))
}

export interface Beregning {
  sum: number | null
  delscorer?: Delscore[]
  detaljer: string[]
  klasse: string | null
  tolkning: string | null
  farge: Farge | null
  /** Satt når en `overstyring` bestemte tolkningen i stedet for terskeltabellen. */
  overstyrt?: boolean
}

/** Beregner sum, delscorer, tolkning og notatdetaljer for et utfylt skjema. */
export function beregn(verktoy: Verktoy, svar: Record<string, Svarverdi>): Beregning {
  const detaljer: string[] = []
  const delscorer: Delscore[] = []
  let sum = 0
  let hoyesteFeltPoeng = 0

  for (const seksjon of verktoy.seksjoner) {
    let seksjonsSum = 0
    for (const felt of seksjon.felter) {
      const verdi = svar[felt.id] ?? null
      const poeng = feltPoeng(felt, verdi)
      seksjonsSum += poeng
      if (poeng > hoyesteFeltPoeng) hoyesteFeltPoeng = poeng
      const detalj = feltDetalj(felt, verdi, felt.detaljStil ?? verktoy.detaljStil)
      if (detalj) detaljer.push(detalj)
    }
    sum += seksjonsSum
    delscorer.push({ seksjon: seksjon.tittel, sum: seksjonsSum, maks: seksjon.maksPoeng })
  }

  if (verktoy.beregning.type === "ingen") {
    return { sum: null, detaljer, klasse: null, tolkning: null, farge: null }
  }

  // Formelverktøy summerer ikke ledd — resultatet kommer fra en navngitt
  // funksjon i `formler.ts`, og er null til alle inndata er gyldige
  if (verktoy.beregning.type === "formel") {
    const formel = finnFormel(verktoy.beregning.formelId)
    const rå = formel ? formel(svar) : null
    if (rå === null) {
      return { sum: null, detaljer, klasse: null, tolkning: null, farge: null }
    }
    const desimaler = verktoy.beregning.desimaler ?? 1
    const verdi = Number(rå.toFixed(desimaler))
    const t = finnTerskel(verktoy, verdi, svar)
    return {
      sum: verdi,
      detaljer,
      klasse: t?.klasse ?? null,
      tolkning: t?.tekst ?? null,
      farge: t?.farge ?? null,
    }
  }

  // Kilden kan oppgi et tak selv om leddene til sammen kan gi mer — PEVS har
  // maks 9 poeng, men tilleggspoengene kan løfte råsummen over det
  const kappet =
    verktoy.beregning.maks !== undefined ? Math.min(sum, verktoy.beregning.maks) : sum

  const terskel = finnTerskel(verktoy, kappet, svar)
  const overstyring = finnOverstyring(verktoy, hoyesteFeltPoeng)

  return {
    sum: kappet,
    ...(verktoy.beregning.type === "sum_per_seksjon" ? { delscorer } : {}),
    detaljer,
    klasse: overstyring?.klasse ?? terskel?.klasse ?? null,
    tolkning: overstyring?.tekst ?? terskel?.tekst ?? null,
    farge: overstyring?.farge ?? terskel?.farge ?? null,
    ...(overstyring ? { overstyrt: true } : {}),
  }
}

/** Bygger et lagringsklart resultat fra et utfylt skjema. */
export function byggResultat(
  verktoy: Verktoy,
  svar: Record<string, Svarverdi>,
  opts: { id: string; side?: Side; aiForhandsutfylt?: boolean; bekreftet?: boolean }
): VerktoyResultat {
  const b = beregn(verktoy, svar)
  return {
    id: opts.id,
    verktoyId: verktoy.id,
    navn: verktoy.navn,
    notatTittel: verktoy.notatTittel,
    ...(opts.side ? { side: opts.side } : {}),
    svar,
    sum: b.sum,
    sumEtikett: verktoy.sumEtikett ?? "poeng",
    ...(b.delscorer ? { delscorer: b.delscorer } : {}),
    detaljer: b.detaljer,
    klasse: b.klasse,
    tolkning: b.tolkning,
    kilde: verktoy.kilde.versjon
      ? `${verktoy.kilde.navn} ${verktoy.kilde.versjon}`
      : verktoy.kilde.navn,
    utfortAt: Date.now(),
    aiForhandsutfylt: opts.aiForhandsutfylt ?? false,
    bekreftet: opts.bekreftet ?? true,
  }
}

function utenPunktum(tekst: string): string {
  return tekst.trim().replace(/\.+$/, "")
}

/**
 * Ett resultat som ren tekst — ingen markdown, i tråd med formatkravet for
 * notater (stjerner og `#` vises bokstavelig i notatfeltet).
 */
export function formaterTilNotat(resultat: VerktoyResultat): string {
  const tittel = resultat.side
    ? `${resultat.notatTittel} ${SIDE_LABEL[resultat.side]}`
    : resultat.notatTittel

  const linjer: string[] = []

  if (resultat.sum !== null) {
    const detalj = resultat.detaljer.length > 0 ? ` (${resultat.detaljer.join(", ")})` : ""
    linjer.push(`${tittel}: ${norskTall(resultat.sum)} ${resultat.sumEtikett}${detalj}.`)
  } else if (resultat.detaljer.length > 0) {
    linjer.push(`${tittel}: ${resultat.detaljer.join(", ")}.`)
  } else {
    linjer.push(`${tittel}: ingen funn registrert.`)
  }

  if (resultat.delscorer && resultat.delscorer.length > 0) {
    const deler = resultat.delscorer.map((d) =>
      d.maks !== undefined ? `${d.seksjon} ${d.sum}/${d.maks}` : `${d.seksjon} ${d.sum}`
    )
    linjer.push(`Delskårer: ${deler.join(", ")}.`)
  }

  if (resultat.tolkning) {
    linjer.push(`Tolkning: ${utenPunktum(resultat.tolkning)}. Kilde: ${resultat.kilde}.`)
  } else if (resultat.sum !== null || resultat.visKilde) {
    // Undersøkelser uten skår har ingen instrumentkilde å vise til — da blir
    // en «Kilde»-linje bare støy i notatet. Retningslinjeoppslag setter
    // `visKilde`, siden det er nettopp kilden som gir anbefalingen tyngde
    linjer.push(`Kilde: ${resultat.kilde}.`)
  }

  return linjer.join("\n")
}

/** Hele verktøyseksjonen som ren tekst, uten omkringliggende notat. */
export function byggVerktoySeksjon(resultater: VerktoyResultat[]): string {
  const blokker = resultater
    .slice()
    .sort((a, b) => a.utfortAt - b.utfortAt)
    .map(formaterTilNotat)
  return [VERKTOY_OVERSKRIFT, ...blokker].join("\n")
}

/** Fjerner en eksisterende verktøyseksjon fra notatet (fram til neste overskrift). */
function fjernVerktoySeksjon(notat: string): string {
  const start = notat.indexOf(VERKTOY_OVERSKRIFT)
  if (start === -1) return notat

  const etter = notat.slice(start + VERKTOY_OVERSKRIFT.length)
  const neste = etter.search(ENHVER_OVERSKRIFT_MONSTER)
  const rest = neste === -1 ? "" : etter.slice(neste)
  return notat.slice(0, start) + rest
}

/**
 * Skriver verktøyseksjonen inn i notatet — idempotent, så gjentatte kall (og
 * regenerering av notatet) gir aldri duplikater.
 *
 * Seksjonen plasseres foran `--- OCR ---` når den finnes, siden OCR-teksten er
 * promptet til å ligge sist (se `src/lib/vedlegg.ts`).
 */
export function synkVerktoySeksjon(
  notat: string,
  resultater: VerktoyResultat[]
): string {
  const ren = fjernVerktoySeksjon(notat)

  if (resultater.length === 0) return ren.trimEnd()

  const blokk = byggVerktoySeksjon(resultater)
  const ocr = ren.search(OCR_OVERSKRIFT_MONSTER)

  if (ocr !== -1) {
    const foran = ren.slice(0, ocr).trimEnd()
    const bak = ren.slice(ocr)
    return foran ? `${foran}\n\n${blokk}\n\n${bak}` : `${blokk}\n\n${bak}`
  }

  const foran = ren.trimEnd()
  return foran ? `${foran}\n\n${blokk}` : blokk
}

export interface Testresultat {
  navn: string
  ok: boolean
  forventet: number
  faktisk: number | null
  forventetKlasse?: string
  faktiskKlasse?: string | null
}

/**
 * Kjører verktøyets referansekasus. Brukes som selvtest for at poengsummeringen
 * stemmer med instrumentets egen fasit — prosjektet har ingen testrunner.
 */
export function kjorTestkasus(verktoy: Verktoy): Testresultat[] {
  return (verktoy.testkasus ?? []).map((kasus) => {
    const svar = { ...standardSvar(verktoy), ...kasus.svar }
    const b = beregn(verktoy, svar)
    const klasseOk = kasus.forventetKlasse === undefined || b.klasse === kasus.forventetKlasse
    return {
      navn: kasus.navn,
      ok: b.sum === kasus.forventetSum && klasseOk,
      forventet: kasus.forventetSum,
      faktisk: b.sum,
      ...(kasus.forventetKlasse !== undefined
        ? { forventetKlasse: kasus.forventetKlasse, faktiskKlasse: b.klasse }
        : {}),
    }
  })
}
