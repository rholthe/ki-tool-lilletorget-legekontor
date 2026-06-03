import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

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

  const res = await fetch("https://eu.assemblyai.com/v2/realtime/token", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ expires_in: 60 }),
  })

  if (!res.ok) {
    const tekst = await res.text()
    console.error("AssemblyAI token-feil:", tekst)
    return NextResponse.json(
      { feil: "Kunne ikke opprette opptak-token" },
      { status: 502 }
    )
  }

  const { token } = await res.json()
  return NextResponse.json({ token })
}
