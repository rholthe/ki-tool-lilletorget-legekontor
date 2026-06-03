"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"

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
