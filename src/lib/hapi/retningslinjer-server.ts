import "server-only"
import { prisma } from "@/lib/db"
import { hentTre } from "@/lib/hapi/hent"
import type { Retningslinje } from "@/lib/verktoy/typer"
import {
  ANTIBIOTIKA_FORMAT,
  ANTIBIOTIKA_ID,
  ANTIBIOTIKA_ROT,
  byggAntibiotika,
} from "@/lib/verktoy/retningslinjer/antibiotika-hapi"
import reserve from "@/lib/verktoy/retningslinjer/antibiotika-reserve.json"

/**
 * Retningslinjer fra Helsedirektoratets API, mellomlagret i databasen.
 *
 * Forespørsler venter aldri på API-et: de får det som ligger lagret, og er det
 * eldre enn et døgn, hentes nytt i bakgrunnen. Feiler hentingen, vises fortsatt
 * forrige versjon. Er databasen tom (første oppstart), brukes reservekopien i
 * repoet til den første hentingen er ferdig.
 *
 * Innholdet er offentlig. Ingen pasientdata går denne veien, og nøkkelen
 * forlater aldri serveren.
 */

const MAKS_ALDER_MS = 24 * 60 * 60 * 1000

/** Hindrer at flere forespørsler starter hver sin henting samtidig. */
let pagaende: Promise<void> | null = null
/** Også i minnet: finnes ingen rad ennå, har databasen ikke noe forsøkstidspunkt. */
let sisteForsokIMinnet = 0

function nokkel(): string | null {
  return process.env.HELSEDIR_API_KEY?.trim() || null
}

/** Feilmelding uten innhold — bare type og statuskode. */
function kortFeil(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500)
}

async function hentOgLagre(): Promise<void> {
  const n = nokkel()
  if (!n) throw new Error("HELSEDIR_API_KEY er ikke satt")
  const forsok = new Date()
  try {
    const tre = await hentTre(ANTIBIOTIKA_ROT, { nokkel: n })
    const retningslinje = byggAntibiotika(tre, forsok.toISOString())
    if (retningslinje.tilstander.length === 0) throw new Error("Hentingen ga ingen tilstander")
    const sist = retningslinje.kilde.sistRevidert ? new Date(retningslinje.kilde.sistRevidert) : null
    const felter = {
      data: JSON.stringify(retningslinje),
      format: ANTIBIOTIKA_FORMAT,
      sistFagligOppdatert: sist && !Number.isNaN(sist.getTime()) ? sist : null,
      hentetAt: forsok,
      sisteFeil: null,
      sisteForsokAt: forsok,
    }
    await prisma.hapiInnhold.upsert({
      where: { id: ANTIBIOTIKA_ID },
      create: { id: ANTIBIOTIKA_ID, ...felter },
      update: felter,
    })
    console.info(`[hapi] ${ANTIBIOTIKA_ID}: ${retningslinje.tilstander.length} tilstander hentet`)
  } catch (e) {
    const feil = kortFeil(e)
    console.error(`[hapi] ${ANTIBIOTIKA_ID}: henting feilet: ${feil}`)
    // Lagre feilen uten å røre innholdet — forrige versjon skal fortsatt vises
    await prisma.hapiInnhold
      .update({ where: { id: ANTIBIOTIKA_ID }, data: { sisteFeil: feil, sisteForsokAt: forsok } })
      .catch(() => {})
    throw e
  }
}

/** Starter en henting hvis ingen pågår. Returnerer den pågående. */
function startHenting(): Promise<void> {
  if (!pagaende) {
    sisteForsokIMinnet = Date.now()
    pagaende = hentOgLagre().finally(() => {
      pagaende = null
    })
  }
  return pagaende
}

/** Henting i bakgrunnen ved forespørsler: feil logges, aldri kastet videre. */
function oppdaterIBakgrunnen(sisteForsok: Date | null) {
  if (!nokkel()) return
  // Ikke prøv på nytt hvert eneste kall mens API-et er nede
  const sist = Math.max(sisteForsok?.getTime() ?? 0, sisteForsokIMinnet)
  if (Date.now() - sist < 15 * 60 * 1000) return
  startHenting().catch(() => {})
}

export async function hentRetningslinjer(): Promise<Retningslinje[]> {
  const rad = await prisma.hapiInnhold.findUnique({ where: { id: ANTIBIOTIKA_ID } })

  // Ingen rad, eller lagret i et eldre format: reservekopien er riktig oppbygd
  if (!rad || rad.format !== ANTIBIOTIKA_FORMAT) {
    oppdaterIBakgrunnen(rad?.sisteForsokAt ?? null)
    return [reserve as Retningslinje]
  }

  if (Date.now() - rad.hentetAt.getTime() > MAKS_ALDER_MS) {
    oppdaterIBakgrunnen(rad.sisteForsokAt)
  }
  return [JSON.parse(rad.data) as Retningslinje]
}

export interface HapiStatus {
  id: string
  hentetAt: string | null
  sistFagligOppdatert: string | null
  sisteFeil: string | null
  sisteForsokAt: string | null
  antallTilstander: number | null
  nokkelSatt: boolean
}

export async function hentHapiStatus(): Promise<HapiStatus> {
  const rad = await prisma.hapiInnhold.findUnique({ where: { id: ANTIBIOTIKA_ID } })
  let antall: number | null = null
  if (rad) {
    try {
      antall = (JSON.parse(rad.data) as Retningslinje).tilstander.length
    } catch {
      antall = null
    }
  }
  return {
    id: ANTIBIOTIKA_ID,
    hentetAt: rad?.hentetAt.toISOString() ?? null,
    sistFagligOppdatert: rad?.sistFagligOppdatert?.toISOString() ?? null,
    sisteFeil: rad?.sisteFeil ?? null,
    sisteForsokAt: rad?.sisteForsokAt?.toISOString() ?? null,
    antallTilstander: antall,
    nokkelSatt: Boolean(nokkel()),
  }
}

/** Admin: hent nå og vent på resultatet. Kaster ved feil. */
export async function oppdaterRetningslinjerNaa(): Promise<HapiStatus> {
  await startHenting()
  return hentHapiStatus()
}
