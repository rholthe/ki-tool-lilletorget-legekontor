"use client"

import { useState, useRef } from "react"
import { Upload, FileText, Copy, Check, BookOpen, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { useClaude } from "@/hooks/use-claude"

const NOK_PER_MILLION_TOKENS = 31  // Sonnet 4.6: ~$3/MTok × 10.3 NOK/USD
const MAKS_TOKENS_ADVARSEL = 180_000

function parseStikkord(fullTekst: string): { notat: string; stikkord?: string[] } {
  const match = fullTekst.match(/\nSTIKKORD:\s*(.+?)[\n\r]*$/)
  if (!match) return { notat: fullTekst }
  const notat = fullTekst.slice(0, fullTekst.length - match[0].length)
  const stikkord = match[1].split(",").map((s) => s.trim()).filter(Boolean)
  return { notat, stikkord }
}

function formaterTokener(n: number): string {
  return n.toLocaleString("nb-NO")
}

function formaterKroner(kr: number): string {
  if (kr < 0.01) return "< kr 0,01"
  return `kr ${kr.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function JournalgjennomgangView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const { genererNotat, isGenerating, feil: claudeFeil, avbryt } = useClaude()

  const [fremgang, setFremgang] = useState<{ side: number; total: number } | null>(null)
  const [pdfFeil, setPdfFeil] = useState<string | null>(null)
  const [streamingNotat, setStreamingNotat] = useState("")
  const [kopiert, setKopiert] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!aktiv) return null

  const tekst = aktiv.transkript ?? ""
  const antallTokener = Math.ceil(tekst.length / 4)
  const kostnadNok = (antallTokener / 1_000_000) * NOK_PER_MILLION_TOKENS
  const visMaksAdvarsel = antallTokener > MAKS_TOKENS_ADVARSEL
  const harTekst = tekst.trim().length > 0
  const visNotat = streamingNotat || aktiv.notat
  const harNotat = Boolean(visNotat)

  async function ekstraherFraPDF(file: File) {
    if (file.type !== "application/pdf") {
      setPdfFeil("Kun PDF-filer støttes.")
      return
    }
    setPdfFeil(null)
    setFremgang({ side: 0, total: 0 })
    try {
      const pdfjsLib = await import("pdfjs-dist")
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
      const totalSider = pdf.numPages
      setFremgang({ side: 0, total: totalSider })

      const deler: string[] = []
      for (let i = 1; i <= totalSider; i++) {
        setFremgang({ side: i, total: totalSider })
        const side = await pdf.getPage(i)
        const innhold = await side.getTextContent()
        const sidetekst = innhold.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((item: any) => typeof item.str === "string")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str as string)
          .join(" ")
        deler.push(sidetekst)
      }

      await oppdater({ transkript: deler.join("\n\n"), status: "ny" })
    } catch (err) {
      console.error("PDF-ekstraksjon feilet:", err)
      setPdfFeil("Kunne ikke lese PDF-filen. Prøv en annen fil.")
    } finally {
      setFremgang(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) ekstraherFraPDF(file)
  }

  function handleFilValg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) ekstraherFraPDF(file)
    e.target.value = ""
  }

  async function handleGenerer() {
    if (!aktiv) return
    await oppdater({ status: "prosesserer" })
    await genererNotat(
      aktiv,
      undefined,
      (delta) => {
        setStreamingNotat((prev) => {
          const combined = prev + delta
          const idx = combined.indexOf("\nSTIKKORD:")
          return idx !== -1 ? combined.slice(0, idx) : combined
        })
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      },
      async (fullTekst) => {
        const { notat, stikkord } = parseStikkord(fullTekst)
        setStreamingNotat("")
        await oppdater({ notat, status: "ferdig", ...(stikkord ? { stikkord } : {}) })
      }
    )
  }

  async function kopierNotat() {
    if (!visNotat) return
    await navigator.clipboard.writeText(visNotat)
    setKopiert(true)
    setTimeout(() => setKopiert(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Journalgjennomgang</h1>
            <p className="text-sm text-slate-400">Last opp tidligere journal (PDF) for AI-oppsummering</p>
          </div>
        </div>

        <Separator />

        {/* PDF-opplasting */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700">Journal (PDF)</h2>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFilValg}
          />

          {!harTekst && !fremgang && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-violet-300 hover:bg-violet-50 transition-colors cursor-pointer"
            >
              <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Dra og slipp PDF, eller klikk for å velge</p>
              <p className="text-xs text-slate-400 mt-1">Kun PDF-filer</p>
            </div>
          )}

          {fremgang && (
            <div className="border border-slate-200 rounded-xl p-6 text-center bg-violet-50">
              <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600">
                Ekstraherer tekst
                {fremgang.total > 0 && (
                  <span className="font-medium"> — side {fremgang.side} av {fremgang.total}</span>
                )}
                …
              </p>
            </div>
          )}

          {pdfFeil && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{pdfFeil}</span>
              <button onClick={() => setPdfFeil(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {harTekst && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    ~{formaterTokener(antallTokener)} tokens · {formaterKroner(kostnadNok)} estimert inputkostnad
                  </span>
                </div>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-xs text-violet-600 hover:text-violet-800 shrink-0"
                >
                  Last opp ny PDF
                </button>
              </div>

              {visMaksAdvarsel && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Teksten er lang ({formaterTokener(antallTokener)} tokens). Vurder å fjerne irrelevante deler for å
                    redusere kostnad og responstid.
                  </span>
                </div>
              )}

              <Textarea
                value={tekst}
                onChange={(e) => oppdater({ transkript: e.target.value })}
                className="font-mono text-xs resize-none min-h-48 max-h-80 border-slate-200"
                placeholder="Ekstrahert journaltekst…"
              />
            </div>
          )}
        </div>

        {/* Fokusspørsmål */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-700">
            Fokusspørsmål{" "}
            <span className="text-slate-400 font-normal">(valgfritt)</span>
          </h2>
          <Textarea
            value={aktiv.tilleggsinfo}
            onChange={(e) => oppdater({ tilleggsinfo: e.target.value })}
            placeholder={"Eks: Kardiovaskulære risikofaktorer\nNyrefunksjon siste 2 år?\nTrekk ut alle anbefalinger fra spesialister"}
            className="resize-none h-24 text-sm border-slate-200"
          />
        </div>

        {/* Generer-knapp */}
        <div className="flex items-center gap-3">
          {!isGenerating ? (
            <Button
              onClick={handleGenerer}
              disabled={!harTekst}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {harNotat ? "Regenerer oppsummering" : "Generer oppsummering"}
            </Button>
          ) : (
            <Button variant="outline" onClick={avbryt} className="gap-2">
              Avbryt
            </Button>
          )}
        </div>

        {/* API-feil */}
        {claudeFeil && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{claudeFeil}</span>
          </div>
        )}

        {/* Resultat */}
        {harNotat && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-700">Oppsummering</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={kopierNotat}
                >
                  {kopiert ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {kopiert ? "Kopiert" : "Kopier"}
                </Button>
              </div>
              <div ref={scrollRef} className="overflow-y-auto max-h-[60vh]">
                <Textarea
                  value={visNotat}
                  onChange={(e) => oppdater({ notat: e.target.value })}
                  className="resize-none min-h-96 text-sm border-slate-200 font-mono"
                  readOnly={isGenerating}
                />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
