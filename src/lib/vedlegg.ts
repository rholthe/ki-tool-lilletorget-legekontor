import type { Vedlegg, VedleggOppgave, VedleggOcrBruk, SpirometriType } from "@/types/konsultasjon"

// ─── Brukervendte labels og beskrivelser ──────────────────────────────────────

export const VEDLEGG_OPPGAVE_INFO: Record<
  VedleggOppgave,
  { label: string; beskrivelse: string }
> = {
  ekg: {
    label: "EKG",
    beskrivelse:
      "Standard rytme-, akse- og ST-tolkning. Passer for 12-avlednings EKG.",
  },
  spirometri: {
    label: "Spirometri",
    beskrivelse:
      "Tolk FEV1/FVC og klassifiser mønster. Velg hvilken test som er utført.",
  },
  ocr: {
    label: "Les tekst",
    beskrivelse:
      "Transkriberer tekst fra bilde eller PDF — journalnotater, skjemaer, lab-utskrifter.",
  },
  egendefinert: {
    label: "Egendefinert",
    beskrivelse: "Skriv din egen instruksjon til Claude for dette vedlegget.",
  },
  kontekst: {
    label: "Kun kontekst",
    beskrivelse:
      "Vedlegget brukes som bakgrunnsopplysning uten spesifikk tolkingsoppgave.",
  },
}

export const SPIROMETRI_TYPE_INFO: Record<
  SpirometriType,
  { label: string; beskrivelse: string }
> = {
  uten_bronkodilator: {
    label: "Uten bronkodilator",
    beskrivelse: "Baselinemåling",
  },
  etter_aktivitet: {
    label: "Etter aktivitet",
    beskrivelse: "Anstrengelsestest — vurdering av EIB",
  },
  med_bronkodilator: {
    label: "Med bronkodilator",
    beskrivelse: "Reversibilitetstest — post-BD",
  },
}

export const VEDLEGG_OCR_BRUK_INFO: Record<VedleggOcrBruk, { label: string; beskrivelse: string }> = {
  kontekst: {
    label: "Inkluder i kontekst",
    beskrivelse: "Teksten brukes som bakgrunn for notatet, tilsvarende kontekstfeltet.",
  },
  tilleggsinfo: {
    label: "Inkluder i tilleggsinfo",
    beskrivelse: "Teksten behandles som tilleggsopplysninger til konsultasjonen.",
  },
  ren_innlesing: {
    label: "Ren innlesing",
    beskrivelse: "Teksten transkriberes til slutt i notatet uten å påvirke notatinnholdet.",
  },
}

// ─── Prompt-instruksjoner til Claude (standardtekster) ───────────────────────

const OCR_BASE =
  "Transkriber teksten i dette bildet/dokumentet nøyaktig. " +
  "Bevar struktur og tabellformat der det er meningsfylt. " +
  "Ikke kommenter innholdet — bare transkriber. "

/**
 * Standard (fil-baserte) instruksjonstekster per overstyrbar vedleggsnøkkel.
 * Brukes både som fallback i `lagVedleggInstruksjon` og som default i
 * staging-registeret (admin kan overstyre disse i databasen).
 */
