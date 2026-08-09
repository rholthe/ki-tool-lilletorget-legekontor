import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/admin"

const SONIOX_API_HOST =
  process.env.SONIOX_API_HOST ?? "https://api.soniox.com"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 403 })
  }

  const apiKey = process.env.SONIOX_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, feil: "SONIOX_API_KEY mangler i .env" },
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
        expires_in_seconds: 60,
      }),
    })
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Nettverksfeil"
    return NextResponse.json({ ok: false, feil: melding }, { status: 502 })
  }

  if (!res.ok) {
    const tekst = await res.text().catch(() => "")
    return NextResponse.json(
      {
        ok: false,
        feil: `Soniox svarte med HTTP ${res.status}${tekst ? `: ${tekst.substring(0, 120)}` : ""}`,
      },
      { status: 502 }
    )
  }

  try {
    const data = await res.json()
    if (!data.api_key) throw new Error("api_key mangler i svar fra Soniox")
    return NextResponse.json({ ok: true, endepunkt: SONIOX_API_HOST })
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Ugyldig svar fra Soniox"
    return NextResponse.json({ ok: false, feil: melding }, { status: 502 })
  }
}
