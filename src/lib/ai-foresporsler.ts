import type { ContentBlockParam, MessageParam } from "@anthropic-ai/sdk/resources/messages"
import type { KonsultasjonsType, KonsultasjonsForm, Vedlegg } from "@/types/konsultasjon"
import type { VerktoyResultat } from "@/lib/verktoy/typer"
import { formaterTilNotat } from "@/lib/verktoy/beregn"
import { PROMPTBYGGER_STAGING } from "@/lib/staging"
import {
  byggStaging,
  byggChatStaging,
  resolverVedleggInstruksjon,
  type StagingOverrides,
} from "@/lib/staging-bygg"

/**
 * Bygger Claude-forespørslene i nettleseren. Tidligere lå dette i
 * /api/claude og /api/chat; nå sendes pasientinnholdet
 * rett fra nettleseren til Bedrock og er aldri innom serveren.
 */

export interface AiForesporsel {
  system: string
  messages: MessageParam[]
  maxTokens: number
}

type VedleggInn = Pick<Vedlegg, "mimeType" | "base64" | "oppgave" | "spirometriType" | "egendefinertPrompt">

function vedleggBlokk(v: VedleggInn): ContentBlockParam {
  if (v.mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: v.base64 } }
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: v.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: v.base64,
    },
  }
}

// ─── Notat ────────────────────────────────────────────────────────────────────

export interface NotatInn {
  type: KonsultasjonsType
  konsultasjonsform?: KonsultasjonsForm
  transkript: string
  kontekst: string
  tilleggsinfo: string
  malInnhold: string | null
  vedlegg?: VedleggInn[]
  verktoyResultater?: VerktoyResultat[]
}

export function byggNotatForesporsel(inn: NotatInn, overrides: StagingOverrides): AiForesporsel {
  const verktoyTekst = (inn.verktoyResultater ?? []).map(formaterTilNotat).join("\n\n")
  const stagingTekst = byggStaging(inn.type, inn.konsultasjonsform, overrides, verktoyTekst)
  const system = inn.malInnhold ? `${stagingTekst}\n\n${inn.malInnhold}` : stagingTekst

  const deler: string[] = []
  if (inn.kontekst?.trim()) deler.push(`**Kontekst (epikriser, tidligere notater):**\n${inn.kontekst}`)
  if (inn.tilleggsinfo?.trim()) deler.push(`**Tilleggsopplysninger:**\n${inn.tilleggsinfo}`)
  if (inn.transkript?.trim())
    deler.push(`**${inn.type === "DIKTAT" ? "Diktat" : "Transkript av konsultasjonen"}:**\n${inn.transkript}`)
  if (deler.length === 0) throw new Error("Ingen data å generere notat fra")

  const innhold: ContentBlockParam[] = [{ type: "text", text: deler.join("\n\n---\n\n") }]
  for (const v of inn.vedlegg ?? []) {
    innhold.push({ type: "text", text: resolverVedleggInstruksjon(v as Vedlegg, overrides) })
    innhold.push(vedleggBlokk(v))
  }
  return { system, messages: [{ role: "user", content: innhold }], maxTokens: 32000 }
}

// ─── Chat / AI-hjelp / promptbygger ──────────────────────────────────────────

export interface ChatInn {
  transkript: string
  kontekst: string
  tilleggsinfo: string
  notat: string
  vedlegg?: VedleggInn[]
  messages: { role: "user" | "assistant"; content: string }[]
  nyMelding: string
  /** "aihjelp" = frittstående AI-hjelp, "promptbygger" = lag prompt med AI, ellers konsultasjonschat. */
  modus?: "aihjelp" | "promptbygger"
}

export function byggChatForesporsel(inn: ChatInn, overrides: StagingOverrides): AiForesporsel {
  const deler: string[] = []
  if (inn.kontekst?.trim()) deler.push(`**Kontekst (epikriser, tidligere notater):**\n${inn.kontekst}`)
  if (inn.tilleggsinfo?.trim()) deler.push(`**Tilleggsopplysninger:**\n${inn.tilleggsinfo}`)
  if (inn.transkript?.trim()) deler.push(`**Transkript av konsultasjonen:**\n${inn.transkript}`)
  if (inn.notat?.trim()) deler.push(`**Generert journalnotat (SOAP):**\n${inn.notat}`)
  const kontekstTekst = deler.length > 0 ? deler.join("\n\n---\n\n") : "(Ingen kontekst lagt til ennå)"

  const system =
    inn.modus === "promptbygger"
      ? PROMPTBYGGER_STAGING
      : byggChatStaging(inn.modus === "aihjelp" ? "aihjelp" : "chat", kontekstTekst, overrides)

  // Vedlegg kun på første melding, uten oppgave-instruksjon — legen styrer selv
  const ny: ContentBlockParam[] = [{ type: "text", text: inn.nyMelding }]
  if (inn.messages.length === 0) for (const v of inn.vedlegg ?? []) ny.push(vedleggBlokk(v))

  return {
    system,
    messages: [...inn.messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: ny }],
    maxTokens: 16000,
  }
}
