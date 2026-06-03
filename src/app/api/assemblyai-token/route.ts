import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Token genereres alltid fra api.assemblyai.com (ikke EU-spesifikt endepunkt).
// EU-dataprosessering skjer i WebSocket-tilkoblingen (eu.assemblyai.com/v2/realtime/ws).
const TOKEN_URL = "https://api.assemblyai.com/v2/realtime/token"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { feil: "AssemblyAI API-nøkkel mangler på server" },
      { status: 500 }
    )
  }

  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expires_in: 60 }),
    })
  } catch (e) {
    console.error("Nettverksfeil mot AssemblyAI:", e)
    return NextResponse.json(
      { feil: "Nettverksfeil mot AssemblyAI" },
      { status: 502 }
    )
  }

  const tekst = await res.text()

  if (!res.ok) {
    console.error(`AssemblyAI token-feil (${res.status}):`, tekst)
    return NextResponse.json(
      { feil: `AssemblyAI svarte med ${res.status}: ${tekst.substring(0, 100)}` },
      { status: 502 }
    )
  }

  try {
    const { token } = JSON.parse(tekst)
    if (!token) throw new Error("Token mangler i svar")
    return NextResponse.json({ token })
  } catch {
    console.error("Ugyldig JSON fra AssemblyAI:", tekst)
    return NextResponse.json(
      { feil: "Ugyldig svar fra AssemblyAI" },
      { status: 502 }
    )
  }
}
