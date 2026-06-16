import "server-only"
import { prisma } from "@/lib/db"
import { finnStandard } from "@/lib/staging-registry"
import { lagVedleggInstruksjon, vedleggInstruksNokkel } from "@/lib/vedlegg"
import type { KonsultasjonsType, KonsultasjonsForm, Vedlegg } from "@/types/konsultasjon"

const PREFIKS = "staging:"

/** Henter alle admin-overrides i én spørring. Nøkler returneres uten `staging:`-prefiks. */
export async function hentStagingOverrides(): Promise<Map<string, string>> {
  const rader = await prisma.systemSetting.findMany({
    where: { key: { startsWith: PREFIKS } },
  })
  const map = new Map<string, string>()
  for (const r of rader) map.set(r.key.slice(PREFIKS.length), r.value)
  return map
}

/** Override hvis satt, ellers fil-standard fra registeret. */
function tekst(key: string, overrides: Map<string, string>): string {
  return overrides.get(key) ?? finnStandard(key) ?? ""
}

/** Mapper type + form til riktig grunntekst-nøkkel og om vedleggseksjon skal med. */
function notattypeOppslag(
  type: KonsultasjonsType,
  form?: KonsultasjonsForm
): { baseKey: string; medVedlegg: boolean } {
  switch (type) {
    case "KONSULTASJON":
      if (form === "telefon") return { baseKey: "type:TELEFONKONSULTASJON", medVedlegg: true }
      if (form === "video") return { baseKey: "type:VIDEOKONSULTASJON", medVedlegg: true }
      return { baseKey: "type:KONSULTASJON", medVedlegg: true }
    case "TELEFONKONSULTASJON":
      return { baseKey: "type:TELEFONKONSULTASJON", medVedlegg: true }
    case "MOTE":
      return { baseKey: "type:MOTE", medVedlegg: true }
    case "DIKTAT":
      return { baseKey: "type:DIKTAT", medVedlegg: false }
    case "JOURNALGJENNOMGANG":
      return { baseKey: "type:JOURNALGJENNOMGANG", medVedlegg: false }
    default:
      return { baseKey: "type:KONSULTASJON", medVedlegg: true }
  }
}

/**
 * Bygger full system prompt for notatgenerering: grunntekst (override/standard)
 * + ev. vedleggseksjon + stikkord-instruksjon. Stikkord styres alltid sentralt.
 */
export function byggStaging(
  type: KonsultasjonsType,
  form: KonsultasjonsForm | undefined,
  overrides: Map<string, string>
): string {
  const { baseKey, medVedlegg } = notattypeOppslag(type, form)
  let prompt = tekst(baseKey, overrides)
  if (medVedlegg) prompt += tekst("felles:vedleggseksjon", overrides)
  prompt += tekst("felles:stikkord", overrides)
  return prompt
}

/**
 * Bygger system prompt for chat/AI-hjelp. Setter inn kontekst i {KONTEKST};
 * hvis plassholderen mangler (admin har fjernet den) appendes konteksten trygt.
 */
export function byggChatStaging(
  modus: "chat" | "aihjelp",
  kontekstTekst: string,
  overrides: Map<string, string>
): string {
  const base = tekst(modus, overrides)
  if (base.includes("{KONTEKST}")) return base.replace("{KONTEKST}", kontekstTekst)
  return `${base}\n\n## Kontekst\n\n${kontekstTekst}`
}

/** Vedlegg-instruks med admin-override; egendefinert beholder brukerens egen tekst. */
export function resolverVedleggInstruksjon(
  vedlegg: Vedlegg,
  overrides: Map<string, string>
): string {
  const nokkel = vedleggInstruksNokkel(vedlegg)
  if (!nokkel) return lagVedleggInstruksjon(vedlegg) // egendefinert
  return tekst(`vedlegg:${nokkel}`, overrides) || lagVedleggInstruksjon(vedlegg)
}
