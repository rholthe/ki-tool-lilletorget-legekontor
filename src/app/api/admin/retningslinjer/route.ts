import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/admin"
import { hentHapiStatus, oppdaterRetningslinjerNaa } from "@/lib/hapi/retningslinjer-server"

async function erAdmin() {
  const session = await auth()
  return isAdmin(session?.user?.email)
}

export async function GET() {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  return NextResponse.json(await hentHapiStatus())
}

/** Henter fra Helsedirektoratet nå, i stedet for å vente på døgnoppdateringen. */
export async function POST() {
  if (!(await erAdmin())) return NextResponse.json({ feil: "Ingen tilgang" }, { status: 403 })
  try {
    return NextResponse.json(await oppdaterRetningslinjerNaa())
  } catch (e) {
    const status = await hentHapiStatus()
    return NextResponse.json(
      { ...status, feil: e instanceof Error ? e.message : "Henting feilet" },
      { status: 502 }
    )
  }
}
