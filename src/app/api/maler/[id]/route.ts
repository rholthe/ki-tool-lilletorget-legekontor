import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const { id } = await params
  const eksisterende = await prisma.mal.findUnique({ where: { id } })
  if (!eksisterende || eksisterende.eierBrukerId !== session.user.id) {
    return NextResponse.json({ feil: "Ikke funnet" }, { status: 404 })
  }

  const body = await req.json()
  const { tittel, beskrivelse, innhold, erDelt } = body

  if (!tittel?.trim() || !innhold?.trim()) {
    return NextResponse.json({ feil: "Mangler påkrevde felter" }, { status: 400 })
  }

  const oppdatert = await prisma.mal.update({
    where: { id },
    data: {
      tittel: tittel.trim(),
      beskrivelse: beskrivelse?.trim() || null,
      innhold: innhold.trim(),
      erDelt: Boolean(erDelt),
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

  return NextResponse.json(oppdatert)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const { id } = await params
  const eksisterende = await prisma.mal.findUnique({ where: { id } })
  if (!eksisterende || eksisterende.eierBrukerId !== session.user.id) {
    return NextResponse.json({ feil: "Ikke funnet" }, { status: 404 })
  }

  await prisma.mal.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
