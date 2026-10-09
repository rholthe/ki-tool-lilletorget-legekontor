import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentHapiStatus, lagreUtvalg, oppdaterAlleNaa } from "@/lib/hapi/retningslinjer-server"

async function erAdmin() {
  const session = await auth()
  return isAdmin(session?.user?.email)
}

export async function GET() {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  return NextResponse.json(await hentHapiStatus())
}

/** Henter alt fra Helsedirektoratet nå, i stedet for å vente på døgnoppdateringen. */
export async function POST() {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  try {
    return NextResponse.json(await oppdaterAlleNaa())
  } catch (e) {
    const status = await hentHapiStatus()
    return NextResponse.json(
      { ...status, feil: e instanceof Error ? e.message : "Henting feilet" },
      { status: 502 }
    )
  }
}

const Utvalg = z.object({ ider: z.array(z.string().regex(/^[0-9a-f-]{36}$/)).max(200) })

/** Lagrer hvilke retningslinjer som skal være med i leseren. */
export async function PUT(req: Request) {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  const parsed = Utvalg.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ feil: "Ugyldig utvalg" }, { status: 400 })
  await lagreUtvalg(parsed.data.ider)
  return NextResponse.json(await hentHapiStatus())
}
