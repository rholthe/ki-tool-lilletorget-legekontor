"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PdfBoks, PdfMaal, SkjemaFelt } from "@/lib/skjema/typer"

/** Det som kan plasseres: et felt, eller ja-/nei-ruten til en avkrysning. */
interface Maal {
  felt: SkjemaFelt
  nei: boolean
}

interface Props {
  pdf: Uint8Array
  felter: SkjemaFelt[]
  onEndre: (id: string, felt: Partial<SkjemaFelt>) => void
  onLukk: () => void
}

type Rute = { x0: number; y0: number; x1: number; y1: number }

const nokkel = (m: Maal) => `${m.felt.id}:${m.nei ? "nei" : "ja"}`
const boksFor = (m: Maal): PdfBoks | undefined => (m.nei ? m.felt.pdfNei : m.felt.pdf)?.boks
const mellom = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Admin tegner bokser på sidene i en flat PDF-mal: velg et felt i listen, dra en
 * rute der teksten skal stå. Avkrysninger holder det å klikke på ruten.
 * Boksene lagres som brøkdeler av siden, så de tåler enhver visningsstørrelse.
 */
export function PdfPlassering({ pdf, felter, onEndre, onLukk }: Props) {
  const [dok, setDok] = useState<PDFDocumentProxy | null>(null)
  const [feil, setFeil] = useState(false)
  const [side, setSide] = useState(0)
  const [drar, setDrar] = useState<Rute | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const maal: Maal[] = felter.flatMap((f) =>
    f.type === "avkrysning"
      ? [
          { felt: f, nei: false },
          { felt: f, nei: true },
        ]
      : [{ felt: f, nei: false }],
  )
  // Starter på første felt som verken har boks eller er koblet til et utfyllbart felt
  const [aktivNokkel, setAktivNokkel] = useState<string | null>(() => {
    const forste = maal.find((m) => !boksFor(m) && !(m.nei ? m.felt.pdfNei : m.felt.pdf)?.felt && !(m.nei && m.felt.pdf?.felt))
    return forste ? nokkel(forste) : null
  })
  const aktiv = maal.find((m) => nokkel(m) === aktivNokkel) ?? null

  useEffect(() => {
    let avbrutt = false
    let oppgave: { destroy: () => Promise<void> } | null = null
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        // Kopi: pdf.js overtar bufferen den får
        const lasting = pdfjs.getDocument({ data: pdf.slice() })
        oppgave = lasting
        const lastet = await lasting.promise
        if (avbrutt) void lasting.destroy()
        else setDok(lastet)
      } catch {
        if (!avbrutt) setFeil(true)
      }
    })()
    return () => {
      avbrutt = true
      void oppgave?.destroy()
    }
  }, [pdf])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!dok || !canvas) return
    let oppgave: { cancel: () => void; promise: Promise<unknown> } | null = null
    let avbrutt = false
    void (async () => {
      const s = await dok.getPage(side + 1)
      if (avbrutt) return
      const grunn = s.getViewport({ scale: 1 })
      const viewport = s.getViewport({ scale: (1000 / grunn.width) * Math.min(window.devicePixelRatio || 1, 2) })
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      oppgave = s.render({ canvas, canvasContext: ctx, viewport })
      await oppgave.promise.catch(() => {})
    })()
    return () => {
      avbrutt = true
      oppgave?.cancel()
    }
  }, [dok, side])

  function settBoks(m: Maal, boks: PdfBoks | undefined) {
    const egenskap = m.nei ? "pdfNei" : "pdf"
    const ny: PdfMaal = { ...(m.felt[egenskap] ?? {}) }
    if (boks) {
      ny.boks = boks
      // En boks i skjemaet erstatter «på fortsettelsesarket»
      delete ny.ark
    } else delete ny.boks
    onEndre(m.felt.id, { [egenskap]: ny.felt || ny.boks || ny.ark ? ny : undefined })
  }

  function velg(m: Maal) {
    setAktivNokkel(nokkel(m))
    const b = boksFor(m)
    if (b) setSide(b.side)
  }

  function punkt(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: mellom((e.clientX - r.left) / r.width), y: mellom((e.clientY - r.top) / r.height), forhold: r.width / r.height }
  }

  function slipp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drar || !aktiv) return
    setDrar(null)
    const { forhold } = punkt(e)
    let x = Math.min(drar.x0, drar.x1)
    let y = Math.min(drar.y0, drar.y1)
    let b = Math.abs(drar.x1 - drar.x0)
    let h = Math.abs(drar.y1 - drar.y0)
    if (b < 0.008 || h < 0.005) {
      // Bare et klikk: nok for en avkrysningsrute, for lite for tekst
      if (aktiv.felt.type !== "avkrysning") return
      b = 0.022
      h = b * forhold
      x = mellom(drar.x0 - b / 2)
      y = mellom(drar.y0 - h / 2)
    }
    const r4 = (v: number) => Math.round(v * 10_000) / 10_000
    settBoks(aktiv, { side, x: r4(x), y: r4(y), b: r4(Math.min(b, 1 - x)), h: r4(Math.min(h, 1 - y)) })
    // Videre til neste som mangler boks
    const i = maal.findIndex((m) => nokkel(m) === nokkel(aktiv))
    const neste = [...maal.slice(i + 1), ...maal.slice(0, i)].find((m) => !boksFor(m) && !(m.nei ? m.felt.pdfNei : m.felt.pdf)?.felt)
    setAktivNokkel(neste ? nokkel(neste) : null)
  }

  const antallSider = dok?.numPages ?? 0
  const prosent = (v: number) => `${v * 100}%`

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onLukk() }}>
      <DialogContent className="!w-[95vw] !max-w-[1500px] h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Plasser feltene på PDF-en</DialogTitle>
          <DialogDescription>
            Velg et felt i listen og dra en rute der teksten skal stå. For avkrysning holder det å klikke midt i ruten.
            Teksten settes i 9 punkt og krympes ned til 7 for å få plass; resten havner på et fortsettelsesark. Tegn boksen så stor som skjemaet tillater.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[20rem_1fr]">
          <ul className="min-h-0 overflow-y-auto space-y-1 pr-1">
            {maal.map((m) => {
              const b = boksFor(m)
              const erAktiv = aktiv !== null && nokkel(m) === nokkel(aktiv)
              return (
                <li key={nokkel(m)} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => velg(m)}
                    aria-pressed={erAktiv}
                    className={`flex-1 min-w-0 flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                      erAktiv ? "border-rose-400 bg-rose-50 text-rose-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {m.felt.etikett || m.felt.id}
                      {m.felt.type === "avkrysning" && <span className="text-slate-400"> · {m.nei ? "Nei" : "Ja"}</span>}
                    </span>
                    {b && (
                      <span className="shrink-0 flex items-center gap-0.5 text-xs text-emerald-700">
                        <Check className="w-3.5 h-3.5" /> s. {b.side + 1}
                      </span>
                    )}
                  </button>
                  {b && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      title="Fjern boksen"
                      onClick={() => settBoks(m, undefined)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="min-h-0 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Button size="icon-sm" variant="outline" title="Forrige side" disabled={side === 0} onClick={() => setSide(side - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span>
                Side {side + 1} av {antallSider || "…"}
              </span>
              <Button
                size="icon-sm"
                variant="outline"
                title="Neste side"
                disabled={side >= antallSider - 1}
                onClick={() => setSide(side + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="flex-1 truncate text-right text-xs text-slate-400">
                {aktiv
                  ? `Tegner: ${aktiv.felt.etikett || aktiv.felt.id}${aktiv.felt.type === "avkrysning" ? (aktiv.nei ? " (Nei)" : " (Ja)") : ""}`
                  : "Velg et felt i listen"}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-3">
              {feil ? (
                <p className="text-sm text-red-600">Kunne ikke vise PDF-en.</p>
              ) : (
                <div className="relative mx-auto w-full max-w-[1000px] bg-white shadow-sm">
                  <canvas ref={canvasRef} className="block w-full h-auto" />
                  <div
                    className={`absolute inset-0 touch-none select-none ${aktiv ? "cursor-crosshair" : ""}`}
                    onPointerDown={(e) => {
                      if (!aktiv || e.button !== 0) return
                      e.currentTarget.setPointerCapture(e.pointerId)
                      const p = punkt(e)
                      setDrar({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
                    }}
                    onPointerMove={(e) => {
                      if (!drar) return
                      const p = punkt(e)
                      setDrar({ ...drar, x1: p.x, y1: p.y })
                    }}
                    onPointerUp={slipp}
                    onPointerCancel={() => setDrar(null)}
                  >
                    {maal.map((m) => {
                      const b = boksFor(m)
                      if (!b || b.side !== side) return null
                      const erAktiv = aktiv !== null && nokkel(m) === nokkel(aktiv)
                      return (
                        <div
                          key={nokkel(m)}
                          className={`pointer-events-none absolute overflow-hidden border text-[10px] leading-tight ${
                            erAktiv ? "border-rose-500 bg-rose-400/25 text-rose-900" : "border-sky-500 bg-sky-400/20 text-sky-900"
                          }`}
                          style={{ left: prosent(b.x), top: prosent(b.y), width: prosent(b.b), height: prosent(b.h) }}
                        >
                          {m.felt.type !== "avkrysning" && <span className="px-0.5">{m.felt.etikett || m.felt.id}</span>}
                        </div>
                      )
                    })}
                    {drar && (
                      <div
                        className="pointer-events-none absolute border border-dashed border-rose-600 bg-rose-400/20"
                        style={{
                          left: prosent(Math.min(drar.x0, drar.x1)),
                          top: prosent(Math.min(drar.y0, drar.y1)),
                          width: prosent(Math.abs(drar.x1 - drar.x0)),
                          height: prosent(Math.abs(drar.y1 - drar.y0)),
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onLukk}>Ferdig</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
