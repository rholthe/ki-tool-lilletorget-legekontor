import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hentLeseIndekser, hentRetningslinjer } from "@/lib/hapi/retningslinjer-server"

/**
 * Retningslinjer fra Helsedirektoratet (mellomlagret): antibiotikaretningslinjen
 * i sin helhet, og innholdsfortegnelsene for retningslinjene til oppslag.
 * Offentlig innhold, men bare for innloggede — nøkkelen og kvoten er vår.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }
  const [retningslinjer, { indekser, venter }] = await Promise.all([
    hentRetningslinjer(),
    hentLeseIndekser(),
  ])
  return NextResponse.json(
    { retningslinjer, lese: indekser, leseVenter: venter },
    // Nettleseren kan gjenbruke svaret en stund, men ikke mens noe ennå hentes
    { headers: { "Cache-Control": venter > 0 ? "no-store" : "private, max-age=3600" } }
  )
}
