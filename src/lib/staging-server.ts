import "server-only"
import { prisma } from "@/lib/db"

export {
  byggStaging,
  byggChatStaging,
  resolverVedleggInstruksjon,
  byggVerktoyforslagStaging,
} from "@/lib/staging-bygg"

const PREFIKS = "staging:"

/** Henter alle admin-overrides i én spørring. Nøkler returneres uten `staging:`-prefiks. */
export async function hentStagingOverrides(): Promise<Map<string, string>> {
  const rader = await prisma.systemSetting.findMany({
    where: { key: { startsWith: PREFIKS } },
  })
  const map = new Map<string, string>()
  for (const r of rader) map.set(r.key.slice(PREFIKS.length), r.value)
  return map
}
