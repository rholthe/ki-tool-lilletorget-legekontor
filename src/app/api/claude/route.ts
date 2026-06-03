import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { TYPE_STAGING, type KonsultasjonsType } from "@/types/konsultasjon"

interface RequestBody {
  type: KonsultasjonsType
  transkript: string
  kontekst: string
  tilleggsinfo: string
  malInnhold: string | null
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ feil: "Uautorisert" }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { feil: "Claude API-nøkkel mangler på server (ANTHROPIC_API_KEY)" },
      { status: 500 }
    )
  }

  const body: RequestBody = await req.json()

  // Bygg systemprompt fra staging-tekst + eventuell notatmal
  const stagingTekst = TYPE_STAGING[body.type]
  const systemPrompt = body.malInnhold
    ? `${stagingTekst}\n\n${body.malInnhold}`
    : stagingTekst

  // Bygg brukermelding fra kontekst, tilleggsinfo og transkript
  const deler: string[] = []
  if (body.kontekst?.trim()) {
    deler.push(`**Kontekst (epikriser, tidligere notater):**\n${body.kontekst}`)
  }
  if (body.tilleggsinfo?.trim()) {
    deler.push(`**Tilleggsopplysninger:**\n${body.tilleggsinfo}`)
  }
  if (body.transkript?.trim()) {
    deler.push(`**Transkript av konsultasjonen:**\n${body.transkript}`)
  }

  if (deler.length === 0) {
    return NextResponse.json(
      { feil: "Ingen data å generere notat fra — legg til transkript, kontekst eller tilleggsinfo" },
      { status: 400 }
    )
  }

  const brukerMelding = deler.join("\n\n---\n\n")
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8"

  const client = new Anthropic({ apiKey })
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
        const melding = e instanceof Error ? e.message : "Ukjent Claude-feil"
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
