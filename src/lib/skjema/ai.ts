import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages"
import type { Vedlegg } from "@/types/konsultasjon"
import { vedleggBlokk, type AiForesporsel } from "@/lib/ai-foresporsler"
import { byggSkjemaStaging, type StagingOverrides } from "@/lib/staging-bygg"
import { SKJEMAOPPSETT_STAGING } from "@/lib/staging"
import {
  KILDE_ETIKETT,
  type SkjemaDefinisjon,
  type SkjemaFelt,
  type SkjemaFeltKilde,
  type SkjemaVerdier,
} from "@/lib/skjema/typer"

/**
 * Skjemautfylling med Claude, bygget i nettleseren. Svaret tvinges gjennom et
 * verktøykall der hvert AI-felt er en egenskap, så det alltid er gyldig JSON per felt.
 * Personalia (navn, fødselsnummer, adresse) er ikke med i forespørselen — de feltene
 * fylles av koden.
 */

const VERKTOY_NAVN = "fyll_skjema"

function aiFelt(skjema: SkjemaDefinisjon): SkjemaFelt[] {
  return skjema.felter.filter((f) => f.kilde === "ai")
}

export function harAiFelt(skjema: SkjemaDefinisjon): boolean {
  return aiFelt(skjema).length > 0
}

function feltBeskrivelse(f: SkjemaFelt): string {
  const deler = [f.seksjon ? `${f.seksjon}: ${f.etikett}` : f.etikett]
  if (f.instruks?.trim()) deler.push(f.instruks.trim())
  if (f.type === "tekst") deler.push("Kort svar på én linje.")
  // Plassen i PDF-skjemaet. Bedre at teksten skrives for plassen enn at den krympes eller kuttes etterpå
  if (f.type !== "avkrysning" && f.maksTegn) {
    deler.push(
      `Plassen i skjemaet er begrenset: høyst ${f.maksTegn} tegn medregnet mellomrom. Prioriter det viktigste og skriv knapt heller enn å gå over.`,
    )
  }
  return deler.join("\n")
}

export interface SkjemaInn {
  skjema: SkjemaDefinisjon
  kontekst: string
  vedlegg?: Pick<Vedlegg, "mimeType" | "base64" | "oppgave">[]
}

export function byggSkjemaForesporsel(inn: SkjemaInn, overrides: StagingOverrides): AiForesporsel {
  const felter = aiFelt(inn.skjema)
  if (felter.length === 0) throw new Error("Skjemaet har ingen felt som fylles ut av AI")
  if (!inn.kontekst.trim() && !inn.vedlegg?.length) throw new Error("Legg inn kontekst eller vedlegg først")

  const properties: Record<string, unknown> = {}
  for (const f of felter) {
    properties[f.id] =
      f.type === "avkrysning"
        ? { type: "string", enum: ["ja", "nei", "ukjent"], description: feltBeskrivelse(f) }
        : { type: "string", description: feltBeskrivelse(f) }
  }

  const innhold: ContentBlockParam[] = [
    {
      type: "text",
      text:
        `Skjema: ${inn.skjema.navn}\n\n` +
        (inn.kontekst.trim() ? `**Kontekst fra legen:**\n${inn.kontekst}` : "Konteksten ligger i vedleggene."),
    },
  ]
  for (const v of inn.vedlegg ?? []) innhold.push(vedleggBlokk(v))

  return {
    system: byggSkjemaStaging(inn.skjema.prompt, overrides),
    messages: [{ role: "user", content: innhold }],
    maxTokens: 8000,
    verktoy: {
      name: VERKTOY_NAVN,
      description:
        "Leverer forslag til utfylling av skjemaet. Ta bare med felt du har grunnlag for i konteksten; utelat resten.",
      input_schema: { type: "object", properties },
    },
  }
}

