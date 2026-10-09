import {
  KONSULTASJON,
  TELEFONKONSULTASJON,
  VIDEOKONSULTASJON,
  MOTE,
  DIKTAT,
  JOURNALGJENNOMGANG,
  CHAT_STAGING,
  AIHJELP_STAGING,
  VEDLEGG_SEKSJON,
  VERKTOY_SEKSJON,
  STIKKORD_SEKSJON,
} from "@/lib/staging"
import { VEDLEGG_INSTRUKS_DEFAULT } from "@/lib/vedlegg"

export type StagingGruppe = "Notattyper" | "Vedlegg" | "Felles"

export interface StagingEntry {
  /** Nøkkel uten `staging:`-prefiks (DB-nøkkelen blir `staging:<key>`). */
  key: string
  gruppe: StagingGruppe
  label: string
  beskrivelse: string
  /** Fil-basert standardtekst — fallback når admin ikke har satt en override. */
  standard: string
}

/**
 * Kanonisk liste over overstyrbare staging-tekster. Brukes av admin-API-et til å
 * enumere oppføringer, og av server-resolveren til å finne fil-standard.
 *
 * Notattyper er GRUNNTEKST — server-resolveren legger på felles seksjoner
 * (vedleggseksjon + stikkord) automatisk, slik at `STIKKORD:`-formatet styres
 * sentralt via `felles:stikkord`.
 */
