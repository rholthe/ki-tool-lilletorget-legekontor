/**
 * PDF-sporet for oppgavetypen «Skjema»: leser feltene i en PDF-mal og fyller ut malen
 * med legens verdier. Alt skjer i nettleseren med pdf-lib — den utfylte PDF-en er
 * pasientdata og er aldri innom serveren.
 *
 * To slags maler:
 *  - utfyllbare PDF-er (AcroForm): verdien settes i feltet med det navnet admin har koblet til
 *  - flate PDF-er: teksten (eller krysset) tegnes i boksen admin har tegnet på siden
 * Et skjema kan blande de to.
 */
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFHexString,
  PDFName,
  PDFRadioGroup,
  PDFString,
  PDFTextField,
  StandardFonts,
  rgb,
  type PDFField,
  type PDFFont,
} from "pdf-lib"
import type { PdfBoks, PdfMaal, SkjemaFelt, SkjemaVerdier } from "./typer"

export type PdfFeltType = "tekst" | "avkrysning" | "radio" | "nedtrekk"

/** Et utfyllbart felt i PDF-malen. */
export interface PdfFeltInfo {
  navn: string
  type: PdfFeltType
  flerlinje: boolean
  /** Alternativene i en radiogruppe eller et nedtrekk. */
  valg: string[]
  /** 0 = første side. Null når feltet ikke står på noen side. */
  side: number | null
  /** Hjelpeteksten (tooltip) fra PDF-en — ofte en bedre etikett enn feltnavnet. */
  hjelp: string
  /** Feltets størrelse på siden, i punkt. 0 når den ikke er kjent. */
  bredde: number
  hoyde: number
  /** Skriftstørrelsen skjemaet selv har satt på feltet. 0 = automatisk eller ukjent. */
  skrift: number
  /** Største antall tegn feltet tar imot, når skjemaet har satt en grense. */
  maksLengde: number | null
}

export interface PdfMalInfo {
  antallSider: number
  /** Sidenes størrelse i punkt (synlig del). */
  sider: { bredde: number; hoyde: number }[]
  /** Sider som er rotert i PDF-en. Bokser på dem havner feil. */
  roterteSider: number[]
  felter: PdfFeltInfo[]
}

export interface PdfFyllResultat {
  pdf: Uint8Array
  /** Antall felt som ble skrevet inn. */
  fylt: number
  /** Felt-id-er som har verdi og PDF-kobling, men der feltet ikke finnes i malen. */
  mangler: string[]
  /** Felt-id-er der teksten ikke fikk plass. Hele teksten står på fortsettelsesarket. */
  forLangt: string[]
  /** Felt-id-er som hører hjemme på fortsettelsesarket (`PdfMaal.ark`) og er satt der. */
  paaArk: string[]
  /** Antall fortsettelsesark som er lagt til bakerst. */
  fortsettelsesark: number
}

/** Står øverst på fortsettelsesarket, så et løst ark kan føres tilbake til skjema og pasient. */
export interface PdfHode {
  tittel?: string
  undertittel?: string
}

async function aapne(mal: Uint8Array): Promise<PDFDocument> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(mal, { ignoreEncryption: true })
  } catch {
    throw new Error("Kunne ikke lese PDF-en. Er filen skadet?")
  }
  if (doc.isEncrypted) {
    throw new Error("PDF-en er passordbeskyttet eller låst for endring, og kan ikke fylles ut. Lagre en ulåst kopi og last den opp.")
  }
  return doc
}

/**
 * Rutene i en avkrysningsboks, ved navnet på «på»-tilstanden. Vanligvis én. Noen skjema (SPK) har
 * én boks med to ruter, «Nei» og «Ja» — da holder det ikke å krysse av feltet, ruten må velges.
 */
