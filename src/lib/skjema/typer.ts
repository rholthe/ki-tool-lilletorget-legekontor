/**
 * Skjema til oppgavetypen «Skjema». Definisjonen (feltliste + prompt) legges inn av
 * admin og er ren JSON. Verdiene legen og Claude fyller inn er pasientdata og finnes
 * bare i nettleseren (kryptert i IndexedDB sammen med resten av oppgaven).
 */

export type SkjemaFeltType = "tekst" | "flerlinje" | "avkrysning"

/**
 * Hvor verdien kommer fra. Personalia og dato settes av koden, aldri av Claude —
 * et fødselsnummer skal ikke kunne bli feil avskrevet av en språkmodell.
 */
export type SkjemaFeltKilde =
  | "ai"
  | "manuell"
  | "pasient.navn"
  | "pasient.fornavn"
  | "pasient.etternavn"
  | "pasient.fnr"
  | "pasient.fodt"
  | "pasient.adresse"
  | "pasient.postnr"
  | "pasient.poststed"
  | "lege.navn"
  | "lege.fornavn"
  | "lege.etternavn"
  | "lege.hpr"
  | "dato.idag"

export const FELTTYPE_ETIKETT: Record<SkjemaFeltType, string> = {
  tekst: "Kort tekst",
  flerlinje: "Lang tekst",
  avkrysning: "Avkrysning",
}

export const KILDE_ETIKETT: Record<SkjemaFeltKilde, string> = {
  ai: "AI (ut fra konteksten)",
  manuell: "Legen fyller ut selv",
  "pasient.navn": "Pasient: fullt navn",
  "pasient.fornavn": "Pasient: fornavn (og mellomnavn)",
  "pasient.etternavn": "Pasient: etternavn",
  "pasient.fnr": "Pasient: fødselsnummer",
  "pasient.fodt": "Pasient: fødselsdato",
  "pasient.adresse": "Pasient: adresse",
  "pasient.postnr": "Pasient: postnummer",
  "pasient.poststed": "Pasient: poststed",
  "lege.navn": "Lege: fullt navn",
  "lege.fornavn": "Lege: fornavn (og mellomnavn)",
  "lege.etternavn": "Lege: etternavn",
  "lege.hpr": "Lege: HPR-nummer",
  "dato.idag": "Dagens dato",
}

/** Et rektangel på en side i PDF-malen. Brøkdeler (0–1) av sidens bredde og høyde, målt fra øvre venstre hjørne. */
export interface PdfBoks {
  /** Sidenummer, 0 = første side. */
  side: number
  x: number
  y: number
  b: number
  h: number
}

/**
 * Hvor et felt havner i PDF-malen: i et utfyllbart felt (AcroForm) eller i en boks
 * admin har tegnet på en flat PDF.
 */
export interface PdfMaal {
  /** Navnet på et utfyllbart felt i PDF-en (tekstfelt, avkrysningsboks eller radiogruppe). */
  felt?: string
  /** Radiogruppe eller nedtrekk: alternativet som velges. */
  valg?: string
  /** Flat PDF: teksten (eller krysset) tegnes her. */
  boks?: PdfBoks
  /**
   * Tekstfelt som ikke har plass i selve skjemaet: teksten settes på fortsettelsesarket bakerst,
   * under feltets etikett (f.eks. «Sykmeldingsperioder med diagnoser»). Går foran `felt` og `boks`.
   */
  ark?: boolean
}