export const VEDLEGG_INSTRUKS_DEFAULT: Record<string, string> = {
  ekg:
    "Analyser dette EKG-bildet etter standard mønster: rytme, frekvens, akse, " +
    "P-bølge, PQ-tid, QRS-kompleks, QT-tid, ST-segment og T-bølger. " +
    "Poengtert og kortfattet. Unngå overdiagnostisering. Ikke inkluder pasientdata, ikke inkluder symptombeskrivelse. " +
    "Start analysen med 'EKG:[**AI-tolket**]:', deretter kort sammenhengende beskrivelse kun med komma mellom. " +
    "En god EKG-beskrivelse bør munne ut i en kort konklusjon, for eksempel: " +
    "'Sinusrytme, normal akse. Ingen tegn til akutt iskemi eller tidligere infarkt. Normalt EKG.' " +
    "eller 'Sinustakykardi. Signifikante ST-senkninger V4–V6 forenlig med lateral iskemi.' " +
    "Integrer funn i O-seksjonen i notatet.",

  "spirometri:uten_bronkodilator":
    "Tolk denne spirometrimålingen (baseline). " +
    "Poengtert og kortfattet. Ikke inkluder pasientdata eller symptombeskrivelse. " +
    "Start med 'Spirometri:[**AI-tolket**]:', deretter kort sammenhengende beskrivelse av FEV1, FVC og FEV1/FVC kun med komma mellom. " +
    "Avslutt med én setning konklusjon, for eksempel: 'Moderat obstruksjon forenlig med KOLS GOLD 2. Ingen restriktiv komponent.' " +
    "eller 'Normal spirometri, ingen obstruksjon eller restriksjon.' " +
    "Integrer funn i O-seksjonen i notatet.",

  "spirometri:etter_aktivitet":
    "Tolk denne spirometrimålingen tatt etter aktivitet (anstrengelsestest). " +
    "Poengtert og kortfattet. Ikke inkluder pasientdata eller symptombeskrivelse. " +
    "Start med 'Spirometri etter aktivitet:[**AI-tolket**]:', deretter kort sammenhengende beskrivelse med FEV1-endring fra baseline kun med komma mellom. " +
    "Avslutt med én setning konklusjon, for eksempel: 'FEV1-fall på 18 % forenlig med anstrengelsesutløst bronkospasme.' " +
    "eller 'Ingen signifikant FEV1-fall. Funn taler mot EIB.' " +
    "Integrer funn i O-seksjonen i notatet.",

  "spirometri:med_bronkodilator":
    "Tolk denne spirometrimålingen etter bronkodilator (post-BD). " +
    "Poengtert og kortfattet. Ikke inkluder pasientdata eller symptombeskrivelse. " +
    "Start med 'Spirometri post-BD:[**AI-tolket**]:', deretter kort sammenhengende beskrivelse av reversibilitet kun med komma mellom. " +
    "Avslutt med én setning konklusjon, for eksempel: 'Signifikant reversibilitet, FEV1 +15 %, forenlig med astma.' " +
    "eller 'Ingen signifikant reversibilitet. Funn forenlig med KOLS fremfor astma.' " +
    "Integrer funn i O-seksjonen i notatet.",

  "ocr:kontekst":
    OCR_BASE +
    "Bruk den transkriberte teksten som kontekst og bakgrunn for notatet. " +
    "Legg den til slutt i notatet under overskriften '--- OCR ---'.",

  "ocr:tilleggsinfo":
    OCR_BASE +
    "Behandle den transkriberte teksten som tilleggsopplysninger til konsultasjonen. " +
    "Legg den til slutt i notatet under overskriften '--- OCR ---'.",

  "ocr:ren_innlesing":
    OCR_BASE +
    "Den transkriberte teksten skal IKKE påvirke notatinnholdet. " +
    "Legg den til slutt i notatet under overskriften '--- OCR ---'.",

  kontekst:
    "Bruk innholdet i dette vedlegget som tilleggsopplysninger og bakgrunn for notatet.",
}

/**
 * Mapper et vedlegg til riktig nøkkel i `VEDLEGG_INSTRUKS_DEFAULT` /
 * staging-registeret. Returnerer `null` for `egendefinert` (brukerstyrt tekst).
 */
export function vedleggInstruksNokkel(vedlegg: Vedlegg): string | null {
  switch (vedlegg.oppgave) {
    case "ekg":
      return "ekg"
    case "spirometri":
      return `spirometri:${vedlegg.spirometriType ?? "uten_bronkodilator"}`
    case "ocr":
      return `ocr:${vedlegg.ocrBruk ?? "kontekst"}`
    case "egendefinert":
      return null
    case "kontekst":
    default:
      return "kontekst"
  }
}

/**
 * Standardtekst (fil-basert) for et vedlegg. Server-resolveren legger DB-override
 * på toppen via `vedleggInstruksNokkel`; denne er fallback når ingen override finnes.
 */
export function lagVedleggInstruksjon(vedlegg: Vedlegg): string {
  if (vedlegg.oppgave === "egendefinert") {
    return vedlegg.egendefinertPrompt?.trim() ||
      "Vurder og kommenter innholdet i dette vedlegget."
  }
  const nokkel = vedleggInstruksNokkel(vedlegg) ?? "kontekst"
  return VEDLEGG_INSTRUKS_DEFAULT[nokkel] ?? VEDLEGG_INSTRUKS_DEFAULT.kontekst
}
