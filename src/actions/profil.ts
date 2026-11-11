"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { rensHpr } from "@/lib/skjema/typer"

export type ProfilSvar = { ok: true } | { ok: false; feil: string }

/** Legens fulle navn og HPR-nummer, slik de settes inn i skjema (`lege.*`-kildene). */
export async function lagreProfil(data: { navn: string; hpr: string }): Promise<ProfilSvar> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, feil: "Du må være innlogget." }

  const navn = String(data.navn ?? "").replace(/\s+/g, " ").trim()
  if (navn.length < 2 || navn.length > 100) return { ok: false, feil: "Skriv inn fullt navn." }

  const hprTekst = String(data.hpr ?? "").trim()
  const hpr = hprTekst ? rensHpr(hprTekst) : ""
  if (hpr === null) return { ok: false, feil: "HPR-nummeret skal være 7–9 siffer." }

  await prisma.user.update({ where: { id: session.user.id }, data: { name: navn, hprNummer: hpr || null } })
  revalidatePath("/innstillinger")
  return { ok: true }
}
