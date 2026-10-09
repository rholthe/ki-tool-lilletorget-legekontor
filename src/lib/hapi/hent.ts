/**
 * Henting fra Helsedirektoratets API (HAPI, https://utvikler.helsedirektoratet.no).
 *
 * Ren modul uten Next-avhengigheter: nøkkelen sendes inn, så samme kode brukes
 * av serveren (`retningslinjer-server.ts`) og av skriptet som lager
 * reservekopien. Innholdet er offentlig og lisensiert under NLOD — ingen
 * pasientdata går denne veien.
 *
 * Bruk alltid produksjons-API-et. QA-miljøet (`api-qa.`) har testdata og
 * utdaterte doser.
 */

export const HAPI_BASE = "https://api.helsedirektoratet.no"

export interface HapiLenke {
  rel: string
  type: string
  tittel?: string | null
  href: string
}

/** Feltene vi bruker. API-et har mange flere. */
export interface HapiNode {
  id: string
  tittel: string
  tekst?: string | null
  sistFagligOppdatert?: string | null
  url?: string | null
  tekniskeData: { infoId: string; infoType: string }
  links?: HapiLenke[]
  // Innholdstypespesifikt og dypt nøstet — tolkes av den som bruker det
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

export interface HapiKapittel {
  node: HapiNode
  /** Normerende enheter under kapittelet, også fra underkapitler. */
  enheter: HapiNode[]
}

export interface HapiTre {
  rot: HapiNode
  kapitler: HapiKapittel[]
}

export interface HentValg {
  nokkel: string
  base?: string
  /** Samtidige forespørsler. Tempoet styres uansett av `MELLOMROM_MS`. */
  samtidige?: number
  tidsavbruddMs?: number
}

/**
 * API-et har en kvote på omtrent 1000 kall i minuttet per nøkkel, og svarer 429
 * med `Retry-After` når den er brukt opp. En full oppdatering er over 1500 kall,
 * så alle kall går med fast mellomrom — felles for alle hentinger i prosessen.
 */
const MELLOMROM_MS = 200
const MAKS_FORSOK_429 = 5
let nesteLedige = 0

const vent = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function iTur(): Promise<void> {
  const naa = Date.now()
  const min = Math.max(naa, nesteLedige)
  nesteLedige = min + MELLOMROM_MS
  if (min > naa) await vent(min - naa)
}

/**
 * Henter én node. Returnerer null ved 204 (No Content): noen forløp lenker til
 * enheter som ikke er publisert. Treet hopper over dem i stedet for å feile.
 */
async function hentValgfri(sti: string, valg: HentValg): Promise<HapiNode | null> {
  const base = valg.base ?? HAPI_BASE
  const url = sti.startsWith("http") ? sti : `${base}${sti}`
  if (!url.startsWith(base)) throw new Error(`Uventet adresse utenfor HAPI: ${url}`)

  for (let forsok = 1; ; forsok++) {
    await iTur()
    const svar = await fetch(url, {
      headers: { "Ocp-Apim-Subscription-Key": valg.nokkel, Accept: "application/json" },
      signal: AbortSignal.timeout(valg.tidsavbruddMs ?? 30_000),
    })
    if (svar.status === 429 && forsok < MAKS_FORSOK_429) {
      // Vent så lenge API-et ber om, og hold igjen alle andre kall like lenge
      const sek = Number(svar.headers.get("Retry-After")) || 30
      const ms = (sek + 1) * 1000
      nesteLedige = Math.max(nesteLedige, Date.now() + ms)
      await vent(ms)
      continue
    }
    if (svar.status === 204) return null
    if (!svar.ok) throw new Error(`HAPI svarte ${svar.status} for ${sti}`)
    return (await svar.json()) as HapiNode
  }
}

export async function hentNode(sti: string, valg: HentValg): Promise<HapiNode> {
  const node = await hentValgfri(sti, valg)
  if (!node) throw new Error(`HAPI svarte uten innhold for ${sti}`)
  return node
}

/** Barnelenker uten duplikater — samme enhet kan være lenket to ganger. */
function unike(lenker: HapiLenke[]): HapiLenke[] {
  const sett = new Set<string>()
  return lenker.filter((l) => (sett.has(l.href) ? false : (sett.add(l.href), true)))
}

function barn(node: HapiNode): HapiLenke[] {
  return (node.links ?? []).filter((l) => l.rel === "barn")
}

/** Kjører `oppgaver` med høyst `n` samtidig, og bevarer rekkefølgen. */
async function medBegrensning<T>(oppgaver: (() => Promise<T>)[], n: number): Promise<T[]> {
  const ut: T[] = new Array(oppgaver.length)
  let neste = 0
  async function arbeider() {
    while (neste < oppgaver.length) {
      const i = neste++
      ut[i] = await oppgaver[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, oppgaver.length) }, arbeider))
  return ut
}