function ruteValg(f: PDFCheckBox): string[] {
  const ut: string[] = []
  try {
    for (const w of f.acroField.getWidgets()) {
      const navn = w.getOnValue()?.decodeText()
      if (navn && !ut.includes(navn)) ut.push(navn)
    }
  } catch {
    return []
  }
  return ut
}

/** Krysser av én bestemt rute i en avkrysningsboks med flere ruter. */
function velgRute(f: PDFCheckBox, valg: string): boolean {
  if (!ruteValg(f).includes(valg)) return false
  f.acroField.dict.set(PDFName.of("V"), PDFName.of(valg))
  for (const w of f.acroField.getWidgets()) {
    w.setAppearanceState(PDFName.of(w.getOnValue()?.decodeText() === valg ? valg : "Off"))
  }
  return true
}

function feltType(f: PDFField): PdfFeltType | null {
  if (f instanceof PDFTextField) return "tekst"
  // Avkrysningsboks med flere ruter (f.eks. «Nei» og «Ja» i samme felt) velges som en radiogruppe
  if (f instanceof PDFCheckBox) return ruteValg(f).length > 1 ? "radio" : "avkrysning"
  if (f instanceof PDFRadioGroup) return "radio"
  if (f instanceof PDFDropdown) return "nedtrekk"
  return null // knapper, signaturfelt, lister
}

function hjelpetekst(f: PDFField): string {
  try {
    const tu = f.acroField.dict.lookup(PDFName.of("TU"))
    if (tu instanceof PDFString || tu instanceof PDFHexString) return tu.decodeText().replace(/\s+/g, " ").trim()
  } catch {
    // feltet har ingen lesbar hjelpetekst
  }
  return ""
}

/** Skriftstørrelsen i feltets «default appearance» («/Helv 10 Tf»). 0 = automatisk eller ikke satt. */
function skriftstorrelse(f: PDFTextField): number {
  try {
    const m = (f.acroField.getDefaultAppearance() ?? "").match(/(\d*\.?\d+)\s+Tf/)
    return m ? Number(m[1]) || 0 : 0
  } catch {
    return 0
  }
}

/** Leser sidene og de utfyllbare feltene i en PDF-mal, i leserekkefølge. */
export async function lesPdfMal(mal: Uint8Array): Promise<PdfMalInfo> {
  const doc = await aapne(mal)
  const sider = doc.getPages()

  // Hvilken side og hvor på siden hver feltboks står (for sortering)
  const plass = new Map<unknown, { side: number; topp: number; x: number }>()
  sider.forEach((side, i) => {
    const annots = side.node.Annots()
    if (!annots) return
    for (let j = 0; j < annots.size(); j++) {
      const a = annots.lookup(j)
      if (a) plass.set(a, { side: i, topp: 0, x: 0 })
    }
  })

  let form
  try {
    form = doc.getForm()
  } catch {
    form = null
  }

  const felter: (PdfFeltInfo & { topp: number; x: number })[] = []
  for (const f of form?.getFields() ?? []) {
    const type = feltType(f)
    if (!type) continue
    let side: number | null = null
    let topp = 0
    let x = 0
    let bredde = 0
    let hoyde = 0
    try {
      const w = f.acroField.getWidgets()[0]
      const p = w ? plass.get(w.dict) : undefined
      if (w && p) {
        const r = w.getRectangle()
        side = p.side
        topp = r.y + r.height
        x = r.x
      }
      if (w) {
        const r = w.getRectangle()
        bredde = Math.abs(r.width)
        hoyde = Math.abs(r.height)
      }
    } catch {
      // feltet mangler rektangel — plasseres til slutt
    }
    let valg: string[] = []
    try {
      if (f instanceof PDFRadioGroup || f instanceof PDFDropdown) valg = f.getOptions()
      else if (f instanceof PDFCheckBox && type === "radio") valg = ruteValg(f)
    } catch {
      valg = []
    }
    felter.push({
      navn: f.getName(),
      type,
      flerlinje: f instanceof PDFTextField && f.isMultiline(),
      valg,
      side,
      hjelp: hjelpetekst(f),
      bredde,
      hoyde,
      skrift: f instanceof PDFTextField ? skriftstorrelse(f) : 0,
      maksLengde: f instanceof PDFTextField ? (f.getMaxLength() ?? null) : null,
      topp,
      x,
    })
  }

  // Leserekkefølge: side, så linje (ovenfra), så fra venstre
  const linje = (t: number) => Math.round(t / 8)
  felter.sort(
    (a, b) => (a.side ?? 9999) - (b.side ?? 9999) || linje(b.topp) - linje(a.topp) || a.x - b.x,
  )

  return {
    antallSider: sider.length,
    sider: sider.map((s) => {
      const r = s.getCropBox()
      return { bredde: r.width, hoyde: r.height }
    }),
    roterteSider: sider.flatMap((s, i) => (s.getRotation().angle % 360 !== 0 ? [i] : [])),
    felter: felter.map((f) => ({
      navn: f.navn,
      type: f.type,
      flerlinje: f.flerlinje,
      valg: f.valg,
      side: f.side,
      hjelp: f.hjelp,
      bredde: f.bredde,
      hoyde: f.hoyde,
      skrift: f.skrift,
      maksLengde: f.maksLengde,
    })),
  }
}

