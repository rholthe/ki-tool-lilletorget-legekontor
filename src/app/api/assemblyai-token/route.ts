import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// v3 Streaming API — token genereres fra streaming.assemblyai.com
const TOKEN_URL = "https://streaming.assemblyai.com/v3/token"

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
    res = await fetch(`${TOKEN_URL}?expires_in=60`, {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
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
      { feil: `AssemblyAI svarte med ${res.status}: ${tekst.substring(0, 120)}` },
      { status: 502 }
    )
  }

  try {
    const data = JSON.parse(tekst)
    const token = data.token ?? data.id
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
