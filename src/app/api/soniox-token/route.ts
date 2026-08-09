import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

// Soniox token-endepunkt (fra offisiell demo: soniox_examples/apps/soniox-live-demo/server)
// SONIOX_API_HOST kan settes til EU-spesifikt endepunkt når Soniox tilbyr det
// Kontakt Soniox support for å bekrefte EU-endepunkt for GDPR-compliance
const SONIOX_API_HOST =
  process.env.SONIOX_API_HOST ?? "https://api.soniox.com"

// WebSocket-URL returneres til klienten slik at EU-endepunkt styres server-side
// Sett SONIOX_WS_URL til EU-endepunkt når bekreftet av Soniox
const SONIOX_WS_URL =
  process.env.SONIOX_WS_URL ??
  "wss://stt-rt.soniox.com/transcribe-websocket"

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
    res = await fetch(`${SONIOX_API_HOST}/v1/auth/temporary-api-key`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usage_type: "transcribe_websocket",
        expires_in_seconds: 120,
      }),
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
    const token = data.api_key
    if (!token) throw new Error("api_key mangler i svar")
    // Returner også wsUrl slik at EU-endepunkt styres server-side
    return NextResponse.json({ token, wsUrl: SONIOX_WS_URL })
  } catch {
    console.error("Ugyldig JSON fra Soniox:", tekst)
    return NextResponse.json(
      { feil: "Ugyldig svar fra Soniox" },
      { status: 502 }
    )
  }
}
