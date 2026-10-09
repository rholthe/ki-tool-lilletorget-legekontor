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
  /** Samtidige forespørsler. Lavt, så vi ikke belaster API-et unødig. */
  samtidige?: number
  tidsavbruddMs?: number
}

export async function hentNode(sti: string, valg: HentValg): Promise<HapiNode> {
  const base = valg.base ?? HAPI_BASE
  const url = sti.startsWith("http") ? sti : `${base}${sti}`
  if (!url.startsWith(base)) throw new Error(`Uventet adresse utenfor HAPI: ${url}`)

  const svar = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": valg.nokkel, Accept: "application/json" },
    signal: AbortSignal.timeout(valg.tidsavbruddMs ?? 30_000),
  })
  if (!svar.ok) throw new Error(`HAPI svarte ${svar.status} for ${sti}`)
  return (await svar.json()) as HapiNode
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
      let ko = barn(node)
      while (ko.length > 0) {
        const noder = await medBegrensning(ko.map((b) => () => hentNode(b.href, valg)), n)
        ko = []
        for (const b of noder) {
          if (b.tekniskeData.infoType === "kapittel") ko.push(...barn(b))
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
    const lenker = barn(node).filter((l) => !UTELATTE_TYPER.has(l.type))
    const noder = await medBegrensning(lenker.map((l) => () => hentNode(l.href, valg)), n)
    const kapitler: HapiNestetKapittel[] = []
    const enheter: HapiNode[] = []
    for (const b of noder) {
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
