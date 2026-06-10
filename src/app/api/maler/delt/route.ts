import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { MalKategori } from "@prisma/client"

const GYLDIGE_KATEGORIER: MalKategori[] = ["KONSULTASJON", "MOTE", "CHAT"]

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const kategoriParam = searchParams.get("kategori") as MalKategori | null

  const maler = await prisma.mal.findMany({
    where: {
      erDelt: true,
      eierBrukerId: { not: session.user.id },
      ...(kategoriParam && GYLDIGE_KATEGORIER.includes(kategoriParam)
        ? { kategori: kategoriParam }
        : {}),
    },
    select: {
      id: true,
      tittel: true,
      beskrivelse: true,
      innhold: true,
      kategori: true,
      eier: { select: { name: true, email: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(maler)
}
