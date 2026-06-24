"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"

const skjema = z.object({
  versjon: z
    .string()
    .trim()
    .min(1, "Oppgi et versjonsnummer")
    .max(20, "Maks 20 tegn")
    .regex(/^[\w.\- ]+$/, "Kun bokstaver, tall, punktum og bindestrek"),
  innhold: z.string().trim().min(20, "Avtaleteksten er for kort"),
})

export type OpprettDpaState = {
  errors?: { versjon?: string[]; innhold?: string[] }
  message?: string
  success?: boolean
}

export async function opprettDpaVersjon(
  _prev: OpprettDpaState,
  formData: FormData
): Promise<OpprettDpaState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { message: "Uautorisert." }
  }

  const parsed = skjema.safeParse({
    versjon: formData.get("versjon"),
    innhold: formData.get("innhold"),
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { versjon, innhold } = parsed.data
  const krevNySignering = formData.get("krevNySignering") === "ja"

  const finnes = await prisma.dpaVersjon.findUnique({ where: { versjon } })
  if (finnes) {
    return { errors: { versjon: ["Denne versjonen finnes allerede"] } }
  }

  // Gjør den nye versjonen gjeldende; gamle beholdes uendret (immutable)
  await prisma.$transaction([
    prisma.dpaVersjon.updateMany({ where: { gjeldende: true }, data: { gjeldende: false } }),
    prisma.dpaVersjon.create({
      data: {
        versjon,
        innhold,
        krevNySignering,
        gjeldende: true,
        opprettetAv: session.user.email,
      },
    }),
  ])

  revalidatePath("/admin/databehandleravtale")
  revalidatePath("/databehandleravtale")

  return {
    success: true,
    message: krevNySignering
      ? `Versjon ${versjon} er publisert. Alle brukere må signere på nytt ved neste innlogging.`
      : `Versjon ${versjon} er publisert som gjeldende.`,
  }
}
