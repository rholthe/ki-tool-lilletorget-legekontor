import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk"
import type { ContentBlockParam, MessageParam } from "@anthropic-ai/sdk/resources/messages"
import type { Vedlegg } from "@/types/konsultasjon"
import { hentSystemSetting, standardModell, standardRegion } from "@/lib/admin"
import { PROMPTBYGGER_STAGING } from "@/lib/staging"
import { hentStagingOverrides, byggChatStaging } from "@/lib/staging-server"
import { maaAktivere2fa } from "@/lib/to-faktor-krav"

interface ChatRequestBody {
  transkript: string
  kontekst: string
  tilleggsinfo: string
  notat: string
  vedlegg?: Pick<Vedlegg, "mimeType" | "base64" | "oppgave" | "spirometriType" | "egendefinertPrompt">[]
  messages: { role: "user" | "assistant"; content: string }[]
  nyMelding: string
  /**
   * "aihjelp" = frittstående AI-hjelp, "promptbygger" = lag prompt med AI,
   * ellers konsultasjonschat.
   */
  modus?: "aihjelp" | "promptbygger"
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
  if (await maaAktivere2fa(session.user.id)) {
    return NextResponse.json(
      { feil: "To-faktor er obligatorisk. Aktiver det under Innstillinger → Konto." },
      { status: 403 }
    )
  }

  if (!process.env.BEDROCK_API_KEY || !process.env.BEDROCK_SECRET_KEY) {
    return NextResponse.json(
      { feil: "Bedrock-nøkler mangler. Sett BEDROCK_API_KEY og BEDROCK_SECRET_KEY i .env" },
      { status: 500 }
    )
  }

  const body: ChatRequestBody = await req.json()

  // Bygg kontekstdel til system prompt
  const deler: string[] = []
  if (body.kontekst?.trim())
    deler.push(`**Kontekst (epikriser, tidligere notater):**\n${body.kontekst}`)
  if (body.tilleggsinfo?.trim())
    deler.push(`**Tilleggsopplysninger:**\n${body.tilleggsinfo}`)
  if (body.transkript?.trim())
    deler.push(`**Transkript av konsultasjonen:**\n${body.transkript}`)
  if (body.notat?.trim())
    deler.push(`**Generert journalnotat (SOAP):**\n${body.notat}`)

  const kontekstTekst = deler.length > 0 ? deler.join("\n\n---\n\n") : "(Ingen kontekst lagt til ennå)"
  let systemPrompt: string
  if (body.modus === "promptbygger") {
    systemPrompt = PROMPTBYGGER_STAGING
  } else {
    const overrides = await hentStagingOverrides()
    systemPrompt = byggChatStaging(
      body.modus === "aihjelp" ? "aihjelp" : "chat",
      kontekstTekst,
      overrides
    )
  }

  // Bygg ny brukermelding — inkluder vedlegg kun på første melding
  const erFørsteMelding = body.messages.length === 0
  const nyBrukerContent: ContentBlockParam[] = [{ type: "text", text: body.nyMelding }]

  if (erFørsteMelding) {
    for (const v of body.vedlegg ?? []) {
      // Ingen oppgave-instruksjon — legen styrer selv hva AI skal gjøre med filen
      if (v.mimeType === "application/pdf") {
        nyBrukerContent.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: v.base64 },
        })
      } else {
        nyBrukerContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: v.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: v.base64,
          },
        })
      }
    }
  }

  const bedrockMessages: MessageParam[] = [
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: nyBrukerContent },
  ]

  const model = await hentSystemSetting("bedrock_model", standardModell())
  const client = await lagBedrockKlient()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = client.messages.stream({
          model,
          max_tokens: 16000,
          system: systemPrompt,
          messages: bedrockMessages,
        })

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
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
