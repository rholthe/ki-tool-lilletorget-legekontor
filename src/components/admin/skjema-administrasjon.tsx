"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Download, FileUp, FolderPlus, Plus, Sparkles, Trash2, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { hentStrukturertSvar } from "@/lib/bedrock-nettleser"
import { byggOppsettForesporsel, tolkOppsettSvar } from "@/lib/skjema/ai"
import { lagreSkjema, lagreSkjemaKategori, slettSkjema, slettSkjemaKategori } from "@/actions/admin-skjema"
import {
  lesPridokStruktur,
  stotterSkjema,
  useJournalUtvidelse,
  type PridokStruktur,
} from "@/hooks/use-journal-utvidelse"
import { PdfPlassering } from "@/components/admin/pdf-plassering"
import {
  fyllPdf,
  lastNedPdf,
  lesPdfMal,
  plassForMaal,
  proveVerdier,
  type PdfFeltInfo,
  type PdfMalInfo,
} from "@/lib/skjema/pdf"
import {
  FELTTYPE_ETIKETT,
  KILDE_ETIKETT,
  type PdfMaal,
  type SkjemaAdmin,
  type SkjemaFelt,
  type SkjemaFeltKilde,
  type SkjemaFeltType,
  type SkjemaKategoriAdmin,
} from "@/lib/skjema/typer"

type Utkast = Omit<SkjemaAdmin, "id" | "kategori" | "beskrivelse"> & {
  id?: string
  kategoriId: string
  beskrivelse: string
}

/** Liten ledetekst over hver kontroll på feltkortet. */
const LEDE = "block text-[11px] leading-none text-slate-400"
const VELG = "h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"

function nyFeltId(felter: SkjemaFelt[]): string {
  const brukt = new Set(felter.map((f) => f.id))
  let n = felter.length + 1
  while (brukt.has(`f${n}`)) n++
  return `f${n}`
}

const MAKS_PDF_BYTE = 10 * 1024 * 1024

/** PDF-malen slik den ligger i minnet mens admin redigerer. */
interface PdfMal {
  byte: Uint8Array
  info: PdfMalInfo
  filnavn: string
  /** Satt når filen er valgt nå og skal lastes opp ved lagring. */
  ny: boolean
}

// Valget i nedtrekket for PDF-felt: «feltnavn» eller «feltnavn␀alternativ»
const SKILLE = "\u0000"
/** Valget «På fortsettelsesarket» i samme nedtrekk. */
const ARK = "\u0001ark"
const maalVerdi = (m: PdfMaal | undefined) => (m?.ark ? ARK : m?.felt ? (m.valg ? `${m.felt}${SKILLE}${m.valg}` : m.felt) : "")

/** PDF-feltene et skjemafelt kan kobles til: tekst mot tekstfelt, avkrysning mot ruter og alternativer. */
function pdfValg(info: PdfMalInfo, avkrysning: boolean): { verdi: string; tekst: string }[] {
  const ut: { verdi: string; tekst: string }[] = []
  const side = (f: PdfFeltInfo) => (f.side === null ? "" : ` (s. ${f.side + 1})`)
  for (const f of info.felter) {
    if (avkrysning) {
      if (f.type === "avkrysning") ut.push({ verdi: f.navn, tekst: f.navn + side(f) })
      else if (f.type === "radio" || f.type === "nedtrekk") {
        for (const v of f.valg)
          ut.push({
            verdi: `${f.navn}${SKILLE}${v}`,
            tekst: `${f.navn} = ${v}${side(f)}`,
          })
      }
    } else if (f.type === "tekst" || f.type === "nedtrekk") {
      ut.push({ verdi: f.navn, tekst: f.navn + side(f) })
    }
  }
  return ut
}

function medPdfFelt(m: PdfMaal | undefined, verdi: string): PdfMaal | undefined {
  if (verdi === ARK) return { ark: true }
  const [felt, valg] = verdi.split(SKILLE)
  const ny: PdfMaal = {
    ...(m?.boks ? { boks: m.boks } : {}),
    ...(felt ? { felt } : {}),
    ...(felt && valg ? { valg } : {}),
  }
  return ny.felt || ny.boks ? ny : undefined
}

const erJa = (t: string) => /^(ja|yes|on|true|1)$/i.test(t.trim())
const erNei = (t: string) => /^(nei|no|off|false|0)$/i.test(t.trim())

