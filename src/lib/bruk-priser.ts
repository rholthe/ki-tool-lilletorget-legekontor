import "server-only"
import { hentSystemSetting, settSystemSetting } from "@/lib/admin"

/**
 * Priser for bruksstatistikken (USD). Lagres som JSON i SystemSetting
 * `bruk_priser` og redigeres på /admin/bruk. Standardverdiene er listepris for
 * Claude Sonnet 4.6 med 10 % tillegg for EU-profil (eu.-prefiks) og Soniox
 * sanntid — kontroller mot fakturaene og juster ved behov.
 */
export interface ModellPris {
  /** USD per million tokens */
  inn: number
  ut: number
  cacheLes: number
  cacheSkriv: number
}

export interface Priser {
  bedrock: Record<string, ModellPris>
  /** Brukes for modeller som ikke står i `bedrock`. */
  bedrockStandard: ModellPris
  /** USD per time behandlet lyd (sanntid). */
  sonioxPerTime: number
  /** Omregningskurs for visning i NOK (oppdateres for hånd). */
  usdNok: number
}

export const STANDARD_PRISER: Priser = {
  bedrock: {
    "eu.anthropic.claude-sonnet-4-6": { inn: 3.3, ut: 16.5, cacheLes: 0.33, cacheSkriv: 4.125 },
  },
  bedrockStandard: { inn: 3.3, ut: 16.5, cacheLes: 0.33, cacheSkriv: 4.125 },
  sonioxPerTime: 0.12,
  usdNok: 10.5,
}

const NOKKEL = "bruk_priser"

export async function hentPriser(): Promise<Priser> {
  const raa = await hentSystemSetting(NOKKEL, "")
  if (!raa) return STANDARD_PRISER
  try {
    const p = JSON.parse(raa) as Partial<Priser>
    return {
      bedrock: { ...STANDARD_PRISER.bedrock, ...(p.bedrock ?? {}) },
      bedrockStandard: p.bedrockStandard ?? STANDARD_PRISER.bedrockStandard,
      sonioxPerTime: typeof p.sonioxPerTime === "number" ? p.sonioxPerTime : STANDARD_PRISER.sonioxPerTime,
      usdNok: typeof p.usdNok === "number" ? p.usdNok : STANDARD_PRISER.usdNok,
    }
  } catch {
    return STANDARD_PRISER
  }
}

export async function lagrePriser(p: Priser): Promise<void> {
  await settSystemSetting(NOKKEL, JSON.stringify(p))
}

export interface ForbruksTall {
  tjeneste: "BEDROCK" | "SONIOX"
  modell?: string | null
  inputTokens?: number
  outputTokens?: number
  cacheLesTokens?: number
  cacheSkrivTokens?: number
  lydMs?: number
}

export function beregnKostnadUsd(t: ForbruksTall, p: Priser): number {
  if (t.tjeneste === "SONIOX") return ((t.lydMs ?? 0) / 3_600_000) * p.sonioxPerTime
  const m = (t.modell && p.bedrock[t.modell]) || p.bedrockStandard
  return (
    ((t.inputTokens ?? 0) * m.inn +
      (t.outputTokens ?? 0) * m.ut +
      (t.cacheLesTokens ?? 0) * m.cacheLes +
      (t.cacheSkrivTokens ?? 0) * m.cacheSkriv) /
    1_000_000
  )
}
