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

  const where = {
    eierBrukerId: session.user.id,
    ...(kategoriParam && GYLDIGE_KATEGORIER.includes(kategoriParam)
      ? { kategori: kategoriParam }
      : {}),
  }

  const maler = await prisma.mal.findMany({
    where,
    select: {
      id: true,
      tittel: true,
      beskrivelse: true,
      innhold: true,
      kategori: true,
      erDelt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(maler)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const body = await req.json()
  const { tittel, beskrivelse, innhold, kategori, erDelt } = body

  if (!tittel?.trim() || !innhold?.trim() || !GYLDIGE_KATEGORIER.includes(kategori)) {
    return NextResponse.json({ feil: "Mangler påkrevde felter" }, { status: 400 })
  }

  const mal = await prisma.mal.create({
    data: {
      tittel: tittel.trim(),
      beskrivelse: beskrivelse?.trim() || null,
      innhold: innhold.trim(),
      kategori: kategori as MalKategori,
      erDelt: Boolean(erDelt),
      erPrivat: true,
      eierBrukerId: session.user.id,
    },
    select: {
      id: true,
      tittel: true,
      beskrivelse: true,
      innhold: true,
      kategori: true,
      erDelt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(mal, { status: 201 })
}
