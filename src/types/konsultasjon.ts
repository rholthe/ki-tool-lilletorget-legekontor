export type KonsultasjonsType =
  | "KONSULTASJON"
  | "TELEFONKONSULTASJON"
  | "DIALOGMOTE_NAV"

export type KonsultasjonsStatus =
  | "ny"
  | "opptar"
  | "prosesserer"
  | "ferdig"

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
  status: KonsultasjonsStatus
  createdAt: number
  expiresAt: number
}

export const TYPE_LABELS: Record<KonsultasjonsType, string> = {
  KONSULTASJON: "Konsultasjon",
  TELEFONKONSULTASJON: "Telefonkonsultasjon",
  DIALOGMOTE_NAV: "Dialogmøte NAV",
}

export { TYPE_STAGING } from "@/lib/staging"

export const TTL_MS = 24 * 60 * 60 * 1000 // 24 timer
