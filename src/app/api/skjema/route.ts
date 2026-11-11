import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { hentSkjemaKategorier } from "@/lib/skjema/skjema-server"

/**
 * Aktive skjema per kategori, til oppgavetypen «Skjema». Bare definisjoner, pluss legens
 * eget navn og HPR-nummer til felt med `lege.*` som kilde.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  const [kategorier, bruker] = await Promise.all([
    hentSkjemaKategorier(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, hprNummer: true } }),
  ])
  const lege = { navn: bruker?.name?.trim() ?? "", hpr: bruker?.hprNummer ?? "" }
  return NextResponse.json({ kategorier, lege }, { headers: { "Cache-Control": "no-store" } })
}