/** Oversetter verktøykallet til feltverdier. Ukjente nøkler og tomme svar forkastes. */
export function tolkSkjemaSvar(skjema: SkjemaDefinisjon, svar: Record<string, unknown>): SkjemaVerdier {
  const ut: SkjemaVerdier = {}
  for (const f of aiFelt(skjema)) {
    const v = svar[f.id]
    if (typeof v !== "string") continue
    if (f.type === "avkrysning") {
      const t = v.trim().toLowerCase()
      if (t === "ja") ut[f.id] = true
      else if (t === "nei") ut[f.id] = false
    } else if (v.trim()) {
      ut[f.id] = f.type === "tekst" ? v.replace(/\s+/g, " ").trim() : v.trim()
    }
  }
  return ut
}

// ─── Admin: forslag til oppsett av et nytt skjema ────────────────────────────

export interface OppsettInn {
  navn: string
  beskrivelse: string
  prompt: string
  felter: SkjemaFelt[]
  /** Adminens egne stikkord om skjemaet (valgfritt). */
  stikkord: string
}

export interface OppsettForslag {
  prompt: string
  felter: Record<string, { etikett: string; kilde: SkjemaFeltKilde; instruks: string }>
}

const KILDER = Object.keys(KILDE_ETIKETT) as SkjemaFeltKilde[]

/** Bare skjemaets navn og feltliste sendes — aldri pasientdata. */
export function byggOppsettForesporsel(inn: OppsettInn): AiForesporsel {
  if (inn.felter.length === 0) throw new Error("Legg til eller importer feltene først")
  const feltliste = inn.felter.map((f) => ({
    id: f.id,
    tekst: f.etikett,
    type: f.type,
    overskrift: f.seksjon ?? "",
    ...(f.instruks ? { instruksNaa: f.instruks } : {}),
  }))
  const deler = [`Skjema: ${inn.navn.trim() || "(uten navn)"}`]
  if (inn.beskrivelse.trim()) deler.push(`Beskrivelse: ${inn.beskrivelse.trim()}`)
  if (inn.stikkord.trim()) deler.push(`Administratorens ønsker og stikkord:\n${inn.stikkord.trim()}`)
  if (inn.prompt.trim()) deler.push(`Instruksen slik den er nå (forbedre den):\n${inn.prompt.trim()}`)
  deler.push(`Felt, i skjemaets rekkefølge:\n${JSON.stringify(feltliste, null, 1)}`)

  return {
    system: SKJEMAOPPSETT_STAGING,
    messages: [{ role: "user", content: deler.join("\n\n") }],
    maxTokens: 16000,
    verktoy: {
      name: "foresla_oppsett",
      description: "Leverer forslag til instruks for skjemaet og oppsett for hvert felt.",
      input_schema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Instruks for skjemaet, ren tekst." },
          felter: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                etikett: { type: "string" },
                kilde: { type: "string", enum: KILDER },
                instruks: { type: "string" },
              },
              required: ["id", "etikett", "kilde", "instruks"],
            },
          },
        },
        required: ["prompt", "felter"],
      },
    },
  }
}

/** Forkaster ukjente id-er og kilder feltet ikke kan ha. */
export function tolkOppsettSvar(felter: SkjemaFelt[], svar: Record<string, unknown>): OppsettForslag {
  const ut: OppsettForslag = { prompt: typeof svar.prompt === "string" ? svar.prompt.trim() : "", felter: {} }
  const kjente = new Map(felter.map((f) => [f.id, f]))
  for (const raa of Array.isArray(svar.felter) ? svar.felter : []) {
    if (!raa || typeof raa !== "object") continue
    const r = raa as Record<string, unknown>
    const felt = typeof r.id === "string" ? kjente.get(r.id) : undefined
    if (!felt) continue
    let kilde = KILDER.includes(r.kilde as SkjemaFeltKilde) ? (r.kilde as SkjemaFeltKilde) : felt.kilde
    if (felt.type === "avkrysning" && kilde !== "ai" && kilde !== "manuell") kilde = "manuell"
    ut.felter[felt.id] = {
      etikett: typeof r.etikett === "string" && r.etikett.trim() ? r.etikett.trim().slice(0, 500) : felt.etikett,
      kilde,
      instruks: kilde === "ai" && typeof r.instruks === "string" ? r.instruks.trim().slice(0, 2000) : "",
    }
  }
  return ut
}
