import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { encrypt, decrypt } from "@/lib/crypto"

/**
 * Brukerens nøkkel for kryptering av konsultasjoner i nettleseren (AES-256-GCM).
 * Opprettes ved første forespørsel og lagres kryptert med serverens hovednøkkel.
 * Nettleseren holder den bare i minnet: utlogget eller lukket nettleser = låst,
 * ny innlogging = åpnet igjen. Serveren ser aldri pasientinnhold, bare nøkkelen.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }
  const userId = session.user.id

  let nokkel: string
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { datanokkel: true } })
  if (!bruker) return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })

  if (bruker.datanokkel) {
    nokkel = decrypt(bruker.datanokkel)
  } else {
    nokkel = randomBytes(32).toString("base64")
    // Betinget oppdatering: vinner en samtidig forespørsel kappløpet, brukes dens nøkkel
    const { count } = await prisma.user.updateMany({
      where: { id: userId, datanokkel: null },
      data: { datanokkel: encrypt(nokkel) },
    })
    if (count === 0) {
      const lagret = await prisma.user.findUnique({ where: { id: userId }, select: { datanokkel: true } })
      nokkel = decrypt(lagret!.datanokkel!)
    }
  }

  return NextResponse.json(
    { userId, nokkel },
    { headers: { "Cache-Control": "no-store, private" } }
  )
}
