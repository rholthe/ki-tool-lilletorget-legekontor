import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Soniox bruker api_key direkte i første WebSocket-melding (ingen temp-token endpoint).
// Vi returnerer nøkkelen kun til autentiserte brukere — pasientdata berører aldri serveren.
export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const apiKey = process.env.SONIOX_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { feil: "Soniox API-nøkkel mangler på server (SONIOX_API_KEY)" },
      { status: 500 }
    )
  }

  return NextResponse.json({ apiKey })
}
