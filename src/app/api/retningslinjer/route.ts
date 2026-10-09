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
    // Ingen mellomlagring i nettleseren: et gammelt svar ville skjult nye retningslinjer og
    // forløp i opptil en time, også etter deploy. Siden henter uansett bare én gang per visning
    { headers: { "Cache-Control": "no-store" } }
  )
}