export interface SkjemaFelt {
  id: string
  /** Teksten legen ser over feltet. */
  etikett: string
  type: SkjemaFeltType
  kilde: SkjemaFeltKilde
  /** Overskrift/fane feltet står under (valgfritt). */
  seksjon?: string
  /** Hva Claude skal skrive i feltet (kun kilde «ai»). */
  instruks?: string
  /**
   * Feltets tekst i Pridok — etiketten, plassholderen eller avkrysningsteksten.
   * Tom = feltet sendes ikke til Pridok.
   */
  pridokTekst?: string
  /** Plassering i PDF-malen. For avkrysning: det som krysses av ved «Ja». */
  pdf?: PdfMaal
  /** Avkrysning: det som krysses av ved «Nei» (når skjemaet har egne ruter for ja og nei). */
  pdfNei?: PdfMaal
  /**
   * Omtrent hvor mange tegn det er plass til i PDF-en. Regnes ut fra feltets størrelse når det
   * kobles, og kan rettes av admin. Gis til Claude som grense og vises som teller for legen.
   */
  maksTegn?: number
}

/** PDF-malen til et skjema. Selve filen hentes fra `/api/skjema/<id>/pdf`. */
export interface SkjemaPdfInfo {
  filnavn: string
  /** Endres når admin laster opp en ny mal. */
  versjon: string
}

export interface SkjemaDefinisjon {
  id: string
  navn: string
  beskrivelse: string | null
  kategori: string
  prompt: string
  felter: SkjemaFelt[]
  /** Satt når skjemaet har en PDF-mal som kan fylles ut og lastes ned. */
  pdf?: SkjemaPdfInfo | null
}

export interface SkjemaKategoriMedSkjema {
  id: string
  navn: string
  skjemaer: SkjemaDefinisjon[]
}

/** Slik admin ser dem: også inaktive skjema og tomme kategorier. */
export type SkjemaAdmin = SkjemaDefinisjon & { aktiv: boolean }
export interface SkjemaKategoriAdmin {
  id: string
  navn: string
  rekkefolge: number
  skjemaer: SkjemaAdmin[]
}

export type SkjemaVerdi = string | boolean
export type SkjemaVerdier = Record<string, SkjemaVerdi>

/** Personalia for pasienten skjemaet gjelder. Fra Pridok (utvidelsen) eller skrevet inn. */
export interface Pasient {
  navn: string
  /** Slik Pridok viser den (dd.mm.åååå). */
  fodt: string
  /** 11 siffer uten skilletegn. */
  fnr: string
  adresse: string
  postnr: string
  poststed: string
  /** Sant når opplysningene er hentet fra Pridok. */
  fraPridok?: boolean
}

export const TOM_PASIENT: Pasient = { navn: "", fodt: "", fnr: "", adresse: "", postnr: "", poststed: "" }

/** Den innloggede legen. Navn og HPR-nummer ligger på brukerkontoen (Innstillinger). */
export interface Lege {
  navn: string
  /** 7–9 siffer, eller tom når legen ikke har lagt det inn. */
  hpr: string
}

/** HPR-nummer er 7–9 siffer. Mellomrom fjernes; ugyldig gir null. */
export function rensHpr(tekst: string): string | null {
  const siffer = tekst.replace(/\s+/g, "")
  return /^\d{7,9}$/.test(siffer) ? siffer : null
}

export function harLegeFelt(s: Pick<SkjemaDefinisjon, "felter">): boolean {
  return s.felter.some((f) => f.kilde.startsWith("lege."))
}

export function harPridokFelt(s: Pick<SkjemaDefinisjon, "felter">): boolean {
  return s.felter.some((f) => f.pridokTekst?.trim())
}

export function harPdfMaal(m: PdfMaal | undefined): boolean {
  return Boolean(m && (m.felt || m.boks || m.ark))
}

