"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"

/** Brukeren bekrefter at meldingen er lest. Idempotent. */
export async function markerMeldingLest(meldingId: string): Promise<{ ok: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false }

  const melding = await prisma.melding.findUnique({
    where: { id: meldingId },
    select: { id: true },
  })
  if (!melding) return { ok: false }

  await prisma.meldingLest.upsert({
    where: { meldingId_userId: { meldingId, userId: session.user.id } },
    create: { meldingId, userId: session.user.id },
    update: {},
  })
  return { ok: true }
}

const skjema = z.object({
  tittel: z.string().trim().min(3, "Tittelen er for kort").max(200, "Maks 200 tegn"),
  innhold: z.string().trim().min(20, "Meldingen er for kort"),
})

export type OpprettMeldingState = {
  errors?: { tittel?: string[]; innhold?: string[] }
  message?: string
  success?: boolean
}

export async function opprettMelding(
  _prev: OpprettMeldingState,
  formData: FormData
): Promise<OpprettMeldingState> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return { message: "Uautorisert." }
  }

  const parsed = skjema.safeParse({
    tittel: formData.get("tittel"),
    innhold: formData.get("innhold"),
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await prisma.melding.create({
    data: { ...parsed.data, opprettetAv: session.user.email },
  })

  revalidatePath("/admin/meldinger")
  return {
    success: true,
    message: "Meldingen er publisert. Brukerne ser den neste gang de åpner appen.",
  }
}

/** Trekk tilbake eller publiser på nytt. Lesestatus beholdes. */
export async function settMeldingAktiv(meldingId: string, aktiv: boolean): Promise<{ ok: boolean }> {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) return { ok: false }

  await prisma.melding.update({ where: { id: meldingId }, data: { aktiv } })
  revalidatePath("/admin/meldinger")
  return { ok: true }
}