// ─── Tekst ───────────────────────────────────────────────────────────────────

const ERSTATT: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "−": "-",
  "‑": "-",
  "‐": "-",
  "≈": "ca.",
  "≠": "ikke lik",
  " ": " ",
  " ": " ",
  "​": "",
  "﻿": "",
  "\t": " ",
}

/**
 * Standardskriften i PDF (Helvetica) har bare tegnene i WinAnsi — æøå er med, men
 * ikke f.eks. «≥». Tegn utenfor byttes ut, ellers stopper hele utfyllingen.
 */
function lagRens(font: PDFFont): (tekst: string) => string {
  const kjente = new Set(font.getCharacterSet())
  return (tekst) => {
    let ut = ""
    for (const tegn of tekst.replace(/\r\n?/g, "\n").normalize("NFC")) {
      if (tegn === "\n") ut += tegn
      else if (tegn in ERSTATT) ut += ERSTATT[tegn]
      else if (kjente.has(tegn.codePointAt(0)!)) ut += tegn
      else ut += "?"
    }
    return ut
  }
}

/** Bryter teksten i linjer som får plass i bredden. Ord som er lengre enn linjen, deles. */
function brytTekst(tekst: string, font: PDFFont, storrelse: number, bredde: number): string[] {
  const linjer: string[] = []
  const passer = (t: string) => font.widthOfTextAtSize(t, storrelse) <= bredde
  for (const avsnitt of tekst.split("\n")) {
    let linje = ""
    for (let ord of avsnitt.split(/ +/)) {
      const forsok = linje ? `${linje} ${ord}` : ord
      if (passer(forsok)) {
        linje = forsok
        continue
      }
      if (linje) linjer.push(linje)
      while (ord.length > 1 && !passer(ord)) {
        let n = ord.length - 1
        while (n > 1 && !passer(ord.slice(0, n))) n--
        linjer.push(ord.slice(0, n))
        ord = ord.slice(n)
      }
      linje = ord
    }
    linjer.push(linje)
  }
  return linjer
}

/** Skriften teksten settes i når den får plass, og det minste den krympes til. Under 7 blir utskriften tung å lese. */
export const STANDARD_SKRIFT = 9
export const MINSTE_SKRIFT = 7
const LUFT = 2
const LINJE = 1.2
/** Settes sist i et felt der teksten ikke fikk plass. */
const FORTS = "(forts. eget ark)"

/** Linjer det er plass til i høyden. Alltid minst én. */
const linjerIHoyde = (hoyde: number, skrift: number) => Math.max(1, Math.floor((hoyde - 2 * LUFT) / (skrift * LINJE)))

