import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Soniox: server genererer kortlivet token → browser kobler direkte til Soniox
// API-nøkkelen forlater aldri serveren
const TOKEN_URL = "https://api.soniox.com/v1/auth/client-token"

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

  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiration_seconds: 120 }),
    })
  } catch (e) {
    console.error("Nettverksfeil mot Soniox:", e)
    return NextResponse.json(
      { feil: "Nettverksfeil mot Soniox" },
      { status: 502 }
    )
  }

  const tekst = await res.text()

  if (!res.ok) {
    console.error(`Soniox token-feil (${res.status}):`, tekst)
    return NextResponse.json(
      { feil: `Soniox svarte med ${res.status}: ${tekst.substring(0, 120)}` },
      { status: 502 }
    )
  }

  try {
    const data = JSON.parse(tekst)
    const token = data.token ?? data.client_token ?? data.id
    if (!token) throw new Error("Token mangler i svar")
    return NextResponse.json({ token })
  } catch {
    console.error("Ugyldig JSON fra Soniox:", tekst)
    return NextResponse.json(
      { feil: "Ugyldig svar fra Soniox" },
      { status: 502 }
    )
  }
}
