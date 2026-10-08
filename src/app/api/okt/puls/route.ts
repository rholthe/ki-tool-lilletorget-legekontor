import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Livstegn fra en aktiv klient (bruker som skriver, klikker eller tar opp).
 * Selve fornyelsen skjer i proxyen/JWT-callbacken, som oppdaterer sistAktiv
 * på hver forespørsel — dette endepunktet sørger bare for at det kommer én.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 })
  return new NextResponse(null, { status: 204 })
}
