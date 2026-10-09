/**
 * Søk i verktøylisten og nøkkelordbaserte forslag ut fra konsultasjonens innhold.
 *
 * Alt skjer lokalt — ingen AI, ingen nettverkskall, ingen ventetid.
 *
 * Retningslinjenes **tilstander** er egne treff, ikke bare retningslinjen de
 * ligger i. Legen søker etter «ørebetennelse», ikke etter «Antibiotika i
 * allmennpraksis».
 */

import type {
  Fagomrade,
  Kalkulator,
  LeseEnhet,
  LeseKapittel,
  LeseRetningslinje,
  Oppslag,
  Retningslinje,
  Tilstand,
  Verktoy,
  VerktoyKategori,
} from "./typer"
import {
  FAGOMRADER,
  FAGOMRADE_LABEL,
  INNEBYGDE_OPPSLAG,
  KATEGORI_LABEL,
  erKalkulator,
  erLeseretningslinje,
  erRetningslinje,
} from "./registry"
import { SYNONYMGRUPPER } from "./synonymer"

/**
 * Små bokstaver, uten aksenter, og med æøå brettet til ae/o/a — slik at
 * «orebetennelse» (tastatur uten æøå) og «dyspne» treffer det samme som
 * «ørebetennelse» og «dyspné». NFKD gjør også ₂ i CHA₂DS₂-VASc til 2.
 * Tegnsetting blir mellomrom, så «d-dimer» og «d dimer» er likt.
 */
