"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { felterSkjema } from "@/lib/skjema/skjema-server"

export type SkjemaSvar = { ok: true; id?: string } | { ok: false; feil: string }

async function adminEpost(): Promise<string | null> {
  const session = await auth()
  const epost = session?.user?.email
  return epost && isAdmin(epost) ? epost : null
}

function forsteFeil(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Ugyldige data"
}

const kategoriSkjema = z.object({
  navn: z.string().trim().min(2, "Navnet er for kort").max(100),
  rekkefolge: z.number().int().min(0).max(999).default(0),
})

export async function lagreSkjemaKategori(inn: { id?: string; navn: string; rekkefolge?: number }): Promise<SkjemaSvar> {
  if (!(await adminEpost())) return { ok: false, feil: "Uautorisert." }
  const parsed = kategoriSkjema.safeParse(inn)
  if (!parsed.success) return { ok: false, feil: forsteFeil(parsed.error) }

  const finnes = await prisma.skjemaKategori.findUnique({ where: { navn: parsed.data.navn } })
  if (finnes && finnes.id !== inn.id) return { ok: false, feil: "Det finnes allerede en kategori med dette navnet." }

  const k = inn.id
    ? await prisma.skjemaKategori.update({ where: { id: inn.id }, data: parsed.data })
    : await prisma.skjemaKategori.create({ data: parsed.data })
  revalidatePath("/admin/skjema")
  return { ok: true, id: k.id }
}

export async function slettSkjemaKategori(id: string): Promise<SkjemaSvar> {
  if (!(await adminEpost())) return { ok: false, feil: "Uautorisert." }
  const antall = await prisma.skjema.count({ where: { kategoriId: id } })
  if (antall > 0) return { ok: false, feil: "Kategorien har skjema. Flytt eller slett dem først." }
  await prisma.skjemaKategori.deleteMany({ where: { id } })
  revalidatePath("/admin/skjema")
  return { ok: true }
}

const skjemaSkjema = z.object({
  kategoriId: z.string().min(1, "Velg kategori"),
  navn: z.string().trim().min(2, "Navnet er for kort").max(200),
  beskrivelse: z.string().trim().max(500).optional(),
  prompt: z.string().trim().max(20_000),
  felter: felterSkjema,
  aktiv: z.boolean(),
})

export async function lagreSkjema(inn: z.input<typeof skjemaSkjema> & { id?: string }): Promise<SkjemaSvar> {
  const epost = await adminEpost()
  if (!epost) return { ok: false, feil: "Uautorisert." }
  const parsed = skjemaSkjema.safeParse(inn)
  if (!parsed.success) return { ok: false, feil: forsteFeil(parsed.error) }
  const d = parsed.data

  if (!(await prisma.skjemaKategori.findUnique({ where: { id: d.kategoriId } }))) {
    return { ok: false, feil: "Kategorien finnes ikke." }
  }
  const data = {
    kategoriId: d.kategoriId,
    navn: d.navn,
    beskrivelse: d.beskrivelse || null,
    prompt: d.prompt,
    felter: JSON.stringify(d.felter),
    aktiv: d.aktiv,
  }
  const s = inn.id
    ? await prisma.skjema.update({ where: { id: inn.id }, data })
    : await prisma.skjema.create({ data: { ...data, opprettetAv: epost } })
  revalidatePath("/admin/skjema")
  return { ok: true, id: s.id }
}

export async function slettSkjema(id: string): Promise<SkjemaSvar> {
  if (!(await adminEpost())) return { ok: false, feil: "Uautorisert." }
  await prisma.skjema.deleteMany({ where: { id } })
  revalidatePath("/admin/skjema")
  return { ok: true }
}