/**
 * Henter et normerende produkt med kapitler og enheter. Underkapitler flates ut
 * under sitt toppkapittel. Feiler én node, feiler hele hentingen — en halv
 * retningslinje skal ikke erstatte en hel i mellomlageret.
 */
export async function hentTre(rotSti: string, valg: HentValg): Promise<HapiTre> {
  const n = valg.samtidige ?? 3
  const rot = await hentNode(rotSti, valg)
  const kapittelLenker = barn(rot).filter((l) => l.type === "kapittel")

  const kapitler = await medBegrensning(
    kapittelLenker.map((l) => async (): Promise<HapiKapittel> => {
      const node = await hentNode(l.href, valg)
      const enheter: HapiNode[] = []
      let ko = unike(barn(node))
      while (ko.length > 0) {
        const noder = await medBegrensning(ko.map((b) => () => hentValgfri(b.href, valg)), n)
        ko = []
        for (const b of noder) {
          if (!b) continue
          if (b.tekniskeData.infoType === "kapittel") ko.push(...unike(barn(b)))
          else enheter.push(b)
        }
      }
      return { node, enheter }
    }),
    n
  )
  return { rot, kapitler }
}

/** Kapittel med underkapitler i kildens rekkefølge. */
export interface HapiNestetKapittel {
  node: HapiNode
  kapitler: HapiNestetKapittel[]
  enheter: HapiNode[]
}

export interface HapiNestetTre {
  rot: HapiNode
  kapitler: HapiNestetKapittel[]
  /** Enheter rett under produktet, uten kapittel. */
  enheter: HapiNode[]
}

/**
 * Barn som ikke er innhold i seg selv. Referanser og PICO-er ligger under hver
 * anbefaling — over 400 i diabetesretningslinjen — og trengs ikke i leseren.
 */
const UTELATTE_TYPER = new Set(["referanse", "pico"])

/**
 * Henter et normerende produkt med kapittelstrukturen intakt. Brukes for
 * leseren, der innholdsfortegnelsen skal speile kilden.
 */
export async function hentNestet(rotSti: string, valg: HentValg): Promise<HapiNestetTre> {
  const n = valg.samtidige ?? 3
  const rot = await hentNode(rotSti, valg)

  async function barnAv(node: HapiNode): Promise<{ kapitler: HapiNestetKapittel[]; enheter: HapiNode[] }> {
    const lenker = unike(barn(node)).filter((l) => !UTELATTE_TYPER.has(l.type))
    const noder = await medBegrensning(lenker.map((l) => () => hentValgfri(l.href, valg)), n)
    const kapitler: HapiNestetKapittel[] = []
    const enheter: HapiNode[] = []
    for (const b of noder) {
      if (!b) continue
      if (b.tekniskeData.infoType === "kapittel") {
        kapitler.push({ node: b, ...(await barnAv(b)) })
      } else {
        enheter.push(b)
      }
    }
    return { kapitler, enheter }
  }

  return { rot, ...(await barnAv(rot)) }
}