export function normaliser(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/aa/g, "a")
    .replace(/oe/g, "o")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function escapeRegex(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Treff på helt ord, slik at korte nøkkelord («af», «le», «pe») ikke slår ut
 * inni andre ord. Bruker unicode-klasser så norske bokstaver teller som ordtegn.
 */
function inneholderOrd(tekst: string, ord: string): boolean {
  const monster = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegex(ord)}(?![\\p{L}\\p{N}])`,
    "iu"
  )
  return monster.test(tekst)
}

/**
 * Én rad i verktøylisten: et verktøy, en tilstand i antibiotikaretningslinjen,
 * eller en anbefaling (enhet) i en retningslinje til oppslag.
 */
export type Treff =
  | { slag: "verktoy"; verktoy: Verktoy }
  | { slag: "kalkulator"; kalkulator: Kalkulator }
  | { slag: "tilstand"; retningslinje: Retningslinje; tilstand: Tilstand }
  | { slag: "leseenhet"; retningslinje: LeseRetningslinje; enhet: LeseEnhet; kapittel: string }

export function treffId(treff: Treff): string {
  if (treff.slag === "verktoy") return treff.verktoy.id
  if (treff.slag === "kalkulator") return treff.kalkulator.id
  if (treff.slag === "leseenhet") return `${treff.retningslinje.id}:${treff.enhet.id}`
  return `${treff.retningslinje.id}:${treff.tilstand.id}`
}

/** Kategoriene i søkefilteret. */
export type SokKategori = "verktoy" | "antibiotika" | "retningslinjer" | "pakkeforlop"

export function sokKategori(t: Treff): SokKategori {
  if (t.slag === "verktoy" || t.slag === "kalkulator") return "verktoy"
  if (t.slag === "tilstand") return "antibiotika"
  return t.retningslinje.art === "forlop" ? "pakkeforlop" : "retningslinjer"
}

export function fagomraderFor(t: Treff): Fagomrade[] {
  if (t.slag === "verktoy") return t.verktoy.fagomrader
  if (t.slag === "kalkulator") return t.kalkulator.fagomrader
  // Retningslinjene til oppslag har sin egen fane, ikke plass i fagområdekortene
  if (t.slag === "leseenhet") return []
  return t.tilstand.fagomrader
}

/**
 * Alle rader ordnet etter fagområde, i `FAGOMRADE_LABEL`-rekkefølge. En rad med
 * flere fagområder står under hvert av dem; tomme områder utelates.
 */
export function grupperEtterFagomrade(
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG
): [Fagomrade, Treff[]][] {
  const alle = alleTreff(oppslag)
  return FAGOMRADER.map((f) => [f, alle.filter((t) => fagomraderFor(t).includes(f))] as [Fagomrade, Treff[]])
    .filter(([, liste]) => liste.length > 0)
}

/** Alle enheter i en retningslinje, med nærmeste kapittel som kontekst. */
export function leseenheter(retningslinje: LeseRetningslinje): Treff[] {
  const ut: Treff[] = []
  const gaa = (kapitler: LeseKapittel[]) => {
    for (const k of kapitler) {
      for (const enhet of k.enheter) ut.push({ slag: "leseenhet", retningslinje, enhet, kapittel: k.tittel })
      gaa(k.kapitler)
    }
  }
  for (const enhet of retningslinje.enheter) {
    ut.push({ slag: "leseenhet", retningslinje, enhet, kapittel: "" })
  }
  gaa(retningslinje.kapitler)
  return ut
}

/** Alle rader, uten filtrering. */
export function alleTreff(oppslag: Oppslag[] = INNEBYGDE_OPPSLAG): Treff[] {
  return oppslag.flatMap<Treff>((o) => {
    if (erLeseretningslinje(o)) return leseenheter(o)
    if (erRetningslinje(o)) {
      return o.tilstander.map((tilstand) => ({
        slag: "tilstand" as const,
        retningslinje: o,
        tilstand,
      }))
    }
    if (erKalkulator(o)) return [{ slag: "kalkulator" as const, kalkulator: o }]
    return [{ slag: "verktoy" as const, verktoy: o }]
  })
}

/** Småord som ikke skal kreves i søket («vondt i kneet»). */
const FYLLORD = new Set(["i", "og", "pa", "med", "av", "for", "til", "en", "et", "ved", "hos"])

/**
 * Antall redigeringer (innsetting, sletting, bytte, ombytting av to naboer)
 * mellom to ord. Avbryter tidlig når grensen er passert.
 */
function redigeringsavstand(a: string, b: string, grense: number): number {
  if (Math.abs(a.length - b.length) > grense) return grense + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let radMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const kost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + kost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
      radMin = Math.min(radMin, d[i][j])
    }
    if (radMin > grense) return grense + 1
  }
  return d[a.length][b.length]
}

/** Tillatte skrivefeil øker med ordlengden; korte ord må være riktige. */
function feilgrense(ord: string): number {
  if (ord.length >= 8) return 2
  if (ord.length >= 4) return 1
  return 0
}

/**
 * Hvor godt ett søkeord treffer ett felt (0 = ikke). Rangeringen:
 * helt felt > ordstart > bøyd form > inni et ord > skrivefeil.
 */
function ordPoeng(ord: string, felt: string, feltOrd: string[], tillatFeil: boolean): number {
  if (felt === ord) return 100
  if (feltOrd.includes(ord)) return 90
  if (feltOrd.some((w) => w.startsWith(ord))) return 80
  // Bøyd form: «halsbetennelsen», «kneet» — søkeordet er lengre enn feltordet
  if (ord.length >= 4 && feltOrd.some((w) => w.length >= 4 && ord.startsWith(w))) return 70
  // Inni et sammensatt ord: «betennelse» i «halsbetennelse». Ikke for korte ord,
  // ellers treffer «tia» i «visuospatial»
  if (ord.length >= 4 && felt.includes(ord)) return 60

  const grense = tillatFeil ? feilgrense(ord) : 0
  if (grense > 0) {
    for (const w of feltOrd) {
      // Også mot starten av lengre ord, så halvskrevne ord med skrivefeil treffer
      const mot = w.length > ord.length + grense ? w.slice(0, ord.length) : w
      if (redigeringsavstand(ord, mot, grense) <= grense) return 40
    }
  }
  return 0
}

interface Felt {
  tekst: string
  ord: string[]
  /**
   * Tillegg til poengsummen: navnet teller litt mer enn søkeordene, og konteksten
   * (kapittel, retningslinjens navn) mye mindre. Ellers treffer alle 20 sidene i
   * «Forebygging av hjerte- og karsykdom» like godt som CHA₂DS₂-VASc på «hjerte».
   */
  vekt: number
}

const VEKT_NAVN = 5
const VEKT_KONTEKST = -25

/** Ordet står i navnet, eller som helt ord/ordstart i et søkeord. */
const GODT_TREFF = 60
/** Under dette: bare skrivefeil eller treff inni et ord i konteksten. */
const SVAKT_TREFF = 50

function lagFelter(navn: string[], ovrige: string[], kontekst: string[] = []): Felt[] {
  const lag = (t: string, vekt: number): Felt => {
    const tekst = normaliser(t)
    return { tekst, ord: tekst.split(" ").filter(Boolean), vekt }
  }
  return [
    ...navn.map((n) => lag(n, VEKT_NAVN)),
    ...ovrige.map((o) => lag(o, 0)),
    ...kontekst.map((k) => lag(k, VEKT_KONTEKST)),
  ]
}

/**
 * Ord som lister en hel kategori. Uten «skår» ville søket bare truffet
 * «skarlagensfeber», siden å brettes til a.
 */
const KATEGORI_SOKEORD: Record<VerktoyKategori, string[]> = {
  score: [KATEGORI_LABEL.score, "skår", "score", "skala"],
  undersokelse: [KATEGORI_LABEL.undersokelse, "undersøkelse", "klinisk undersøkelse"],
  kalkulator: [KATEGORI_LABEL.kalkulator, "beregning", "kalkulere"],
  retningslinje: [KATEGORI_LABEL.retningslinje, "behandling", "behandlingsanbefaling"],
}

/** Forløpene: «pakkeforløp» og «henvisning» skal finne dem. */
const FORLOP_SOKEORD = ["pakkeforløp", "nasjonalt forløp", "henvisning", "begrunnet mistanke"]

function felterFor(t: Treff): Felt[] {
  // Fagområdet er søkbart, så «barn» eller «psykisk helse» lister hele området
  const fag = fagomraderFor(t).map((f) => FAGOMRADE_LABEL[f])
  if (t.slag === "verktoy") {
    return lagFelter(
      [t.verktoy.navn, t.verktoy.langtNavn],
      [...t.verktoy.sokeord, ...KATEGORI_SOKEORD[t.verktoy.kategori], ...fag]
    )
  }
  if (t.slag === "kalkulator") {
    return lagFelter(
      [t.kalkulator.navn, t.kalkulator.langtNavn],
      [...t.kalkulator.sokeord, ...KATEGORI_SOKEORD.kalkulator, ...fag]
    )
  }
  // Sidene i en retningslinje: tittelen er det som skiller dem. Retningslinjens navn,
  // kapittelet og typeordene («pakkeforløp») er felles for mange sider og teller lite
  if (t.slag === "leseenhet") {
    return lagFelter(
      [t.enhet.tittel],
      [],
      [
        t.kapittel,
        t.retningslinje.kortNavn,
        t.retningslinje.navn,
        ...(t.retningslinje.art === "forlop" ? FORLOP_SOKEORD : KATEGORI_SOKEORD.retningslinje),
      ]
    )
  }
  return lagFelter(
    [t.tilstand.navn],
    [...t.tilstand.sokeord, ...fag],
    [
      t.tilstand.kapittel,
      t.retningslinje.navn,
      t.retningslinje.langtNavn,
      ...t.retningslinje.sokeord,
      ...KATEGORI_SOKEORD.retningslinje,
    ]
  )
}

const NORMALISERTE_GRUPPER = SYNONYMGRUPPER.map((g) => g.map(normaliser))

/**
 * Synonymer for hele søket. Et gruppeord gjelder når søket er lik det, er
 * starten av det (fra fire bokstaver), eller er en skrivefeil av det.
 */
function synonymerFor(q: string): string[] {
  const ut = new Set<string>()
  for (const gruppe of NORMALISERTE_GRUPPER) {
    const treffer = gruppe.some(
      (term) =>
        term === q ||
        (q.length >= 4 && term.startsWith(q)) ||
        (feilgrense(q) > 0 && redigeringsavstand(q, term, feilgrense(q)) <= feilgrense(q))
    )
    if (treffer) for (const term of gruppe) if (term !== q) ut.add(term)
  }
  return [...ut]
}

/** Beste treff for ett ord mot alle feltene. */
function besteOrdPoeng(ord: string, felter: Felt[], tillatFeil: boolean): number {
  let best = 0
  for (const f of felter) {
    const p = ordPoeng(ord, f.tekst, f.ord, tillatFeil)
    if (p > 0) best = Math.max(best, Math.max(1, p + f.vekt))
  }
  return best
}

/**
 * Alle ord i søket må treffe et felt; svakeste ord bestemmer poengsummen.
 * Med synonymer kan hvert ord også treffe via sin gruppe («slapp baby» →
 * «slapt barn»), men et synonymtreff rangeres under et direkte treff.
 *
 * Skrivefeil tolereres bare i det legen faktisk skrev. Synonymene er riktig
 * stavet, og med toleranse ville «knesmerter» truffet «øresmerter».
 */
function frasePoeng(frase: string, felter: Felt[], erSynonym = false): number {
  const alle = frase.split(" ").filter(Boolean)
  const ord = alle.length > 1 ? alle.filter((o) => !FYLLORD.has(o)) : alle
  if (ord.length === 0) return 0

  let svakest = Infinity
  for (const o of ord) {
    let best = besteOrdPoeng(o, felter, !erSynonym)
    if (!erSynonym && best < 90) {
      for (const s of synonymerFor(o)) best = Math.max(best, frasePoeng(s, felter, true) * 0.85)
    }
    if (best === 0) return 0
    svakest = Math.min(svakest, best)
  }
  return svakest
}

/**
 * Fritekstsøk mot navn, langt navn og søkeord, med synonymer, bøyningsformer
 * og skrivefeil. Treffene er rangert — beste først. Uten søk returneres alle
 * rader i registerets rekkefølge.
 */
export function sokOppslag(
  sok: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG
): Treff[] {
  const q = normaliser(sok)
  const alle = alleTreff(oppslag)
  if (!q) return alle

  const synonymer = synonymerFor(q)

  const rader = alle
    .map((t, indeks) => {
      const felter = felterFor(t)
      let poeng = frasePoeng(q, felter)
      // Hele søket som synonym: «vondt i kneet» → «kne»
      for (const s of synonymer) poeng = Math.max(poeng, frasePoeng(s, felter, true) * 0.85)
      return { t, poeng, indeks }
    })
    .filter((r) => r.poeng > 0)

  // Svake treff (skrivefeil, eller ordet bare inni konteksten) tas bare med når det
  // ikke finnes gode. Ellers gir «hjerte» alle sidene om hjerneslag («hjerne»)
  const best = rader.reduce((m, r) => Math.max(m, r.poeng), 0)
  return rader
    .filter((r) => best < GODT_TREFF || r.poeng >= SVAKT_TREFF)
    .sort((a, b) => b.poeng - a.poeng || a.indeks - b.indeks)
    .map((r) => r.t)
}

export interface Forslag {
  treff: Treff
  /** Nøkkelordene som traff — vises som begrunnelse i UI-et. */
  ord: string[]
}

/**
 * Foreslår oppslag ut fra transkript/kontekst/tilleggsinfo. Rangert etter antall
 * nøkkelordtreff; oppslag uten treff utelates.
 *
 * Retningslinjens egne søkeord («antibiotika», «infeksjon») teller ikke med her —
 * de er for generelle og ville foreslått noe i annenhver konsultasjon. Kun
 * tilstandens egne nøkkelord utløser et forslag.
 */
export function foreslaaOppslag(
  tekst: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG,
  maks = 3
): Forslag[] {
  const kilde = normaliser(tekst)
  if (!kilde) return []

  return alleTreff(oppslag)
    .map((treff) => {
      // Retningslinjene til oppslag har ingen søkeord og gir ingen forslag
      const sokeord =
        treff.slag === "verktoy"
          ? treff.verktoy.sokeord
          : treff.slag === "kalkulator"
            ? treff.kalkulator.sokeord
            : treff.slag === "tilstand"
              ? treff.tilstand.sokeord
              : []
      return { treff, ord: sokeord.filter((o) => inneholderOrd(kilde, normaliser(o))) }
    })
    .filter((f) => f.ord.length > 0)
    .sort((a, b) => b.ord.length - a.ord.length)
    .slice(0, maks)
}

/** Slår opp én rad fra id-en `treffId` produserer. */
export function finnTreff(
  id: string,
  oppslag: Oppslag[] = INNEBYGDE_OPPSLAG
): Treff | undefined {
  return alleTreff(oppslag).find((t) => treffId(t) === id)
}