/** Feltliste laget av de utfyllbare feltene i PDF-en. */
function felterFraPdf(info: PdfMalInfo): SkjemaFelt[] {
  const ut: SkjemaFelt[] = []
  const ny = (f: PdfFeltInfo, etikett: string, rest: Partial<SkjemaFelt>): SkjemaFelt => ({
    id: `f${ut.length + 1}`,
    etikett,
    type: "tekst",
    kilde: "ai",
    seksjon: info.antallSider > 1 && f.side !== null ? `Side ${f.side + 1}` : undefined,
    ...rest,
  })
  for (const f of info.felter) {
    const etikett = f.hjelp || f.navn.split(".").pop() || f.navn
    if (f.type === "tekst")
      ut.push(
        ny(f, etikett, {
          type: f.flerlinje ? "flerlinje" : "tekst",
          pdf: { felt: f.navn },
          maksTegn: plassForMaal(info, { felt: f.navn }) ?? undefined,
        }),
      )
    else if (f.type === "avkrysning") ut.push(ny(f, etikett, { type: "avkrysning", pdf: { felt: f.navn } }))
    else if (f.type === "radio") {
      const ja = f.valg.find(erJa)
      const nei = f.valg.find(erNei)
      if (f.valg.length === 2 && ja && nei) {
        ut.push(
          ny(f, etikett, {
            type: "avkrysning",
            pdf: { felt: f.navn, valg: ja },
            pdfNei: { felt: f.navn, valg: nei },
          }),
        )
      } else {
        for (const v of f.valg)
          ut.push(
            ny(f, `${etikett}: ${v}`, {
              type: "avkrysning",
              pdf: { felt: f.navn, valg: v },
            }),
          )
      }
    } else {
      // Nedtrekk: legen skriver ett av alternativene
      ut.push(ny(f, etikett, { kilde: "manuell", pdf: { felt: f.navn } }))
    }
  }
  return ut
}

function tomtUtkast(kategoriId: string): Utkast {
  return {
    kategoriId,
    navn: "",
    beskrivelse: "",
    prompt: "",
    aktiv: true,
    felter: [],
  }
}

