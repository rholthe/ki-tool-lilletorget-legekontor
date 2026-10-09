import "server-only"
import { prisma } from "@/lib/db"
import { hentSystemSetting, settSystemSetting } from "@/lib/admin"
import { hentNestet, hentNode, hentTre } from "@/lib/hapi/hent"
import type { LeseRetningslinje, Retningslinje } from "@/lib/verktoy/typer"
import {
  ANTIBIOTIKA_FORMAT,
  ANTIBIOTIKA_ID,
  ANTIBIOTIKA_ROT,
  byggAntibiotika,
} from "@/lib/verktoy/retningslinjer/antibiotika-hapi"
import {
  LESE_FORMAT,
  antallEnheter,
  byggLeseRetningslinje,
  tilIndeks,
} from "@/lib/verktoy/retningslinjer/lese-hapi"
import reserve from "@/lib/verktoy/retningslinjer/antibiotika-reserve.json"

/**
 * Innhold fra Helsedirektoratets API, mellomlagret i databasen (`HapiInnhold`).
 *
 * Forespørsler venter aldri på API-et: de får det som ligger lagret, og er det
 * eldre enn et døgn, hentes nytt i bakgrunnen. Feiler hentingen, vises forrige
 * versjon og feilen lagres. Hentingene går én om gangen, så vi aldri sender en
 * byge av kall til API-et.
 *
 * Tre slags rader:
 * - `antibiotika-allmennpraksis`: antibiotikaretningslinjen (egen datamodell).
 *   Er raden tom, brukes reservekopien i repoet.
 * - `les:<infoId>`: retningslinjer til oppslag, valgt av admin.
 * - `katalog:retningslinje`: alle retningslinjer API-et har, for adminvalget.
 *
 * Innholdet er offentlig. Ingen pasientdata går denne veien, og nøkkelen
 * forlater aldri serveren.
 */

const MAKS_ALDER_MS = 24 * 60 * 60 * 1000
const NYTT_FORSOK_MS = 15 * 60 * 1000
const KATALOG_FORMAT = 1

function nokkel(): string | null {
  return process.env.HELSEDIR_API_KEY?.trim() || null
}

/** Feilmelding uten innhold — bare type og statuskode. */
function kortFeil(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500)
}

// ─── Henting og lagring ───────────────────────────────────────────────────────

interface Bygget {
  data: unknown
  sistFagligOppdatert?: string | null
}

const pagaende = new Map<string, Promise<void>>()
const sisteForsok = new Map<string, number>()
/** Alle hentinger går i én kø, så API-et aldri får mer enn én retningslinje om gangen. */
let ko: Promise<unknown> = Promise.resolve()

async function hentOgLagre(id: string, format: number, bygg: (n: string, tid: string) => Promise<Bygget>) {
  const n = nokkel()
  if (!n) throw new Error("HELSEDIR_API_KEY er ikke satt")
  const forsok = new Date()
  try {
    const { data, sistFagligOppdatert } = await bygg(n, forsok.toISOString())
    const sist = sistFagligOppdatert ? new Date(sistFagligOppdatert) : null
    const felter = {
      data: JSON.stringify(data),
      format,
      sistFagligOppdatert: sist && !Number.isNaN(sist.getTime()) ? sist : null,
      hentetAt: forsok,
      sisteFeil: null,
      sisteForsokAt: forsok,
    }
    await prisma.hapiInnhold.upsert({ where: { id }, create: { id, ...felter }, update: felter })
    console.info(`[hapi] ${id}: hentet`)
  } catch (e) {
    const feil = kortFeil(e)
    console.error(`[hapi] ${id}: henting feilet: ${feil}`)
    // Lagre feilen uten å røre innholdet — forrige versjon skal fortsatt vises
    await prisma.hapiInnhold
      .update({ where: { id }, data: { sisteFeil: feil, sisteForsokAt: forsok } })
      .catch(() => {})
    throw e
  }
}

/** Legger en henting i køen hvis ingen pågår for samme id. */
function startHenting(id: string, format: number, bygg: (n: string, tid: string) => Promise<Bygget>) {
  const eksisterende = pagaende.get(id)
  if (eksisterende) return eksisterende
  sisteForsok.set(id, Date.now())
  const jobb = ko.then(() => hentOgLagre(id, format, bygg))
  ko = jobb.catch(() => {})
  const p = jobb.finally(() => pagaende.delete(id))
  pagaende.set(id, p)
  return p
}