/**
 * Omtrent hvor mange tegn det er plass til i et felt med denne størrelsen, i standardskrift.
 * Et anslag: bokstavene har ulik bredde, og linjebrudd spiser litt av hver linje. Regnet
 * forsiktig, så tekst innenfor grensen normalt får plass uten at skriften må krympes.
 */
export function plassITegn(bredde: number, hoyde: number, flerlinje: boolean, skrift = STANDARD_SKRIFT): number {
  if (bredde <= 0 || hoyde <= 0) return 0
  // Gjennomsnittlig tegnbredde i norsk tekst satt i Helvetica er rundt 0,5 av skriftstørrelsen
  const perLinje = Math.floor((bredde - 2 * LUFT - 2) / (skrift * 0.5))
  if (!flerlinje) return Math.max(0, Math.floor(perLinje * 0.95))
  const linjer = linjerIHoyde(hoyde, skrift)
  // Ved hvert linjebrudd går i snitt et halvt ord tapt
  const tegn = linjer === 1 ? perLinje * 0.95 : linjer * (perLinje - 4) * 0.95
  return Math.max(0, tegn >= 100 ? Math.floor(tegn / 10) * 10 : Math.floor(tegn))
}

/** Plassen (ca. antall tegn) der et tekstfelt havner i malen. Null når feltet ikke er koblet eller ikke finnes. */
export function plassForMaal(info: PdfMalInfo, maal: PdfMaal | undefined): number | null {
  if (!maal || maal.ark) return null
  let plass: number | null = null
  if (maal.boks) {
    const side = info.sider[maal.boks.side]
    if (side) plass = plassITegn(maal.boks.b * side.bredde, maal.boks.h * side.hoyde, true)
  }
  if (maal.felt) {
    const f = info.felter.find((x) => x.navn === maal.felt)
    if (f?.type === "tekst" && f.bredde > 0) {
      const skrift = f.skrift > 0 ? Math.min(f.skrift, STANDARD_SKRIFT) : STANDARD_SKRIFT
      const iFelt = Math.min(plassITegn(f.bredde, f.hoyde, f.flerlinje, skrift), f.maksLengde ?? Infinity)
      plass = plass === null ? iFelt : Math.min(plass, iFelt)
    }
  }
  return plass && plass > 0 ? plass : null
}

interface Tilpasset {
  skrift: number
  linjer: string[]
  /** Sant når teksten ikke fikk plass selv i minste skrift, og er kuttet. */
  kuttet: boolean
}

/**
 * Finner største skrift (fra `start` ned til minste) der teksten får plass i ruten.
 * Går det ikke, kuttes teksten, og siste linje ender med en henvisning til fortsettelsesarket.
 */
function tilpass(tekst: string, font: PDFFont, bredde: number, hoyde: number, flerlinje: boolean, start: number): Tilpasset {
  const minste = Math.min(MINSTE_SKRIFT, start)
  const plass = (s: number) => (flerlinje ? linjerIHoyde(hoyde, s) : 1)
  let skrift = start
  let linjer = brytTekst(tekst, font, skrift, bredde)
  while (linjer.length > plass(skrift) && skrift > minste) {
    skrift = Math.max(minste, skrift - 0.5)
    linjer = brytTekst(tekst, font, skrift, bredde)
  }
  if (linjer.length <= plass(skrift)) return { skrift, linjer, kuttet: false }

  linjer = linjer.slice(0, plass(skrift))
  let siste = linjer[linjer.length - 1]
  const passer = (t: string) => font.widthOfTextAtSize(t, skrift) <= bredde
  while (siste && !passer(`${siste} ${FORTS}`)) {
    const kortere = siste.includes(" ") ? siste.slice(0, siste.lastIndexOf(" ")) : siste.slice(0, -1)
    siste = kortere.trimEnd()
  }
  linjer[linjer.length - 1] = siste && passer(`${siste} ${FORTS}`) ? `${siste} ${FORTS}` : passer(FORTS) ? FORTS : siste
  return { skrift, linjer, kuttet: true }
}