function idag(): string {
  return new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/**
 * Deler et fullt navn for skjema med egne felt: etternavnet er det siste navnet,
 * fornavnet er resten (mellomnavn følger fornavnet). Ett navn alene regnes som etternavn.
 */
export function delNavn(navn: string): { fornavn: string; etternavn: string } {
  const deler = navn.replace(/\s+/g, " ").trim().split(" ")
  const etternavn = deler.pop() ?? ""
  return { fornavn: deler.join(" "), etternavn }
}

/**
 * Verdien koden selv setter for et felt, eller null når feltet fylles av AI eller legen.
 * Uten `lege` (ikke hentet ennå) røres ikke legefeltene.
 */
export function verdiFraKilde(felt: SkjemaFelt, pasient: Pasient | undefined, lege?: Lege): string | null {
  switch (felt.kilde) {
    case "lege.navn":
      return lege ? lege.navn : null
    case "lege.fornavn":
      return lege ? delNavn(lege.navn).fornavn : null
    case "lege.etternavn":
      return lege ? delNavn(lege.navn).etternavn : null
    case "lege.hpr":
      return lege ? lege.hpr : null
    case "pasient.navn":
      return pasient?.navn ?? ""
    case "pasient.fornavn":
      return delNavn(pasient?.navn ?? "").fornavn
    case "pasient.etternavn":
      return delNavn(pasient?.navn ?? "").etternavn
    case "pasient.fnr":
      return pasient?.fnr ?? ""
    case "pasient.fodt":
      return pasient?.fodt ?? ""
    case "pasient.adresse":
      return pasient?.adresse ?? ""
    case "pasient.postnr":
      return pasient?.postnr ?? ""
    case "pasient.poststed":
      return pasient?.poststed ?? ""
    case "dato.idag":
      return idag()
    default:
      return null
  }
}

/** Setter alle felt som har pasient, lege eller dato som kilde. Øvrige verdier beholdes. */
export function fyllFraKilder(
  felter: SkjemaFelt[],
  verdier: SkjemaVerdier,
  pasient: Pasient | undefined,
  lege?: Lege,
): SkjemaVerdier {
  const ut = { ...verdier }
  for (const f of felter) {
    if (f.type === "avkrysning") continue
    const v = verdiFraKilde(f, pasient, lege)
    if (v !== null) ut[f.id] = v
  }
  return ut
}

/** Ren tekst av det utfylte skjemaet («Kopier»). Tomme felt utelates. */
export function skjemaSomTekst(felter: SkjemaFelt[], verdier: SkjemaVerdier): string {
  const linjer: string[] = []
  let seksjon = ""
  for (const f of felter) {
    const v = verdier[f.id]
    if (v === undefined || v === "") continue
    if (f.seksjon && f.seksjon !== seksjon) {
      seksjon = f.seksjon
      linjer.push(`\n${seksjon.toUpperCase()}`)
    }
    if (typeof v === "boolean") linjer.push(`${f.etikett} ${v ? "Ja" : "Nei"}`)
    else linjer.push(f.type === "flerlinje" ? `${f.etikett}\n${v}\n` : `${f.etikett} ${v}`)
  }
  return linjer.join("\n").trim()
}

/**
 * Feltene som kan sendes til Pridok, med `nr` = hvilket av flere felt med samme tekst det er.
 * Pridok har like tekster flere steder («Nå» under både 5.3 a og 5.3 b), og nummeret må regnes
 * her, over hele definisjonen — ikke blant feltene som tilfeldigvis har verdi ved sending.
 * Samme normalisering som i utvidelsen (små bokstaver, ett mellomrom, uten kolon til slutt).
 */
export function pridokFeltliste(
  felter: SkjemaFelt[],
): { id: string; tekst: string; type: SkjemaFeltType; nr: number }[] {
  const sett = new Map<string, number>()
  const ut: { id: string; tekst: string; type: SkjemaFeltType; nr: number }[] = []
  for (const f of felter) {
    const tekst = f.pridokTekst?.trim()
    if (!tekst) continue
    const norm = tekst.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().replace(/:$/, "").trim().toLowerCase()
    const nokkel = `${f.type === "avkrysning" ? "k" : "t"}:${norm}`
    const nr = sett.get(nokkel) ?? 0
    sett.set(nokkel, nr + 1)
    ut.push({ id: f.id, tekst, type: f.type, nr })
  }
  return ut
}