/** Henting i bakgrunnen: feil logges, aldri kastet videre, og nye forsøk tidligst etter 15 min. */
function iBakgrunnen(
  id: string,
  format: number,
  bygg: (n: string, tid: string) => Promise<Bygget>,
  dbForsok: Date | null
) {
  if (!nokkel()) return
  const sist = Math.max(dbForsok?.getTime() ?? 0, sisteForsok.get(id) ?? 0)
  if (Date.now() - sist < NYTT_FORSOK_MS) return
  startHenting(id, format, bygg).catch(() => {})
}

interface RadMeta {
  id: string
  format: number
  hentetAt: Date
  sisteForsokAt: Date | null
}

const erGammel = (rad: RadMeta) => Date.now() - rad.hentetAt.getTime() > MAKS_ALDER_MS

// Parset innhold i minnet, så vi ikke parser flere hundre kB JSON per forespørsel
const parset = new Map<string, { hentetAt: number; verdi: unknown }>()

async function lesData<T>(meta: RadMeta): Promise<T | null> {
  const minne = parset.get(meta.id)
  if (minne && minne.hentetAt === meta.hentetAt.getTime()) return minne.verdi as T
  const rad = await prisma.hapiInnhold.findUnique({ where: { id: meta.id }, select: { data: true } })
  if (!rad) return null
  try {
    const verdi = JSON.parse(rad.data) as T
    parset.set(meta.id, { hentetAt: meta.hentetAt.getTime(), verdi })
    return verdi
  } catch {
    return null
  }
}

const META = { id: true, format: true, hentetAt: true, sisteForsokAt: true } as const

// ─── Antibiotika ──────────────────────────────────────────────────────────────

const byggAntibiotikaRad = async (n: string, tid: string): Promise<Bygget> => {
  const r = byggAntibiotika(await hentTre(ANTIBIOTIKA_ROT, { nokkel: n }), tid)
  if (r.tilstander.length === 0) throw new Error("Hentingen ga ingen tilstander")
  return { data: r, sistFagligOppdatert: r.kilde.sistRevidert }
}

export async function hentRetningslinjer(): Promise<Retningslinje[]> {
  const rad = await prisma.hapiInnhold.findUnique({ where: { id: ANTIBIOTIKA_ID }, select: META })
  // Ingen rad, eller lagret i et eldre format: reservekopien er riktig oppbygd
  if (!rad || rad.format !== ANTIBIOTIKA_FORMAT) {
    iBakgrunnen(ANTIBIOTIKA_ID, ANTIBIOTIKA_FORMAT, byggAntibiotikaRad, rad?.sisteForsokAt ?? null)
    return [reserve as Retningslinje]
  }
  if (erGammel(rad)) iBakgrunnen(ANTIBIOTIKA_ID, ANTIBIOTIKA_FORMAT, byggAntibiotikaRad, rad.sisteForsokAt)
  const data = await lesData<Retningslinje>(rad)
  return [data ?? (reserve as Retningslinje)]
}

// ─── Retningslinjer og forløp til oppslag ─────────────────────────────────────

export interface KatalogRad {
  id: string
  tittel: string
  kortTittel: string
  sistFagligOppdatert: string
}

/**
 * En samling innhold til leseren. Retningslinjer og nasjonale forløp har samme
 * oppbygning i API-et, men eget utvalg, egen katalog og egen fane.
 */
interface Samling {
  navn: "retningslinjer" | "forlop"
  prefiks: string
  utvalgNokkel: string
  katalogId: string
  infoType: string
  rotSti: (infoId: string) => string
  /** Uten valg fra admin. Får katalogen, siden forløpene ikke har faste id-er å starte med. */
  standard: (katalog: KatalogRad[]) => string[]
}

const RETNINGSLINJER: Samling = {
  navn: "retningslinjer",
  prefiks: "les:",
  utvalgNokkel: "hapi_lese_utvalg",
  katalogId: "katalog:retningslinje",
  infoType: "retningslinje",
  rotSti: (id) => `/innhold/retningslinjer/0006-0001-${id}`,
  // Retningslinjer som brukes ofte i allmennpraksis og har innholdet sitt i API-et
  standard: () => [
    "2ea5f302-48e0-4146-ae00-39a54dc2175f", // Diabetes
    "9ae38771-d80b-4dc0-9909-bf408a1a054b", // Forebygging av hjerte- og karsykdom
    "52970834-1ab0-41ea-b206-fd5c5435931d", // Kols
    "fc862b0d-9931-46b8-92af-431d23e27b00", // Demens
    "b0201403-cbe9-4d91-8ec4-0d8c70fa3253", // Hjerneslag
    "3c290e30-2b8a-4d8e-99c8-10096fd5dbc3", // Svangerskapsomsorgen
    "ad410d41-f16e-44e6-8138-2495a092b54c", // Svangerskapsdiabetes
    "3aaebf57-2618-45dd-a6b5-ce90cc5b32c2", // Røykeavvenning
  ],
}

