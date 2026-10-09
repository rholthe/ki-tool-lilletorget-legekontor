import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { hentLeseRetningslinje } from "@/lib/hapi/retningslinjer-server"

/** Én retningslinje med all tekst, når legen åpner den i leseren. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }
  const { id } = await params
  const retningslinje = await hentLeseRetningslinje(id)
  if (!retningslinje) return NextResponse.json({ feil: "Ikke funnet" }, { status: 404 })
  // Samme som listen: ikke mellomlagret i nettleseren, så oppdatert tekst vises med en gang
  return NextResponse.json(retningslinje, { headers: { "Cache-Control": "no-store" } })
}