export const STAGING_REGISTRY: StagingEntry[] = [
  // ── Notattyper (grunntekst) ──
  {
    key: "type:KONSULTASJON",
    gruppe: "Notattyper",
    label: "Konsultasjon (fysisk)",
    beskrivelse: "Grunntekst for fysisk konsultasjon. Stikkord og vedleggseksjon legges på automatisk.",
    standard: KONSULTASJON,
  },
  {
    key: "type:TELEFONKONSULTASJON",
    gruppe: "Notattyper",
    label: "Telefonkonsultasjon",
    beskrivelse: "Grunntekst for telefonkonsultasjon. Stikkord og vedleggseksjon legges på automatisk.",
    standard: TELEFONKONSULTASJON,
  },
  {
    key: "type:VIDEOKONSULTASJON",
    gruppe: "Notattyper",
    label: "Videokonsultasjon",
    beskrivelse: "Grunntekst for videokonsultasjon. Stikkord og vedleggseksjon legges på automatisk.",
    standard: VIDEOKONSULTASJON,
  },
  {
    key: "type:MOTE",
    gruppe: "Notattyper",
    label: "Møte",
    beskrivelse: "Grunntekst for møtereferat. Stikkord og vedleggseksjon legges på automatisk.",
    standard: MOTE,
  },
  {
    key: "type:DIKTAT",
    gruppe: "Notattyper",
    label: "Diktat",
    beskrivelse: "Grunntekst for diktat/språkvask. Stikkord legges på automatisk.",
    standard: DIKTAT,
  },
  {
    key: "type:JOURNALGJENNOMGANG",
    gruppe: "Notattyper",
    label: "Journalgjennomgang",
    beskrivelse: "Grunntekst for journalgjennomgang. Stikkord legges på automatisk.",
    standard: JOURNALGJENNOMGANG,
  },
  {
    key: "chat",
    gruppe: "Notattyper",
    label: "Chat (i konsultasjon)",
    beskrivelse: "Systemprompt for chat i konsultasjon. Må inneholde plassholderen {KONTEKST}.",
    standard: CHAT_STAGING,
  },
  {
    key: "aihjelp",
    gruppe: "Notattyper",
    label: "AI-hjelp (frittstående)",
    beskrivelse: "Systemprompt for frittstående AI-hjelp. Må inneholde plassholderen {KONTEKST}.",
    standard: AIHJELP_STAGING,
  },

  // ── Vedlegg (full instruks) ──
  {
    key: "vedlegg:ekg",
    gruppe: "Vedlegg",
    label: "EKG",
    beskrivelse: "Instruks for tolkning av EKG-bilde.",
    standard: VEDLEGG_INSTRUKS_DEFAULT.ekg,
  },
  {
    key: "vedlegg:spirometri:uten_bronkodilator",
    gruppe: "Vedlegg",
    label: "Spirometri — uten bronkodilator",
    beskrivelse: "Instruks for baseline-spirometri.",
    standard: VEDLEGG_INSTRUKS_DEFAULT["spirometri:uten_bronkodilator"],
  },
  {
    key: "vedlegg:spirometri:etter_aktivitet",
    gruppe: "Vedlegg",
    label: "Spirometri — etter aktivitet",
    beskrivelse: "Instruks for anstrengelsestest.",
    standard: VEDLEGG_INSTRUKS_DEFAULT["spirometri:etter_aktivitet"],
  },
  {
    key: "vedlegg:spirometri:med_bronkodilator",
    gruppe: "Vedlegg",
    label: "Spirometri — med bronkodilator",
    beskrivelse: "Instruks for reversibilitetstest (post-BD).",
    standard: VEDLEGG_INSTRUKS_DEFAULT["spirometri:med_bronkodilator"],
  },
  {
    key: "vedlegg:ocr:kontekst",
    gruppe: "Vedlegg",
    label: "Les tekst — i kontekst",
    beskrivelse: "OCR-instruks når teksten skal brukes som kontekst.",
    standard: VEDLEGG_INSTRUKS_DEFAULT["ocr:kontekst"],
  },
  {
    key: "vedlegg:ocr:tilleggsinfo",
    gruppe: "Vedlegg",
    label: "Les tekst — i tilleggsinfo",
    beskrivelse: "OCR-instruks når teksten skal behandles som tilleggsopplysninger.",
    standard: VEDLEGG_INSTRUKS_DEFAULT["ocr:tilleggsinfo"],
  },
  {
    key: "vedlegg:ocr:ren_innlesing",
    gruppe: "Vedlegg",
    label: "Les tekst — ren innlesing",
    beskrivelse: "OCR-instruks når teksten kun skal transkriberes uten å påvirke notatet.",
    standard: VEDLEGG_INSTRUKS_DEFAULT["ocr:ren_innlesing"],
  },
  {
    key: "vedlegg:kontekst",
    gruppe: "Vedlegg",
    label: "Kun kontekst",
    beskrivelse: "Instruks for vedlegg som kun skal brukes som bakgrunn.",
    standard: VEDLEGG_INSTRUKS_DEFAULT.kontekst,
  },

  // ── Felles ──
  {
    key: "felles:stikkord",
    gruppe: "Felles",
    label: "Stikkord-instruksjon",
    beskrivelse: "Legges sist på alle notattyper. Må beholde STIKKORD:-formatet — appen henter stikkord herfra.",
    standard: STIKKORD_SEKSJON,
  },
  {
    key: "felles:vedleggseksjon",
    gruppe: "Felles",
    label: "Vedlegg-seksjon",
    beskrivelse: "Legges på konsultasjons- og møtenotater når vedlegg er aktuelle.",
    standard: VEDLEGG_SEKSJON,
  },
  {
    key: "felles:verktoy",
    gruppe: "Felles",
    label: "Kliniske verktøy-seksjon",
    beskrivelse:
      "Legges på kun når legen har utført et klinisk verktøy. Må beholde plassholderen {VERKTOY}. Appen skriver selve resultatseksjonen i notatet — teksten her skal hindre at Claude gjengir eller endrer poengsummene.",
    standard: VERKTOY_SEKSJON,
  },
]

export const STAGING_KEYS = new Set(STAGING_REGISTRY.map((e) => e.key))

export function finnStandard(key: string): string | undefined {
  return STAGING_REGISTRY.find((e) => e.key === key)?.standard
}