const FORLOP: Samling = {
  navn: "forlop",
  prefiks: "forlop:",
  utvalgNokkel: "hapi_forlop_utvalg",
  katalogId: "katalog:forlop",
  infoType: "nasjonalt-forlop",
  rotSti: (id) => `/innhold/nasjonalt-forlop/0006-0007-${id}`,
  // Alle pakkeforløpene for kreft og det diagnostiske pakkeforløpet
  standard: (katalog) => katalog.filter((k) => /pakkeforløp/i.test(k.tittel)).map((k) => k.id),
}

const SAMLINGER = [RETNINGSLINJER, FORLOP]

const radId = (sam: Samling, infoId: string) => `${sam.prefiks}${infoId}`

const byggLeseRad = (sam: Samling, infoId: string) => async (n: string, tid: string): Promise<Bygget> => {
  const r = byggLeseRetningslinje(await hentNestet(sam.rotSti(infoId), { nokkel: n }), tid)
  return { data: r, sistFagligOppdatert: r.sistFagligOppdatert }
}

const byggKatalog = (sam: Samling) => async (n: string): Promise<Bygget> => {
  const liste = (await hentNode(`/innhold/innhold?infoTyper=${sam.infoType}`, { nokkel: n })) as unknown
  if (!Array.isArray(liste)) throw new Error("Uventet svar fra katalogen")
  const rader: KatalogRad[] = liste
    .filter((x) => x?.status === "Gjeldende" && x?.tekniskeData?.infoId)
    .map((x) => ({
      id: x.tekniskeData.infoId as string,
      tittel: String(x.tittel ?? "").trim(),
      kortTittel: String(x.kortTittel || x.tittel || "").trim(),
      sistFagligOppdatert: String(x.sistFagligOppdatert ?? ""),
    }))
    .sort((a, b) => a.kortTittel.localeCompare(b.kortTittel, "nb"))
  return { data: rader }
}

async function hentKatalog(sam: Samling): Promise<KatalogRad[]> {
  const rad = await prisma.hapiInnhold.findUnique({ where: { id: sam.katalogId }, select: META })
  if (!rad || rad.format !== KATALOG_FORMAT) {
    // Katalogen trengs før noe annet kan hentes. Den er ett enkelt kall, så den
    // hentes direkte i stedet for å stå i kø bak retningslinjene
    if (nokkel()) await hentOgLagre(sam.katalogId, KATALOG_FORMAT, byggKatalog(sam)).catch(() => {})
    const ny = await prisma.hapiInnhold.findUnique({ where: { id: sam.katalogId }, select: META })
    return ny ? ((await lesData<KatalogRad[]>(ny)) ?? []) : []
  }
  if (erGammel(rad)) iBakgrunnen(sam.katalogId, KATALOG_FORMAT, byggKatalog(sam), rad.sisteForsokAt)
  return (await lesData<KatalogRad[]>(rad)) ?? []
}

async function hentUtvalgFor(sam: Samling): Promise<string[]> {
  const raa = await hentSystemSetting(sam.utvalgNokkel, "")
  if (raa) {
    try {
      const liste = JSON.parse(raa)
      if (Array.isArray(liste)) return liste.filter((x): x is string => typeof x === "string")
    } catch {
      // Ugyldig verdi — bruk standard
    }
  }
  return sam.standard(await hentKatalog(sam))
}

const samling = (navn: string) => SAMLINGER.find((s) => s.navn === navn)

export async function lagreUtvalg(navn: string, ider: string[]): Promise<void> {
  const sam = samling(navn)
  if (!sam) throw new Error("Ukjent samling")
  const rene = [...new Set(ider.filter((x) => /^[0-9a-f-]{36}$/.test(x)))]
  await settSystemSetting(sam.utvalgNokkel, JSON.stringify(rene))
  // Hent de nye med en gang, så de dukker opp uten å vente på første bruker
  const rader = await prisma.hapiInnhold.findMany({
    where: { id: { in: rene.map((id) => radId(sam, id)) } },
    select: { id: true },
  })
  const har = new Set(rader.map((r) => r.id))
  for (const id of rene) {
    if (!har.has(radId(sam, id))) startHenting(radId(sam, id), LESE_FORMAT, byggLeseRad(sam, id)).catch(() => {})
  }
}

/**
 * Innholdsfortegnelsene for utvalgene, uten brødtekst. Det som ikke er hentet
 * ennå, utelates (telles i `venter`) og hentes i bakgrunnen.
 */
