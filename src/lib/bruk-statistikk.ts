import "server-only"
import { prisma } from "@/lib/db"

/** Måned som YYYY-MM i norsk tid; ugyldig/tom gir inneværende måned. */
export function tolkMaaned(mnd?: string | null): string {
  if (mnd && /^\d{4}-(0[1-9]|1[0-2])$/.test(mnd)) return mnd
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit" }).format(new Date())
}

export function naboMaaned(mnd: string, steg: number): string {
  const [aar, m] = mnd.split("-").map(Number)
  const d = new Date(Date.UTC(aar, m - 1 + steg, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Månedens grenser i UTC (norsk midnatt), slik databasen lagrer tidspunkter. */
function grenser(mnd: string): { fra: Date; til: Date } {
  const norskMidnatt = (iso: string) => {
    const utc = new Date(`${iso}T00:00:00Z`)
    const forskyvning =
      new Date(utc.toLocaleString("en-US", { timeZone: "Europe/Oslo" })).getTime() -
      new Date(utc.toLocaleString("en-US", { timeZone: "UTC" })).getTime()
    return new Date(utc.getTime() - forskyvning)
  }
  return { fra: norskMidnatt(`${mnd}-01`), til: norskMidnatt(`${naboMaaned(mnd, 1)}-01`) }
}

export interface BrukerRad {
  userId: string
  navn: string
  epost: string
  aiKall: number
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  aiKostnadUsd: number
  opptak: number
  lydTimer: number
  antallTegn: number
  sonioxKostnadUsd: number
  sumUsd: number
}

export interface FunksjonRad {
  tjeneste: string
  funksjon: string
  antall: number
  kostnadUsd: number
}

export async function hentMaanedsstatistikk(mnd: string): Promise<{ brukere: BrukerRad[]; funksjoner: FunksjonRad[] }> {
  const { fra, til } = grenser(mnd)
  const hvor = { opprettet: { gte: fra, lt: til } }

  const [perBruker, perFunksjon, alleBrukere] = await Promise.all([
    prisma.bruk.groupBy({
      by: ["userId", "tjeneste"],
      where: hvor,
      _count: { _all: true },
      _sum: {
        inputTokens: true, outputTokens: true, cacheLesTokens: true, cacheSkrivTokens: true,
        lydMs: true, antallTegn: true, kostnadUsd: true,
      },
    }),
    prisma.bruk.groupBy({
      by: ["tjeneste", "funksjon"],
      where: hvor,
      _count: { _all: true },
      _sum: { kostnadUsd: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ])

  const navnPaa = new Map(alleBrukere.map((u) => [u.id, u]))
  const rader = new Map<string, BrukerRad>()
  for (const u of alleBrukere) {
    rader.set(u.id, {
      userId: u.id, navn: u.name ?? u.email, epost: u.email,
      aiKall: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, aiKostnadUsd: 0,
      opptak: 0, lydTimer: 0, antallTegn: 0, sonioxKostnadUsd: 0, sumUsd: 0,
    })
  }
  for (const g of perBruker) {
    let r = rader.get(g.userId)
    if (!r) {
      const u = navnPaa.get(g.userId)
      r = {
        userId: g.userId, navn: u?.name ?? "Slettet bruker", epost: u?.email ?? "",
        aiKall: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, aiKostnadUsd: 0,
        opptak: 0, lydTimer: 0, antallTegn: 0, sonioxKostnadUsd: 0, sumUsd: 0,
      }
      rader.set(g.userId, r)
    }
    const kost = Number(g._sum.kostnadUsd ?? 0)
    if (g.tjeneste === "BEDROCK") {
      r.aiKall += g._count._all
      r.inputTokens += g._sum.inputTokens ?? 0
      r.outputTokens += g._sum.outputTokens ?? 0
      r.cacheTokens += (g._sum.cacheLesTokens ?? 0) + (g._sum.cacheSkrivTokens ?? 0)
      r.aiKostnadUsd += kost
    } else {
      r.opptak += g._count._all
      r.lydTimer += (g._sum.lydMs ?? 0) / 3_600_000
      r.antallTegn += g._sum.antallTegn ?? 0
      r.sonioxKostnadUsd += kost
    }
    r.sumUsd += kost
  }

  return {
    brukere: [...rader.values()].sort((a, b) => b.sumUsd - a.sumUsd || a.navn.localeCompare(b.navn, "nb")),
    funksjoner: perFunksjon
      .map((f) => ({ tjeneste: f.tjeneste, funksjon: f.funksjon, antall: f._count._all, kostnadUsd: Number(f._sum.kostnadUsd ?? 0) }))
      .sort((a, b) => b.kostnadUsd - a.kostnadUsd),
  }
}

export interface DagRad extends BrukerRad {
  /** YYYY-MM-DD i norsk tid. */
  dato: string
}

const norskDato = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Forbruk per bruker per dag i måneden (norsk tid), for CSV-eksporten. Bare dager
 * med aktivitet. Radene summeres her i stedet for i databasen: en måned er noen
 * tusen rader, og MariaDB-dato i norsk tid krever tidssonetabeller vi ikke kan
 * regne med finnes.
 */
export async function hentDagsstatistikk(mnd: string): Promise<DagRad[]> {
  const { fra, til } = grenser(mnd)
  const [rader, alleBrukere] = await Promise.all([
    prisma.bruk.findMany({
      where: { opprettet: { gte: fra, lt: til } },
      select: {
        userId: true, tjeneste: true, opprettet: true,
        inputTokens: true, outputTokens: true, cacheLesTokens: true, cacheSkrivTokens: true,
        lydMs: true, antallTegn: true, kostnadUsd: true,
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ])

  const navnPaa = new Map(alleBrukere.map((u) => [u.id, u]))
  const dager = new Map<string, DagRad>()
  for (const b of rader) {
    const dato = norskDato.format(b.opprettet)
    const nokkel = `${dato}|${b.userId}`
    let r = dager.get(nokkel)
    if (!r) {
      const u = navnPaa.get(b.userId)
      r = {
        dato, userId: b.userId, navn: u ? (u.name ?? u.email) : "Slettet bruker", epost: u?.email ?? "",
        aiKall: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, aiKostnadUsd: 0,
        opptak: 0, lydTimer: 0, antallTegn: 0, sonioxKostnadUsd: 0, sumUsd: 0,
      }
      dager.set(nokkel, r)
    }
    const kost = Number(b.kostnadUsd)
    if (b.tjeneste === "BEDROCK") {
      r.aiKall++
      r.inputTokens += b.inputTokens
      r.outputTokens += b.outputTokens
      r.cacheTokens += b.cacheLesTokens + b.cacheSkrivTokens
      r.aiKostnadUsd += kost
    } else {
      r.opptak++
      r.lydTimer += b.lydMs / 3_600_000
      r.antallTegn += b.antallTegn
      r.sonioxKostnadUsd += kost
    }
    r.sumUsd += kost
  }

  return [...dager.values()].sort(
    (a, b) => a.dato.localeCompare(b.dato) || a.navn.localeCompare(b.navn, "nb")
  )
}
