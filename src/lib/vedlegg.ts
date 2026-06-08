import type { Vedlegg, VedleggOppgave, SpirometriType } from "@/types/konsultasjon"

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

// ─── Prompt-instruksjoner til Claude ─────────────────────────────────────────

export function lagVedleggInstruksjon(vedlegg: Vedlegg): string {
  switch (vedlegg.oppgave) {
    case "ekg":
      return (
        "Analyser dette EKG-bildet etter standard mønster: rytme, frekvens, akse, " +
        "P-bølge, PQ-tid, QRS-kompleks, QT-tid, ST-segment og T-bølger. " +
        "Poengtert og klinisk relevant — unngå overdiagnostisering. " +
        "Integrer funn i O- og A-seksjonen i notatet."
      )

    case "spirometri": {
      const testtype = vedlegg.spirometriType ?? "uten_bronkodilator"
      if (testtype === "uten_bronkodilator") {
        return (
          "Tolk denne spirometrimålingen (baseline, uten bronkodilator). " +
          "Vurder FEV1, FVC og FEV1/FVC-ratio mot forventede verdier. " +
          "Klassifiser eventuelle obstruktive eller restriktive mønstre (GOLD-klassifisering der relevant). " +
          "Integrer funn i O- og A-seksjonen."
        )
      }
      if (testtype === "etter_aktivitet") {
        return (
          "Tolk denne spirometrimålingen tatt etter aktivitet (anstrengelsestest). " +
          "Vurder om det er tegn til anstrengelsesutløst bronkospasme (FEV1-fall ≥10–15 %). " +
          "Sammenlikn med baselineverdier hvis tilgjengelig i kontekst. " +
          "Integrer funn i O- og A-seksjonen."
        )
      }
      // med_bronkodilator
      return (
        "Tolk denne spirometrimålingen etter bronkodilator (post-BD). " +
        "Vurder reversibilitet: en økning i FEV1 ≥12 % og ≥200 ml regnes som signifikant. " +
        "Sammenlikn med pre-BD-verdier hvis tilgjengelig i kontekst. " +
        "Integrer funn i O- og A-seksjonen."
      )
    }

    case "ocr":
      return (
        "Transkriber teksten i dette bildet/dokumentet nøyaktig. " +
        "Bevar struktur og tabellformat der det er meningsfylt. " +
        "Ikke kommenter innholdet — bare transkriber. " +
        "Inkluder teksten i notatet der det er naturlig."
      )

    case "egendefinert":
      return vedlegg.egendefinertPrompt?.trim() ||
        "Vurder og kommenter innholdet i dette vedlegget."

    case "kontekst":
    default:
      return "Bruk innholdet i dette vedlegget som tilleggsopplysninger og bakgrunn for notatet."
  }
}