export async function hentLeseIndekser(): Promise<{ indekser: LeseRetningslinje[]; venter: number }> {
  const ut: LeseRetningslinje[] = []
  let venter = 0
  for (const sam of SAMLINGER) {
    const utvalg = await hentUtvalgFor(sam)
    const rader = await prisma.hapiInnhold.findMany({
      where: { id: { in: utvalg.map((id) => radId(sam, id)) } },
      select: META,
    })
    const etterId = new Map(rader.map((r) => [r.id, r]))
    for (const infoId of utvalg) {
      const rad = etterId.get(radId(sam, infoId))
      if (!rad || rad.format !== LESE_FORMAT || erGammel(rad)) {
        iBakgrunnen(radId(sam, infoId), LESE_FORMAT, byggLeseRad(sam, infoId), rad?.sisteForsokAt ?? null)
      }
      const data = rad && rad.format === LESE_FORMAT ? await lesData<LeseRetningslinje>(rad) : null
      if (data) ut.push(tilIndeks(data))
      else venter++
    }
  }
  return { indekser: ut, venter }
}

/** Hele retningslinjen eller forløpet med tekst — bare det som er i et utvalg. */
export async function hentLeseRetningslinje(infoId: string): Promise<LeseRetningslinje | null> {
  for (const sam of SAMLINGER) {
    if (!(await hentUtvalgFor(sam)).includes(infoId)) continue
    const rad = await prisma.hapiInnhold.findUnique({ where: { id: radId(sam, infoId) }, select: META })
    if (!rad || rad.format !== LESE_FORMAT) return null
    return lesData<LeseRetningslinje>(rad)
  }
  return null
}

// ─── Status for admin ─────────────────────────────────────────────────────────

export interface HapiRadStatus {
  id: string
  navn: string
  hentetAt: string | null
  sistFagligOppdatert: string | null
  sisteFeil: string | null
  sisteForsokAt: string | null
  /** Tilstander (antibiotika) eller sider (leseretningslinjer). */
  antall: number | null
  /** Hentes nå. */
  henter: boolean
}

export interface HapiSamlingStatus {
  utvalg: HapiRadStatus[]
  katalog: KatalogRad[]
}

export interface HapiStatus {
  nokkelSatt: boolean
  antibiotika: HapiRadStatus
  retningslinjer: HapiSamlingStatus
  forlop: HapiSamlingStatus
}

export async function hentHapiStatus(): Promise<HapiStatus> {
  async function status(id: string, visningsnavn: string): Promise<HapiRadStatus> {
    const rad = await prisma.hapiInnhold.findUnique({
      where: { id },
      select: { ...META, sistFagligOppdatert: true, sisteFeil: true },
    })
    let antall: number | null = null
    if (rad) {
      const data = await lesData<Retningslinje | LeseRetningslinje>(rad)
      if (data) antall = "tilstander" in data ? data.tilstander.length : antallEnheter(data)
    }
    return {
      id,
      navn: visningsnavn,
      hentetAt: rad?.hentetAt.toISOString() ?? null,
      sistFagligOppdatert: rad?.sistFagligOppdatert?.toISOString() ?? null,
      sisteFeil: rad?.sisteFeil ?? null,
      sisteForsokAt: rad?.sisteForsokAt?.toISOString() ?? null,
      antall,
      henter: pagaende.has(id),
    }
  }

  async function samlingStatus(sam: Samling): Promise<HapiSamlingStatus> {
    const [katalog, utvalg] = await Promise.all([hentKatalog(sam), hentUtvalgFor(sam)])
    const navn = new Map(katalog.map((k) => [k.id, k.kortTittel]))
    return {
      katalog,
      utvalg: await Promise.all(utvalg.map((u) => status(radId(sam, u), navn.get(u) ?? u))),
    }
  }

  return {
    nokkelSatt: Boolean(nokkel()),
    antibiotika: await status(ANTIBIOTIKA_ID, "Antibiotika i primærhelsetjenesten"),
    retningslinjer: await samlingStatus(RETNINGSLINJER),
    forlop: await samlingStatus(FORLOP),
  }
}

/** Admin: hent alt på nytt nå. Venter på antibiotika; resten går i køen. */
export async function oppdaterAlleNaa(): Promise<HapiStatus> {
  // Antibiotika først i køen, så admin får svar på den uten å vente på resten
  const antibiotika = startHenting(ANTIBIOTIKA_ID, ANTIBIOTIKA_FORMAT, byggAntibiotikaRad)
  for (const sam of SAMLINGER) {
    startHenting(sam.katalogId, KATALOG_FORMAT, byggKatalog(sam)).catch(() => {})
    for (const id of await hentUtvalgFor(sam)) {
      startHenting(radId(sam, id), LESE_FORMAT, byggLeseRad(sam, id)).catch(() => {})
    }
  }
  await antibiotika
  return hentHapiStatus()
}
