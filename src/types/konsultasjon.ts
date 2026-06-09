export type KonsultasjonsType =
  | "KONSULTASJON"
  | "TELEFONKONSULTASJON"
  | "DIALOGMOTE_NAV"

export type KonsultasjonsStatus =
  | "ny"
  | "opptar"
  | "pause"
  | "prosesserer"
  | "ferdig"

export type VedleggOppgave =
  | "ekg"
  | "spirometri"
  | "ocr"
  | "egendefinert"
  | "kontekst"

export type SpirometriType =
  | "uten_bronkodilator"
  | "etter_aktivitet"
  | "med_bronkodilator"

export interface Vedlegg {
  id: string
  navn: string
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp"
    | "application/pdf"
  base64: string
  oppgave: VedleggOppgave
  spirometriType?: SpirometriType
  egendefinertPrompt?: string
}

export interface ChatMelding {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
}

export interface Konsultasjon {
  id: string
  type: KonsultasjonsType
  pasientId: string
  transkript: string
  notat: string
  kontekst: string
  tilleggsinfo: string
  malId: string | null
  malInnhold: string | null
  vedlegg?: Vedlegg[]
  status: KonsultasjonsStatus
  createdAt: number
  expiresAt: number
  chatHistorikk?: ChatMelding[]
  chatKontekstSnapshot?: {
    transkript: string
    kontekst: string
    tilleggsinfo: string
    vedleggIds: string[]
  }
}

export const TYPE_LABELS: Record<KonsultasjonsType, string> = {
  KONSULTASJON: "Konsultasjon",
  TELEFONKONSULTASJON: "Telefonkonsultasjon",
  DIALOGMOTE_NAV: "Dialogmøte NAV",
}

export { TYPE_STAGING } from "@/lib/staging"

export const TTL_MS = 24 * 60 * 60 * 1000 // 24 timer
