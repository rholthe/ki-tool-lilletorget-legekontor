import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const { id } = await params
  const kilde = await prisma.mal.findUnique({ where: { id } })

  if (!kilde || !kilde.erDelt) {
    return NextResponse.json({ feil: "Mal ikke tilgjengelig for import" }, { status: 404 })
  }

  const kopi = await prisma.mal.create({
    data: {
      tittel: kilde.tittel,
      beskrivelse: kilde.beskrivelse,
      innhold: kilde.innhold,
      kategori: kilde.kategori,
      erDelt: false,
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

  return NextResponse.json(kopi, { status: 201 })
}
