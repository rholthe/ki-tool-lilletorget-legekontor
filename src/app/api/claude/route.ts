import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk"
import { TYPE_STAGING, type KonsultasjonsType } from "@/types/konsultasjon"

interface RequestBody {
  type: KonsultasjonsType
  transkript: string
  kontekst: string
  tilleggsinfo: string
  malInnhold: string | null
}

function lagBedrockKlient() {
  return new AnthropicBedrock({
    // AWS Bedrock krever to nøkler:
    // BEDROCK_API_KEY  = AWS Access Key ID (starter typisk med AKIA...)
    // BEDROCK_SECRET_KEY = AWS Secret Access Key
    awsAccessKey: process.env.BEDROCK_API_KEY ?? "",
    awsSecretKey: process.env.BEDROCK_SECRET_KEY ?? "",
    // EU North 1 (Stockholm) for GDPR/personvern
    awsRegion: "eu-north-1",
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  if (!process.env.BEDROCK_API_KEY || !process.env.BEDROCK_SECRET_KEY) {
    return NextResponse.json(
      {
        feil:
          "Bedrock-nøkler mangler. Sett BEDROCK_API_KEY (Access Key ID) og BEDROCK_SECRET_KEY i .env",
      },
      { status: 500 }
    )
  }

  const body: RequestBody = await req.json()

  // Bygg systemprompt: staging-tekst + eventuell notatmal
  const stagingTekst = TYPE_STAGING[body.type]
  const systemPrompt = body.malInnhold
    ? `${stagingTekst}\n\n${body.malInnhold}`
    : stagingTekst

  // Bygg brukermelding
  const deler: string[] = []
  if (body.kontekst?.trim())
    deler.push(`**Kontekst (epikriser, tidligere notater):**\n${body.kontekst}`)
  if (body.tilleggsinfo?.trim())
    deler.push(`**Tilleggsopplysninger:**\n${body.tilleggsinfo}`)
  if (body.transkript?.trim())
    deler.push(`**Transkript av konsultasjonen:**\n${body.transkript}`)

  if (deler.length === 0) {
    return NextResponse.json(
      { feil: "Ingen data å generere notat fra" },
      { status: 400 }
    )
  }

  const brukerMelding = deler.join("\n\n---\n\n")

  // Bedrock-modell: krever "anthropic."-prefiks
  const model =
    process.env.ANTHROPIC_MODEL ?? "anthropic.claude-opus-4-8"

  const client = lagBedrockKlient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = client.messages.stream({
          model,
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          system: systemPrompt,
          messages: [{ role: "user", content: brukerMelding }],
        })

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              )
            )
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (e) {
        const melding = e instanceof Error ? e.message : "Ukjent Bedrock-feil"
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ feil: melding })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
