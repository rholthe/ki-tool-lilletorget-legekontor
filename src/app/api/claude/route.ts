import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk"
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages"
import {
  TYPE_STAGING,
  KONSULTASJON_FORM_STAGING,
  type KonsultasjonsType,
  type KonsultasjonsForm,
  type Vedlegg,
} from "@/types/konsultasjon"
import {
  hentSystemSetting,
  standardModell,
  standardRegion,
} from "@/lib/admin"
import { lagVedleggInstruksjon } from "@/lib/vedlegg"

interface RequestBody {
  type: KonsultasjonsType
  konsultasjonsform?: KonsultasjonsForm
  transkript: string
  kontekst: string
  tilleggsinfo: string
  malInnhold: string | null
  vedlegg?: Pick<Vedlegg, "mimeType" | "base64" | "oppgave" | "spirometriType" | "egendefinertPrompt">[]
}

async function lagBedrockKlient() {
  const region = await hentSystemSetting("bedrock_region", standardRegion())
  return new AnthropicBedrock({
    awsAccessKey: process.env.BEDROCK_API_KEY ?? "",
    awsSecretKey: process.env.BEDROCK_SECRET_KEY ?? "",
    awsRegion: region,
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
          "Bedrock-nøkler mangler. Sett BEDROCK_API_KEY og BEDROCK_SECRET_KEY i .env",
      },
      { status: 500 }
    )
  }

  const body: RequestBody = await req.json()

  const stagingTekst =
    body.type === "KONSULTASJON" && body.konsultasjonsform
      ? KONSULTASJON_FORM_STAGING[body.konsultasjonsform]
      : TYPE_STAGING[body.type]
  const systemPrompt = body.malInnhold
    ? `${stagingTekst}\n\n${body.malInnhold}`
    : stagingTekst

  const deler: string[] = []
  if (body.kontekst?.trim())
    deler.push(`**Kontekst (epikriser, tidligere notater):**\n${body.kontekst}`)
  if (body.tilleggsinfo?.trim())
    deler.push(`**Tilleggsopplysninger:**\n${body.tilleggsinfo}`)
  if (body.transkript?.trim())
    deler.push(
      `**${body.type === "DIKTAT" ? "Diktat" : "Transkript av konsultasjonen"}:**\n${body.transkript}`
    )

  if (deler.length === 0) {
    return NextResponse.json(
      { feil: "Ingen data å generere notat fra" },
      { status: 400 }
    )
  }

  const brukerMelding = deler.join("\n\n---\n\n")

  // Bygg multi-modal content array (tekst + eventuelle vedlegg)
  const contentBlocks: ContentBlockParam[] = [{ type: "text", text: brukerMelding }]

  for (const v of body.vedlegg ?? []) {
    contentBlocks.push({ type: "text", text: lagVedleggInstruksjon(v as Vedlegg) })
    if (v.mimeType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: v.base64 },
      })
    } else {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: v.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: v.base64,
        },
      })
    }
  }

  const model = await hentSystemSetting("bedrock_model", standardModell())
  const client = await lagBedrockKlient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = client.messages.stream({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: contentBlocks }],
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
