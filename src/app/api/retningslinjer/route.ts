import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hentRetningslinjer } from "@/lib/hapi/retningslinjer-server"

/**
 * Retningslinjer fra Helsedirektoratet (mellomlagret). Offentlig innhold, men
 * bare for innloggede — nøkkelen og kvoten er vår.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }
  const retningslinjer = await hentRetningslinjer()
  return NextResponse.json(
    { retningslinjer },
    // Nettleseren kan gjenbruke svaret en stund; innholdet endres sjelden
    { headers: { "Cache-Control": "private, max-age=3600" } }
  )
}