// ─── Utfylling ───────────────────────────────────────────────────────────────

/**
 * Fyller PDF-malen med verdiene. Feltene blir stående redigerbare (ikke «flatet»),
 * så legen kan rette i PDF-leseren. Tomme felt og ubesvarte avkrysninger røres ikke.
 *
 * Teksten settes i 9 punkt og krympes ned til 7 når den ikke får plass. Får den
 * fortsatt ikke plass, står begynnelsen i feltet med en henvisning, og hele teksten
 * på et fortsettelsesark bakerst — ingenting forsvinner i stillhet.
 */
export async function fyllPdf(
  mal: Uint8Array,
  felter: SkjemaFelt[],
  verdier: SkjemaVerdier,
  hode: PdfHode = {},
): Promise<PdfFyllResultat> {
  const doc = await aapne(mal)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const rens = lagRens(font)
  const sider = doc.getPages()
  let form: ReturnType<PDFDocument["getForm"]> | null = null
  const skjema = () => (form ??= doc.getForm())

  const mangler = new Set<string>()
  const forLangt = new Set<string>()
  const fortsettelser: { etikett: string; tekst: string }[] = []
  // Felt som er lagt til arket med vilje. Kommer etter tekstene som ikke fikk plass i skjemaet
  const tillegg: { etikett: string; tekst: string }[] = []
  const paaArk: string[] = []
  let fylt = 0

  function rektangel(boks: PdfBoks) {
    const side = sider[boks.side]
    if (!side) return null
    const ramme = side.getCropBox()
    return {
      side,
      x: ramme.x + boks.x * ramme.width,
      topp: ramme.y + ramme.height * (1 - boks.y),
      b: boks.b * ramme.width,
      h: boks.h * ramme.height,
    }
  }

  function tegnTekst(boks: PdfBoks, tekst: string): "ok" | "kuttet" | "mangler" {
    const r = rektangel(boks)
    if (!r) return "mangler"
    const start = Math.max(MINSTE_SKRIFT, Math.min(STANDARD_SKRIFT, r.h - LUFT))
    const t = tilpass(tekst, font, Math.max(r.b - 2 * LUFT, 4), r.h, true, start)
    const linjehoyde = t.skrift * LINJE
    // Én linje: midt i boksen (skjemalinjen står gjerne rett under). Flere: fra toppen.
    const forste =
      linjerIHoyde(r.h, t.skrift) === 1 ? r.topp - r.h / 2 - t.skrift * 0.35 : r.topp - LUFT - t.skrift * 0.85
    t.linjer.forEach((linje, i) => {
      r.side.drawText(linje, { x: r.x + LUFT, y: forste - i * linjehoyde, size: t.skrift, font, color: rgb(0, 0, 0) })
    })
    return t.kuttet ? "kuttet" : "ok"
  }

  function tegnKryss(boks: PdfBoks): boolean {
    const r = rektangel(boks)
    if (!r) return false
    const s = Math.min(r.b, r.h) * 0.35
    const mx = r.x + r.b / 2
    const my = r.topp - r.h / 2
    const strek = { thickness: Math.max(0.8, s / 5), color: rgb(0, 0, 0) }
    r.side.drawLine({ start: { x: mx - s, y: my - s }, end: { x: mx + s, y: my + s }, ...strek })
    r.side.drawLine({ start: { x: mx - s, y: my + s }, end: { x: mx + s, y: my - s }, ...strek })
    return true
  }

  function finnFelt(navn: string): PDFField | undefined {
    try {
      return skjema().getFieldMaybe(navn)
    } catch {
      return undefined
    }
  }

  /** Setter teksten i et utfyllbart felt. Returnerer sant når den måtte kuttes. */
  function settITekstfelt(felt: PDFTextField, tekst: string): boolean {
    let t = felt.isMultiline() ? tekst : tekst.replace(/\s*\n\s*/g, " ")
    let kuttet = false
    const maks = felt.getMaxLength()
    if (maks !== undefined && t.length > maks) {
      t = t.slice(0, maks)
      kuttet = true
    }
    // Felt med én rute per tegn (f.eks. fødselsnummer) har sin egen skrift og bredde
    const r = felt.isCombed() ? undefined : felt.acroField.getWidgets()[0]?.getRectangle()
    if (r && r.width > 0 && r.height > 0) {
      const egen = skriftstorrelse(felt)
      const start = egen > 0 ? Math.min(egen, STANDARD_SKRIFT) : STANDARD_SKRIFT
      // To punkt smalere enn pdf-lib selv regner med, så linjene aldri brytes annerledes der
      const passet = tilpass(t, font, Math.max(Math.abs(r.width) - 2 * LUFT - 2, 4), Math.abs(r.height), felt.isMultiline(), start)
      if (passet.kuttet) {
        t = passet.linjer.join(felt.isMultiline() ? "\n" : " ")
        kuttet = true
      }
      try {
        felt.setFontSize(passet.skrift)
      } catch {
        // feltet mangler skriftoppsett — da bestemmer PDF-en selv størrelsen
      }
    }
    felt.setText(t)
    return kuttet
  }

  function settTekst(f: SkjemaFelt, maal: PdfMaal, raa: string) {
    const tekst = rens(raa.trim())
    let ok = false
    let kuttet = false
    if (maal.felt) {
      const felt = finnFelt(maal.felt)
      if (felt instanceof PDFTextField) {
        if (settITekstfelt(felt, tekst)) kuttet = true
        ok = true
      } else if (felt instanceof PDFDropdown && felt.getOptions().includes(tekst)) {
        felt.select(tekst)
        ok = true
      }
    }
    if (maal.boks) {
      const svar = tegnTekst(maal.boks, tekst)
      if (svar === "kuttet") kuttet = true
      if (svar !== "mangler") ok = true
    }
    if (kuttet) {
      forLangt.add(f.id)
      fortsettelser.push({ etikett: rens(f.etikett || f.id), tekst })
    }
    if (ok) fylt++
    else mangler.add(f.id)
  }

  function settKryss(f: SkjemaFelt, maal: PdfMaal) {
    let ok = false
    if (maal.felt) {
      const felt = finnFelt(maal.felt)
      if (felt instanceof PDFCheckBox && ruteValg(felt).length > 1) {
        // Flere ruter i samme felt: uten valgt rute vet vi ikke hvilken som er «ja»
        if (maal.valg && velgRute(felt, maal.valg)) ok = true
      } else if (felt instanceof PDFCheckBox) {
        felt.check()
        ok = true
      } else if ((felt instanceof PDFRadioGroup || felt instanceof PDFDropdown) && maal.valg && felt.getOptions().includes(maal.valg)) {
        felt.select(maal.valg)
        ok = true
      }
    }
    if (maal.boks && tegnKryss(maal.boks)) ok = true
    if (ok) fylt++
    else mangler.add(f.id)
  }

  for (const f of felter) {
    const v = verdier[f.id]
    try {
      if (typeof v === "string") {
        if (v.trim() && f.pdf?.ark) {
          tillegg.push({ etikett: rens(f.etikett || f.id), tekst: rens(v.trim()) })
          paaArk.push(f.id)
          fylt++
        } else if (v.trim() && f.pdf && (f.pdf.felt || f.pdf.boks)) settTekst(f, f.pdf, v)
      } else if (v === true) {
        if (f.pdf && (f.pdf.felt || f.pdf.boks)) settKryss(f, f.pdf)
      } else if (v === false) {
        if (f.pdfNei && (f.pdfNei.felt || f.pdfNei.boks)) settKryss(f, f.pdfNei)
        // «Nei» uten egen rute: sørg for at ja-ruten ikke står avkrysset i malen
        const ja = f.pdf?.felt ? finnFelt(f.pdf.felt) : undefined
        if (ja instanceof PDFCheckBox && !f.pdf?.valg && ruteValg(ja).length <= 1 && ja.isChecked()) ja.uncheck()
      }
    } catch {
      mangler.add(f.id)
    }
  }

  // ─── Fortsettelsesark ──────────────────────────────────────────────────────
  let fortsettelsesark = 0
  fortsettelser.push(...tillegg)
  if (fortsettelser.length) {
    const fet = await doc.embedFont(StandardFonts.HelveticaBold)
    const [B, H, MARG, SKRIFT] = [595.28, 841.89, 56, 10]
    const bredde = B - 2 * MARG
    let side = doc.addPage([B, H])
    let y = 0
    const nySide = () => {
      if (fortsettelsesark > 0) side = doc.addPage([B, H])
      fortsettelsesark++
      y = H - MARG
      side.drawText(`Fortsettelsesark${fortsettelsesark > 1 ? ` (${fortsettelsesark})` : ""}`, { x: MARG, y, size: 14, font: fet })
      y -= 18
      for (const linje of [hode.tittel, hode.undertittel]) {
        if (!linje?.trim()) continue
        for (const l of brytTekst(rens(linje.trim()), font, SKRIFT, bredde)) {
          side.drawText(l, { x: MARG, y, size: SKRIFT, font })
          y -= SKRIFT * 1.3
        }
      }
      y -= 4
      side.drawLine({ start: { x: MARG, y }, end: { x: B - MARG, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
      y -= 20
    }
    const skriv = (linje: string, f: PDFFont) => {
      if (y < MARG) nySide()
      side.drawText(linje, { x: MARG, y, size: SKRIFT, font: f })
      y -= SKRIFT * 1.35
    }
    nySide()
    for (const del of fortsettelser) {
      // Overskriften skal ikke bli stående alene nederst på et ark
      if (y < MARG + SKRIFT * 4) nySide()
      for (const l of brytTekst(del.etikett, fet, SKRIFT, bredde)) skriv(l, fet)
      for (const l of brytTekst(del.tekst, font, SKRIFT, bredde)) skriv(l, font)
      y -= SKRIFT
    }
  }

  let pdf: Uint8Array
  try {
    pdf = await doc.save()
  } catch {
    // Enkelte maler har felt pdf-lib ikke klarer å tegne på nytt — lagre uten, PDF-leseren tegner dem
    if (form) (form as ReturnType<PDFDocument["getForm"]>).acroForm.dict.set(PDFName.of("NeedAppearances"), doc.context.obj(true))
    pdf = await doc.save({ updateFieldAppearances: false })
  }
  return { pdf, fylt, mangler: [...mangler], forLangt: [...forLangt], paaArk, fortsettelsesark }
}

/** Verdier til en prøveutskrift: feltets egen tekst i hvert felt, og alle ja-ruter krysset av. */
export function proveVerdier(felter: SkjemaFelt[]): SkjemaVerdier {
  const ut: SkjemaVerdier = {}
  for (const f of felter) ut[f.id] = f.type === "avkrysning" ? true : f.etikett || f.id
  return ut
}

/** Lagrer bytene som en fil hos brukeren. */
export function lastNedPdf(pdf: Uint8Array, filnavn: string) {
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filnavn
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Filnavn uten tegn filsystemer ikke liker. Pasientens navn tas bevisst ikke med. */
export function pdfFilnavn(skjemanavn: string): string {
  const rent = skjemanavn.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
  const d = new Date()
  const dato = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return `${rent || "Skjema"} ${dato}.pdf`
}
