/**
 * Deterministisk beregning, tolkning og notatformatering for kliniske verktøy.
 *
 * All poengsummering skjer her — aldri i språkmodellen. Funksjonene er rene og
 * uten sideeffekter, slik at de kan kjøres både i UI-et og som selvtest mot
 * referansekasus (`kjorTestkasus`).
 */

import type {
  Delscore,
  Felt,
  Funnverdi,
  Side,
  Svarverdi,
  Terskel,
  Verktoy,
  VerktoyResultat,
} from "./typer"

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
  stil: "full" | "poeng" | "tekst" = "full"
): string | null {
  switch (felt.type) {
    case "ja_nei":
      return verdi === true ? `${felt.kort ?? felt.sporsmal} ${felt.poeng}` : null
    case "valg": {
      if (typeof verdi !== "number") return null
      const alt = felt.alternativer[verdi]
      if (!alt) return null
      const etikett = felt.kort ?? felt.sporsmal
      if (stil === "tekst") return alt.tekst
      if (stil === "poeng") return `${etikett} ${alt.poeng}`
      return `${etikett}: ${alt.tekst} ${alt.poeng}`
    }
    case "tall":
      return typeof verdi === "number" ? `${felt.sporsmal} ${verdi} ${felt.enhet}` : null
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

/** Terskelen som dekker summen, eller null om ingen passer. */
export function finnTerskel(verktoy: Verktoy, sum: number): Terskel | null {
  return verktoy.terskler.find((t) => sum >= t.fra && sum <= t.til) ?? null
}

export interface Beregning {
  sum: number | null
  delscorer?: Delscore[]
  detaljer: string[]
  klasse: string | null
  tolkning: string | null
  farge: Terskel["farge"] | null
}

/** Beregner sum, delscorer, tolkning og notatdetaljer for et utfylt skjema. */
export function beregn(verktoy: Verktoy, svar: Record<string, Svarverdi>): Beregning {
  const detaljer: string[] = []
  const delscorer: Delscore[] = []
  let sum = 0

  for (const seksjon of verktoy.seksjoner) {
    let seksjonsSum = 0
    for (const felt of seksjon.felter) {
      const verdi = svar[felt.id] ?? null
      seksjonsSum += feltPoeng(felt, verdi)
      const detalj = feltDetalj(felt, verdi, verktoy.detaljStil)
      if (detalj) detaljer.push(detalj)
    }
    sum += seksjonsSum
    delscorer.push({ seksjon: seksjon.tittel, sum: seksjonsSum, maks: seksjon.maksPoeng })
  }

  if (verktoy.beregning.type === "ingen") {
    return { sum: null, detaljer, klasse: null, tolkning: null, farge: null }
  }

  const terskel = finnTerskel(verktoy, sum)
  return {
    sum,
    ...(verktoy.beregning.type === "sum_per_seksjon" ? { delscorer } : {}),
    detaljer,
    klasse: terskel?.klasse ?? null,
    tolkning: terskel?.tekst ?? null,
    farge: terskel?.farge ?? null,
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
    linjer.push(`${tittel}: ${resultat.sum} ${resultat.sumEtikett}${detalj}.`)
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
  } else if (resultat.sum !== null) {
    // Undersøkelser uten skår har ingen instrumentkilde å vise til — da blir
    // en «Kilde»-linje bare støy i notatet
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
}

/**
 * Kjører verktøyets referansekasus. Brukes som selvtest for at poengsummeringen
 * stemmer med instrumentets egen fasit — prosjektet har ingen testrunner.
 */
export function kjorTestkasus(verktoy: Verktoy): Testresultat[] {
  return (verktoy.testkasus ?? []).map((kasus) => {
    const svar = { ...standardSvar(verktoy), ...kasus.svar }
    const faktisk = beregn(verktoy, svar).sum
    return {
      navn: kasus.navn,
      ok: faktisk === kasus.forventetSum,
      forventet: kasus.forventetSum,
      faktisk,
    }
  })
}
