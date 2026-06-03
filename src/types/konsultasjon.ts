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

export const TYPE_STAGING: Record<KonsultasjonsType, string> = {
  KONSULTASJON:
    "Du er fastlege og har en pasient på kontoret. Generer et journalnotat basert på konsultasjonen.",
  TELEFONKONSULTASJON:
    "Du er fastlege og tar en telefonkonsultasjon med en pasient. Generer et journalnotat basert på samtalen.",
  DIALOGMOTE_NAV:
    "Du er fastlege og deltar i et dialogmøte med NAV og en pasient. Generer et referat/notat basert på møtet.",
}

export const TTL_MS = 24 * 60 * 60 * 1000 // 24 timer