/** Admin: kategorier, skjema og feltlister. Feltlisten kan importeres fra et åpent skjema i Pridok. */
export function SkjemaAdministrasjon({ kategorier }: { kategorier: SkjemaKategoriAdmin[] }) {
  const router = useRouter()
  const { installert, versjon } = useJournalUtvidelse()
  const kanImportere = installert && stotterSkjema(versjon)

  const [utkast, setUtkast] = useState<Utkast | null>(null)
  const [nyKategori, setNyKategori] = useState("")
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null)
  const [importValg, setImportValg] = useState<PridokStruktur[] | null>(null)
  const [venter, startTransition] = useTransition()
  const [aiStikkord, setAiStikkord] = useState("")
  const [aiErstatt, setAiErstatt] = useState(false)
  const [aiVenter, setAiVenter] = useState(false)
  const [forAi, setForAi] = useState<Utkast | null>(null)
  const [pdfMal, setPdfMal] = useState<PdfMal | null>(null)
  const [pdfFjernet, setPdfFjernet] = useState(false)
  const [plasserer, setPlasserer] = useState(false)

  /**
   * AI-hjelp til oppsettet: instruks for skjemaet, tydeligere feltnavn, kilde og
   * instruks per felt. Bare skjemaets navn og feltliste sendes. Det som alt er
   * skrevet, beholdes med mindre admin ber om å få det erstattet.
   */
  async function foreslaaMedAi() {
    if (!utkast || aiVenter) return
    setMelding(null)
    setAiVenter(true)
    try {
      const foresporsel = byggOppsettForesporsel({
        ...utkast,
        stikkord: aiStikkord,
      })
      const forslag = tolkOppsettSvar(utkast.felter, await hentStrukturertSvar(foresporsel, "promptbygger"))
      let endret = 0
      const felter = utkast.felter.map((f) => {
        const ny = forslag.felter[f.id]
        if (!ny) return f
        const instruks = aiErstatt || !f.instruks?.trim() ? ny.instruks || undefined : f.instruks
        const oppdatert = {
          ...f,
          etikett: ny.etikett,
          kilde: ny.kilde,
          instruks: ny.kilde === "ai" ? instruks : undefined,
        }
        if (oppdatert.etikett !== f.etikett || oppdatert.kilde !== f.kilde || oppdatert.instruks !== f.instruks)
          endret++
        return oppdatert
      })
      const prompt = forslag.prompt && (aiErstatt || !utkast.prompt.trim()) ? forslag.prompt : utkast.prompt
      setForAi(utkast)
      setUtkast({ ...utkast, prompt, felter })
      setMelding({
        ok: true,
        tekst:
          `Forslag lagt inn: ${prompt !== utkast.prompt ? "instruks for skjemaet og " : ""}${endret} av ${felter.length} felt endret. ` +
          "Les over før du lagrer — «Angre AI-forslag» setter alt tilbake.",
      })
    } catch (err) {
      setMelding({
        ok: false,
        tekst: (err as Error).message || "Kunne ikke lage forslag.",
      })
    } finally {
      setAiVenter(false)
    }
  }

  function kjor(
    arbeid: () => Promise<{ ok: true; id?: string } | { ok: false; feil: string }>,
    okTekst: string,
    etter?: () => void,
  ) {
    setMelding(null)
    startTransition(async () => {
      const svar = await arbeid()
      if (svar.ok) {
        setMelding({ ok: true, tekst: okTekst })
        etter?.()
        router.refresh()
      } else {
        setMelding({ ok: false, tekst: svar.feil })
      }
    })
  }

  function aapne(u: Utkast | null) {
    setForAi(null)
    setAiStikkord("")
    setPdfMal(null)
    setPdfFjernet(false)
    setPlasserer(false)
    setUtkast(u)
    if (u?.id && u.pdf) void hentPdfMal(u.id, u.pdf.filnavn)
  }

  /** Henter malen som alt er lastet opp, så feltene i den kan kobles. */
  async function hentPdfMal(id: string, filnavn: string) {
    try {
      const svar = await fetch(`/api/skjema/${id}/pdf`, { cache: "no-store" })
      if (!svar.ok) throw new Error()
      const byte = new Uint8Array(await svar.arrayBuffer())
      const info = await lesPdfMal(byte)
      setPdfMal({ byte, info, filnavn, ny: false })
    } catch (err) {
      setMelding({
        ok: false,
        tekst: (err as Error).message || "Kunne ikke hente PDF-malen.",
      })
    }
  }

  async function velgPdf(fil: File | undefined) {
    if (!fil) return
    setMelding(null)
    if (fil.size > MAKS_PDF_BYTE) {
      setMelding({ ok: false, tekst: "PDF-en er for stor (maks 10 MB)." })
      return
    }
    try {
      const byte = new Uint8Array(await fil.arrayBuffer())
      const info = await lesPdfMal(byte)
      setPdfMal({ byte, info, filnavn: fil.name, ny: true })
      setPdfFjernet(false)
      setMelding({
        ok: true,
        tekst: info.felter.length
          ? `PDF-en har ${info.felter.length} utfyllbare felt. Lag feltlisten fra dem, eller koble feltene du alt har. Malen lastes opp når du lagrer.`
          : "PDF-en har ingen utfyllbare felt. Bruk «Plasser felt på siden» for å tegne hvor hvert felt skal stå. Malen lastes opp når du lagrer.",
      })
    } catch (err) {
      setMelding({
        ok: false,
        tekst: (err as Error).message || "Kunne ikke lese PDF-en.",
      })
    }
  }

  function lagFelterFraPdf() {
    if (!pdfMal || !utkast) return
    if (utkast.felter.length && !window.confirm("Feltlisten erstattes med feltene fra PDF-en. Fortsette?")) return
    const felter = felterFraPdf(pdfMal.info)
    endre({
      felter,
      navn: utkast.navn || pdfMal.filnavn.replace(/\.pdf$/i, ""),
    })
    setMelding({
      ok: true,
      tekst: `Hentet ${felter.length} felt fra PDF-en. Feltnavnene i en PDF er ofte kryptiske — «Last ned prøve» viser hvor hvert felt står, og AI-hjelpen kan foreslå instrukser når navnene er rettet.`,
    })
  }

  async function lastNedProve() {
    if (!pdfMal || !utkast) return
    try {
      const svar = await fyllPdf(pdfMal.byte, utkast.felter, proveVerdier(utkast.felter))
      lastNedPdf(svar.pdf, `Prøve ${pdfMal.filnavn}`)
      setMelding({
        ok: svar.mangler.length === 0,
        tekst:
          `Prøven har feltets egen tekst i ${svar.fylt} felt.` +
          (svar.mangler.length
            ? ` Disse er koblet til noe som ikke finnes i PDF-en: ${svar.mangler.map((id) => utkast.felter.find((f) => f.id === id)?.etikett ?? id).join(" · ")}`
            : ""),
      })
    } catch (err) {
      setMelding({
        ok: false,
        tekst: (err as Error).message || "Kunne ikke fylle ut PDF-en.",
      })
    }
  }

  function endre(felt: Partial<Utkast>) {
    setUtkast((u) => (u ? { ...u, ...felt } : u))
  }

  /** Plassen i PDF-en regnes ut på nytt hver gang et tekstfelt kobles til et annet sted i malen. */
  function medPlass(f: SkjemaFelt, endring: Partial<SkjemaFelt>): Partial<SkjemaFelt> {
    if (!pdfMal || !("pdf" in endring) || "maksTegn" in endring || f.type === "avkrysning") return endring
    return { ...endring, maksTegn: plassForMaal(pdfMal.info, endring.pdf) ?? undefined }
  }

  function regnUtPlass() {
    if (!pdfMal || !utkast) return
    let antall = 0
    const felter = utkast.felter.map((f) => {
      if (f.type === "avkrysning") return f
      const plass = plassForMaal(pdfMal.info, f.pdf)
      if (plass) antall++
      return { ...f, maksTegn: plass ?? undefined }
    })
    endre({ felter })
    setMelding({ ok: true, tekst: `Plassen er regnet ut for ${antall} tekstfelt som er koblet til PDF-en.` })
  }

  function endreFelt(id: string, felt: Partial<SkjemaFelt>) {
    setUtkast((u) =>
      u
        ? {
            ...u,
            felter: u.felter.map((f) => (f.id === id ? { ...f, ...medPlass(f, felt) } : f)),
          }
        : u,
    )
  }

  function flytt(i: number, retning: -1 | 1) {
    setUtkast((u) => {
      if (!u) return u
      const j = i + retning
      if (j < 0 || j >= u.felter.length) return u
      const felter = [...u.felter]
      ;[felter[i], felter[j]] = [felter[j], felter[i]]
      return { ...u, felter }
    })
  }

  function brukImport(dok: PridokStruktur) {
    setImportValg(null)
    setUtkast((u) => {
      if (!u) return u
      const felter: SkjemaFelt[] = dok.felter.map((f, i) => ({
        id: `f${i + 1}`,
        etikett: f.tekst,
        type: f.type,
        kilde: "ai",
        seksjon: f.seksjon || undefined,
        pridokTekst: f.tekst,
      }))
      return { ...u, navn: u.navn || dok.tittel, felter }
    })
    setMelding({
      ok: true,
      tekst: `Hentet ${dok.felter.length} felt fra «${dok.tittel}». Se over, skriv instrukser og lagre.`,
    })
  }

  async function importer() {
    if (utkast?.felter.length && !window.confirm("Feltlisten erstattes med feltene fra Pridok. Fortsette?")) return
    setMelding(null)
    const svar = await lesPridokStruktur()
    if (!svar.ok) {
      setMelding({
        ok: false,
        tekst: `Kunne ikke lese fra Pridok${svar.melding ? `: ${svar.melding}` : "."}`,
      })
      return
    }
    if (svar.dokumenter.length === 0) {
      setMelding({
        ok: false,
        tekst:
          svar.antallFaner === 0
            ? "Fant ingen åpen Pridok-fane. Åpne et tomt skjema i Pridok og prøv igjen."
            : "Fant ingen åpne dokumenter med felt i Pridok. Åpne et tomt skjema og prøv igjen.",
      })
      return
    }
    if (svar.dokumenter.length === 1) brukImport(svar.dokumenter[0])
    else setImportValg(svar.dokumenter)
  }

  function lagre() {
    if (!utkast) return
    const mal = pdfMal
    const fjern = pdfFjernet
    kjor(
      async () => {
        const svar = await lagreSkjema({
          id: utkast.id,
          kategoriId: utkast.kategoriId,
          navn: utkast.navn,
          beskrivelse: utkast.beskrivelse,
          prompt: utkast.prompt,
          aktiv: utkast.aktiv,
          felter: utkast.felter.map((f) => ({
            ...f,
            seksjon: f.seksjon?.trim() || undefined,
            instruks: f.instruks?.trim() || undefined,
            pridokTekst: f.pridokTekst?.trim() || undefined,
          })),
        })
        if (!svar.ok || !svar.id) return svar
        // PDF-malen går for seg (for stor for en server action)
        if (mal?.ny) {
          const opp = await fetch(`/api/admin/skjema/${svar.id}/pdf`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/pdf",
              "X-Filnavn": encodeURIComponent(mal.filnavn),
            },
            body: mal.byte as BodyInit,
          })
          if (!opp.ok) {
            const feil = await opp.json().catch(() => null)
            return {
              ok: false as const,
              feil: `Skjemaet er lagret, men PDF-malen ble ikke lastet opp: ${feil?.feil ?? opp.status}`,
            }
          }
        } else if (fjern) {
          const slett = await fetch(`/api/admin/skjema/${svar.id}/pdf`, {
            method: "DELETE",
          })
          if (!slett.ok)
            return {
              ok: false as const,
              feil: "Skjemaet er lagret, men PDF-malen ble ikke fjernet.",
            }
        }
        return svar
      },
      "Skjemaet er lagret.",
      () => aapne(null),
    )
  }

  return (
    <div className="space-y-6">
      {melding && (
        <p
          role="status"
          className={`text-sm rounded-md border px-3 py-2 ${
            melding.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {melding.tekst}
        </p>
      )}

      {!utkast && (
        <>
          <div className="space-y-4">
            {kategorier.length === 0 && (
              <p className="text-sm text-slate-500">Ingen kategorier ennå. Lag en kategori (f.eks. NAV) først.</p>
            )}
            {kategorier.map((k) => (
              <section key={k.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex-1">{k.navn}</h2>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => aapne(tomtUtkast(k.id))}>
                    <Plus className="w-4 h-4" /> Nytt skjema
                  </Button>
                  {k.skjemaer.length === 0 && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-600"
                      title="Slett kategorien"
                      disabled={venter}
                      onClick={() => kjor(() => slettSkjemaKategori(k.id), "Kategorien er slettet.")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {k.skjemaer.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">Ingen skjema i denne kategorien.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {k.skjemaer.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setMelding(null)
                            aapne({
                              ...s,
                              kategoriId: k.id,
                              beskrivelse: s.beskrivelse ?? "",
                            })
                          }}
                          className="w-full flex items-center gap-2 py-2 text-left hover:bg-slate-50 rounded px-1"
                        >
                          <span className="font-medium text-slate-800 flex-1 min-w-0 truncate">{s.navn}</span>
                          <span className="text-xs text-slate-400 shrink-0">{s.felter.length} felt</span>
                          {!s.aktiv && (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Skjult</Badge>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <form
            className="flex items-end gap-2 max-w-md"
            onSubmit={(e) => {
              e.preventDefault()
              kjor(
                () =>
                  lagreSkjemaKategori({
                    navn: nyKategori,
                    rekkefolge: kategorier.length,
                  }),
                "Kategorien er opprettet.",
                () => setNyKategori(""),
              )
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ny-kategori">Ny kategori</Label>
              <Input
                id="ny-kategori"
                value={nyKategori}
                onChange={(e) => setNyKategori(e.target.value)}
                placeholder="NAV, Forsikring, Idrett, Skole …"
                maxLength={100}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="gap-1.5"
              disabled={venter || nyKategori.trim().length < 2}
            >
              <FolderPlus className="w-4 h-4" /> Legg til
            </Button>
          </form>
        </>
      )}

      {utkast && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="skjema-navn">Navn</Label>
              <Input
                id="skjema-navn"
                value={utkast.navn}
                onChange={(e) => endre({ navn: e.target.value })}
                placeholder="SPK – legeerklæring ved søknad om uføretrygd"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skjema-kategori">Kategori</Label>
              <select
                id="skjema-kategori"
                className={`${VELG} w-full`}
                value={utkast.kategoriId}
                onChange={(e) => endre({ kategoriId: e.target.value })}
              >
                {kategorier.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.navn}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="skjema-beskrivelse">Beskrivelse (vises for legen, valgfritt)</Label>
              <Input
                id="skjema-beskrivelse"
                value={utkast.beskrivelse}
                onChange={(e) => endre({ beskrivelse: e.target.value })}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="skjema-prompt">Instruks til AI for dette skjemaet</Label>
              <Textarea
                id="skjema-prompt"
                value={utkast.prompt}
                onChange={(e) => endre({ prompt: e.target.value })}
                rows={6}
                className="text-sm"
                placeholder="Hva skjemaet brukes til, hvem som leser det, og hva som er viktig å få fram. Instrukser for enkeltfelt skrives på feltet."
              />
              <p className="text-xs text-slate-400">
                Legges etter den felles systemprompten for skjema (Promptbibliotek → Staging). Innloggede brukere kan se
                teksten i nettleseren, så ikke legg hemmeligheter her.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={utkast.aktiv} onChange={(e) => endre({ aktiv: e.target.checked })} />
              Synlig for legene
            </label>
          </div>

          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-700">AI-hjelp til oppsettet</h3>
            </div>
            <p className="text-xs text-slate-500">
              Foreslår instruks for skjemaet, tydeligere feltnavn, hvilke felt legen bør fylle ut selv, og en kort
              instruks per felt. Bare skjemaets navn og feltliste sendes til AI. Importer eller legg inn feltene først.
            </p>
            <Textarea
              value={aiStikkord}
              onChange={(e) => setAiStikkord(e.target.value)}
              rows={2}
              className="text-sm bg-white"
              placeholder="Valgfritt: det du vil ha vektlagt, f.eks. «NAV vil ha funksjonsbeskrivelser, ikke lange sykehistorier. Korte svar.»"
              aria-label="Stikkord til AI"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                className="gap-1.5 bg-rose-600 hover:bg-rose-700"
                disabled={aiVenter || utkast.felter.length === 0}
                onClick={foreslaaMedAi}
              >
                <Sparkles className="w-4 h-4" />
                {aiVenter ? "Lager forslag…" : "Lag forslag"}
              </Button>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={aiErstatt} onChange={(e) => setAiErstatt(e.target.checked)} />
                Erstatt instrukser som allerede er skrevet
              </label>
              {forAi && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={aiVenter}
                  onClick={() => {
                    setUtkast(forAi)
                    setForAi(null)
                    setMelding({ ok: true, tekst: "AI-forslaget er angret." })
                  }}
                >
                  <Undo2 className="w-4 h-4" /> Angre AI-forslag
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileUp className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-700">PDF-mal (valgfritt)</h3>
            </div>
            <p className="text-xs text-slate-500">
              Det tomme skjemaet som PDF. Legen får da «Last ned PDF» med feltene fylt inn. Utfyllbare PDF-er kobles
              felt for felt; i flate PDF-er (skannet eller uten felt) tegner du hvor hver tekst skal stå. Last bare opp
              tomme skjema — aldri et som er fylt ut for en pasient.
            </p>
            {pdfMal ? (
              <>
                <p className="text-sm text-slate-700">
                  <span className="font-medium">{pdfMal.filnavn}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {pdfMal.info.antallSider} {pdfMal.info.antallSider === 1 ? "side" : "sider"} ·{" "}
                    {pdfMal.info.felter.length} utfyllbare felt
                    {pdfMal.ny && " · lastes opp når du lagrer"}
                  </span>
                </p>
                {pdfMal.info.roterteSider.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Side {pdfMal.info.roterteSider.map((s) => s + 1).join(", ")} er rotert i filen. Bokser som tegnes
                    der havner feil — lagre PDF-en med riktig retning først («Skriv ut til PDF»).
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {pdfMal.info.felter.length > 0 && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={lagFelterFraPdf}>
                      <Download className="w-4 h-4" /> Lag feltlisten fra PDF-en
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={utkast.felter.length === 0}
                    onClick={() => setPlasserer(true)}
                  >
                    Plasser felt på siden
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!utkast.felter.some((f) => f.type !== "avkrysning" && (f.pdf?.felt || f.pdf?.boks))}
                    title="Regner ut omtrent hvor mange tegn det er plass til i hvert tekstfelt, ut fra feltets størrelse i PDF-en"
                    onClick={regnUtPlass}
                  >
                    Regn ut plass
                  </Button>
                  <Button size="sm" variant="outline" disabled={utkast.felter.length === 0} onClick={lastNedProve}>
                    Last ned prøve
                  </Button>
                  <label className="cursor-pointer text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900">
                    Bytt fil
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => {
                        void velgPdf(e.target.files?.[0])
                        e.target.value = ""
                      }}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setPdfFjernet(true)
                      setPdfMal(null)
                    }}
                  >
                    Fjern PDF-malen
                  </Button>
                </div>
              </>
            ) : utkast.pdf && !pdfFjernet ? (
              <p className="text-sm text-slate-500">Henter {utkast.pdf.filnavn} …</p>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Velg PDF-mal"
                  className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
                  onChange={(e) => {
                    void velgPdf(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                {pdfFjernet && <span className="text-xs text-amber-700">PDF-malen fjernes når du lagrer.</span>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex-1">
                Felt ({utkast.felter.length})
              </h3>
              {kanImportere ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={importer}>
                  <Download className="w-4 h-4" /> Importer fra Pridok
                </Button>
              ) : (
                <span className="text-xs text-slate-400">
                  Import fra Pridok krever nettleserutvidelsen, versjon 1.2 eller nyere
                </span>
              )}
            </div>

            {importValg && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-2">
                <p className="text-sm text-slate-700">Flere dokumenter er åpne i Pridok. Hvilket skal importeres?</p>
                {importValg.map((d) => (
                  <button
                    key={`${d.tabId}:${d.dokId}`}
                    type="button"
                    onClick={() => brukImport(d)}
                    className="block w-full rounded border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-sky-300"
                  >
                    <span className="font-medium text-slate-800">{d.tittel}</span>
                    <span className="text-slate-500"> · {d.felter.length} felt</span>
                  </button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setImportValg(null)}>
                  Avbryt
                </Button>
              </div>
            )}

            {utkast.felter.map((f, i) => (
              <div key={f.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="mt-6 w-6 shrink-0 text-xs text-slate-400">{i + 1}</span>
                  <label className="flex-1 space-y-1">
                    <span className={LEDE}>Teksten legen ser over feltet</span>
                    <Input
                      value={f.etikett}
                      onChange={(e) => endreFelt(f.id, { etikett: e.target.value })}
                      placeholder="Feltets tekst"
                      className="text-sm"
                    />
                  </label>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="mt-4"
                    title="Flytt opp"
                    disabled={i === 0}
                    onClick={() => flytt(i, -1)}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="mt-4"
                    title="Flytt ned"
                    disabled={i === utkast.felter.length - 1}
                    onClick={() => flytt(i, 1)}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="mt-4 text-slate-400 hover:text-red-600"
                    title="Fjern feltet"
                    onClick={() =>
                      endre({
                        felter: utkast.felter.filter((x) => x.id !== f.id),
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid gap-2 pl-8 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className={LEDE}>Type felt</span>
                    <select
                      className={`${VELG} w-full`}
                      value={f.type}
                      onChange={(e) => {
                        const type = e.target.value as SkjemaFeltType
                        // Avkrysning kan ikke hente verdi fra pasient eller dato
                        const kilde = type === "avkrysning" && f.kilde !== "manuell" ? "ai" : f.kilde
                        endreFelt(f.id, { type, kilde })
                      }}
                    >
                      {(Object.keys(FELTTYPE_ETIKETT) as SkjemaFeltType[]).map((t) => (
                        <option key={t} value={t}>
                          {FELTTYPE_ETIKETT[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={LEDE}>Hvem fyller ut</span>
                    <select
                      className={`${VELG} w-full`}
                      value={f.kilde}
                      onChange={(e) =>
                        endreFelt(f.id, {
                          kilde: e.target.value as SkjemaFeltKilde,
                        })
                      }
                    >
                      {(Object.keys(KILDE_ETIKETT) as SkjemaFeltKilde[])
                        .filter((k) => f.type !== "avkrysning" || k === "ai" || k === "manuell")
                        .map((k) => (
                          <option key={k} value={k}>
                            {KILDE_ETIKETT[k]}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={LEDE}>Overskrift feltet står under</span>
                    <Input
                      value={f.seksjon ?? ""}
                      onChange={(e) => endreFelt(f.id, { seksjon: e.target.value })}
                      placeholder="Valgfritt"
                      className="h-8 text-sm"
                    />
                  </label>
                </div>
                <div className="grid gap-2 pl-8 sm:grid-cols-2">
                  {f.kilde === "ai" && (
                    <label className="space-y-1">
                      <span className={LEDE}>Instruks til AI for dette feltet (legen ser den ikke)</span>
                      <Textarea
                        value={f.instruks ?? ""}
                        onChange={(e) => endreFelt(f.id, { instruks: e.target.value })}
                        placeholder="Valgfritt"
                        rows={2}
                        className="text-sm"
                      />
                    </label>
                  )}
                  <label className="space-y-1">
                    <span className={LEDE}>Feltets tekst i Pridok – må stemme nøyaktig. Tom = sendes ikke</span>
                    <Input
                      value={f.pridokTekst ?? ""}
                      onChange={(e) => endreFelt(f.id, { pridokTekst: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </label>
                </div>
                {pdfMal && (
                  <div className="flex flex-wrap items-center gap-2 pl-8 text-xs text-slate-500">
                    <span className="shrink-0 font-medium text-slate-600" title="Hvor feltet havner i PDF-malen">
                      Felt i PDF-malen
                    </span>
                    {(f.type === "avkrysning" ? (["pdf", "pdfNei"] as const) : (["pdf"] as const)).map((egenskap) => {
                      const m = f[egenskap]
                      const valg = pdfValg(pdfMal.info, f.type === "avkrysning")
                      const naa = maalVerdi(m)
                      const hva = f.type === "avkrysning" ? (egenskap === "pdf" ? "Ja" : "Nei") : ""
                      return (
                        <span key={egenskap} className="flex items-center gap-1.5">
                          {hva && <span>{hva}:</span>}
                          {(valg.length > 0 || naa || f.type !== "avkrysning") && (
                            <select
                              className={`${VELG} max-w-64`}
                              value={naa}
                              aria-label={`Felt i PDF-en${hva ? ` for ${hva}` : ""}`}
                              onChange={(e) =>
                                endreFelt(f.id, {
                                  [egenskap]: medPdfFelt(m, e.target.value),
                                })
                              }
                            >
                              <option value="">{egenskap === "pdfNei" ? "(ingen egen rute)" : "(ikke koblet)"}</option>
                              {f.type !== "avkrysning" && <option value={ARK}>På fortsettelsesarket (eget ark bakerst)</option>}
                              {naa && naa !== ARK && !valg.some((v) => v.verdi === naa) && (
                                <option value={naa}>{naa.replace(SKILLE, " = ")} — finnes ikke i PDF-en</option>
                              )}
                              {valg.map((v) => (
                                <option key={v.verdi} value={v.verdi}>
                                  {v.tekst}
                                </option>
                              ))}
                            </select>
                          )}
                          {m?.boks ? (
                            <span className="flex items-center gap-0.5 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-sky-700">
                              boks s. {m.boks.side + 1}
                              <button
                                type="button"
                                title="Fjern boksen"
                                className="hover:text-red-600"
                                onClick={() =>
                                  endreFelt(f.id, {
                                    [egenskap]: m.felt ? { felt: m.felt, valg: m.valg } : undefined,
                                  })
                                }
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ) : (
                            f.type === "avkrysning" && valg.length === 0 && !naa && <span className="text-slate-400">ingen boks</span>
                          )}
                        </span>
                      )
                    })}
                    {f.pdf?.ark && (
                      <span className="text-slate-400">
                        Teksten settes på et eget ark bakerst, under feltets etikett. Skriv i instruksen hva AI skal liste opp.
                      </span>
                    )}
                    {f.type !== "avkrysning" && !f.pdf?.ark && (
                      <label
                        className="flex items-center gap-1.5"
                        title="Omtrent hvor mange tegn det er plass til i PDF-en. AI får det som grense, og legen ser en teller. Tom = ingen grense"
                      >
                        Plass, ca.
                        <Input
                          type="number"
                          min={1}
                          value={f.maksTegn ?? ""}
                          onChange={(e) => {
                            const n = Math.round(Number(e.target.value))
                            endreFelt(f.id, { maksTegn: n > 0 ? n : undefined })
                          }}
                          className="h-8 w-20 text-sm"
                        />
                        tegn
                      </label>
                    )}
                  </div>
                )}
              </div>
            ))}

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                endre({
                  felter: [
                    ...utkast.felter,
                    {
                      id: nyFeltId(utkast.felter),
                      etikett: "",
                      type: "flerlinje",
                      kilde: "ai",
                    },
                  ],
                })
              }
            >
              <Plus className="w-4 h-4" /> Legg til felt
            </Button>
          </div>

          {plasserer && pdfMal && (
            <PdfPlassering
              pdf={pdfMal.byte}
              felter={utkast.felter}
              onEndre={endreFelt}
              onLukk={() => setPlasserer(false)}
            />
          )}

          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <Button className="bg-rose-600 hover:bg-rose-700" disabled={venter} onClick={lagre}>
              {venter ? "Lagrer…" : "Lagre skjema"}
            </Button>
            <Button variant="outline" onClick={() => aapne(null)}>
              Avbryt
            </Button>
            <div className="flex-1" />
            {utkast.id && (
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                disabled={venter}
                onClick={() => {
                  if (!window.confirm(`Slette «${utkast.navn}»? Dette kan ikke angres.`)) return
                  const id = utkast.id!
                  kjor(
                    () => slettSkjema(id),
                    "Skjemaet er slettet.",
                    () => aapne(null),
                  )
                }}
              >
                Slett skjema
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
