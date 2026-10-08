"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { isAdmin, settSystemSetting, slettSystemSetting } from "@/lib/admin"
import { KREV_2FA_NOKKEL } from "@/lib/to-faktor-krav"

/** Setter (YYYY-MM-DD) eller fjerner (tom streng) datoen 2FA blir obligatorisk fra. */
export async function settKrav2faFra(dato: string): Promise<{ ok: boolean; feil?: string }> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) return { ok: false, feil: "Uautorisert." }

  const v = dato.trim()
  if (v === "") {
    await slettSystemSetting(KREV_2FA_NOKKEL)
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    await settSystemSetting(KREV_2FA_NOKKEL, v)
  } else {
    return { ok: false, feil: "Ugyldig dato." }
  }
  revalidatePath("/admin/brukere")
  return { ok: true }
}
