"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
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

const registrerSchema = z.object({
  name: z.string().min(2, "Navn må ha minst 2 tegn"),
  email: z.string().email("Ugyldig e-postadresse"),
  password: z
    .string()
    .min(8, "Passord må ha minst 8 tegn")
    .regex(/[A-Z]/, "Må inneholde minst én stor bokstav")
    .regex(/[0-9]/, "Må inneholde minst ett tall"),
})

export type RegistrerState = {
  errors?: { name?: string[]; email?: string[]; password?: string[] }
  message?: string
  success?: boolean
}

export async function registrerBruker(
  _prevState: RegistrerState,
  formData: FormData
): Promise<RegistrerState> {
  const parsed = registrerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { name, email, password } = parsed.data

  const eksisterer = await prisma.user.findUnique({ where: { email } })
  if (eksisterer) {
    return { errors: { email: ["E-postadressen er allerede registrert"] } }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: { name, email, passwordHash },
  })

  return { success: true, message: "Konto opprettet. Du kan nå logge inn." }
}
