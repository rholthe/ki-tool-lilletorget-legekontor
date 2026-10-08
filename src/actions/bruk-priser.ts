"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentPriser, lagrePriser } from "@/lib/bruk-priser"

const pris = z.coerce.number().min(0).max(1000)

/** Oppdaterer prisene. Gjelder nye rader — historikken beholder prisen som gjaldt. */
export async function lagreBrukPriser(_prev: { melding?: string }, fd: FormData): Promise<{ melding?: string; ok?: boolean }> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) return { melding: "Uautorisert." }

  const p = z
    .object({
      modell: z.string().min(1).max(120),
      inn: pris, ut: pris, cacheLes: pris, cacheSkriv: pris,
      sonioxPerTime: pris, usdNok: z.coerce.number().min(1).max(100),
    })
    .safeParse(Object.fromEntries(fd))
  if (!p.success) return { melding: "Ugyldige tall." }

  const naa = await hentPriser()
  const m = { inn: p.data.inn, ut: p.data.ut, cacheLes: p.data.cacheLes, cacheSkriv: p.data.cacheSkriv }
  await lagrePriser({
    bedrock: { ...naa.bedrock, [p.data.modell]: m },
    bedrockStandard: m,
    sonioxPerTime: p.data.sonioxPerTime,
    usdNok: p.data.usdNok,
  })
  revalidatePath("/admin/bruk")
  return { ok: true, melding: "Prisene er lagret. De gjelder nye kall fra nå av." }
}
