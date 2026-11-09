/**
 * Deler et generert notat i journalsystemets fire felt (Pridok: «Anamnese (Notat)»,
 * «Funn», «Vurdering», «Tiltak»). Brukes av «Send til journal», som går via
 * nettleserutvidelsen i `nettleserutvidelse/pridok/` — teksten forlater aldri nettleseren.
 *
 * Systemprompten ber om overskriftene ANAMNESE, UNDERSØKELSE, VURDERING og TILTAK.
 * Eldre notater med SOAP-overskrifter (S – Subjektivt …) og vanlige varianter
 * godtas også. Alt etter TILTAK — også `--- KLINISKE VERKTØY ---` og `--- OCR ---`,
 * som appen legger sist i notatet — havner i Tiltak.
 */

export type JournalFelt = "anamnese" | "funn" | "vurdering" | "tiltak"

export type JournalSeksjoner = Record<JournalFelt, string>

export const JOURNAL_FELT_ETIKETT: Record<JournalFelt, string> = {
  anamnese: "Anamnese",
  funn: "Funn",
  vurdering: "Vurdering",
  tiltak: "Tiltak",
}

const OVERSKRIFTER: Record<JournalFelt, string[]> = {
  anamnese: ["ANAMNESE", "S", "S - SUBJEKTIVT", "SUBJEKTIVT", "SUBJEKTIV"],
  funn: [
    "UNDERSØKELSE", "UNDERSØKELSER", "FUNN", "KLINISKE FUNN", "UNDERSØKELSE OG FUNN",
    "O", "O - OBJEKTIVT", "OBJEKTIVT", "OBJEKTIV",
  ],
  vurdering: ["VURDERING", "A", "A - ANALYSE/VURDERING", "A - VURDERING", "ANALYSE/VURDERING", "ANALYSE"],
  tiltak: ["TILTAK", "P", "P - PLAN", "PLAN", "PLAN/TILTAK", "TILTAK/PLAN", "PLAN OG TILTAK"],
}

/** Overskrifter som også godtas med tekst på samme linje («ANAMNESE: …»), kun i store bokstaver. */
const INNLINJE: Record<JournalFelt, string> = {
  anamnese: "ANAMNESE",
  funn: "UNDERSØKELSE",
  vurdering: "VURDERING",
  tiltak: "TILTAK",
}

function normaliserOverskrift(linje: string): string {
  return linje
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(/:\s*$/, "")
    .replace(/\s*[–—-]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function finnOverskrift(linje: string): { felt: JournalFelt; rest: string } | null {
  if (linje.trim().length > 40) {
    // Lange linjer kan bare være innlinjeform
  } else {
    const n = normaliserOverskrift(linje)
    for (const felt of Object.keys(OVERSKRIFTER) as JournalFelt[]) {
      if (OVERSKRIFTER[felt].includes(n)) return { felt, rest: "" }
    }
  }
  for (const felt of Object.keys(INNLINJE) as JournalFelt[]) {
    const m = linje.match(new RegExp(`^\\s*${INNLINJE[felt]}\\s*:\\s*(.+)$`))
    if (m) return { felt, rest: m[1] }
  }
  return null
}

function rydd(tekst: string): string {
  return tekst.replace(/\n{3,}/g, "\n\n").trim()
}

export function delNotatIJournalfelt(notat: string): {
  seksjoner: JournalSeksjoner
  /** false når notatet manglet overskrifter — da ligger alt i Anamnese. */
  fantOverskrifter: boolean
} {
  const deler: Record<JournalFelt, string[]> = { anamnese: [], funn: [], vurdering: [], tiltak: [] }
  let gjeldende: JournalFelt = "anamnese"
  let fant = false

  for (const linje of notat.replace(/\r\n/g, "\n").split("\n")) {
    const treff = finnOverskrift(linje)
    if (treff) {
      fant = true
      gjeldende = treff.felt
      if (treff.rest) deler[gjeldende].push(treff.rest)
      continue
    }
    deler[gjeldende].push(linje)
  }

  return {
    seksjoner: {
      anamnese: rydd(deler.anamnese.join("\n")),
      funn: rydd(deler.funn.join("\n")),
      vurdering: rydd(deler.vurdering.join("\n")),
      tiltak: rydd(deler.tiltak.join("\n")),
    },
    fantOverskrifter: fant,
  }
}
