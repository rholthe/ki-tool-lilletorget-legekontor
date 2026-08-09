"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export async function sjekkInnlogging(
  email: string,
  passord: string
): Promise<{ ok: boolean; trenger2FA: boolean; feil?: string }> {
  const bruker = await prisma.user.findUnique({ where: { email } })
  if (!bruker?.passwordHash)
    return { ok: false, trenger2FA: false, feil: "Feil e-post eller passord" }

  const passordOk = await bcrypt.compare(passord, bruker.passwordHash)
  if (!passordOk)
    return { ok: false, trenger2FA: false, feil: "Feil e-post eller passord" }

  return { ok: true, trenger2FA: bruker.twoFactorEnabled }
}
