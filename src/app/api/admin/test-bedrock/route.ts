import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk"
import {
  isAdmin,
  hentSystemSetting,
  standardModell,
  standardRegion,
} from "@/lib/admin"

export async function POST() {
  const session = await auth()
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 403 })
  }

  if (!process.env.BEDROCK_API_KEY || !process.env.BEDROCK_SECRET_KEY) {
    return NextResponse.json(
      { feil: "Bedrock-nøkler mangler i .env" },
      { status: 500 }
    )
  }

  const model = await hentSystemSetting("bedrock_model", standardModell())
  const region = await hentSystemSetting("bedrock_region", standardRegion())

  try {
    const client = new AnthropicBedrock({
      awsAccessKey: process.env.BEDROCK_API_KEY,
      awsSecretKey: process.env.BEDROCK_SECRET_KEY,
      awsRegion: region,
    })

    const response = await client.messages.create({
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: "Si bare 'OK' på norsk." }],
    })

    const tekst =
      response.content[0]?.type === "text" ? response.content[0].text : ""

    return NextResponse.json({ ok: true, model, region, svar: tekst })
  } catch (e) {
    const melding = e instanceof Error ? e.message : "Ukjent feil"
    return NextResponse.json({ ok: false, feil: melding, model, region }, { status: 500 })
  }
}
