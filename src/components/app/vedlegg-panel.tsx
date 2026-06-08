"use client"

import { useRef } from "react"
import { X, FileText, Upload, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Vedlegg, VedleggOppgave, SpirometriType } from "@/types/konsultasjon"
import { VEDLEGG_OPPGAVE_INFO, SPIROMETRI_TYPE_INFO } from "@/lib/vedlegg"
import { cuid } from "@/lib/cuid"

const MAKS_STORRELSE_MB = 8
const MAKS_ANTALL = 5
const GODKJENTE_TYPER = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const

type GodkjentMimeType = (typeof GODKJENTE_TYPER)[number]

interface Props {
  vedlegg: Vedlegg[]
  onChange: (vedlegg: Vedlegg[]) => void
}

export function VedleggPanel({ vedlegg, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function leggTilFiler(filer: FileList) {
    const nye: Vedlegg[] = []

    for (const fil of Array.from(filer)) {
      if (vedlegg.length + nye.length >= MAKS_ANTALL) break

      if (!GODKJENTE_TYPER.includes(fil.type as GodkjentMimeType)) continue
      if (fil.size > MAKS_STORRELSE_MB * 1024 * 1024) continue

      const base64 = await lesFil(fil)
      nye.push({
        id: cuid(),
        navn: fil.name,
        mimeType: fil.type as GodkjentMimeType,
        base64,
        oppgave: "kontekst",
      })
    }

    if (nye.length > 0) onChange([...vedlegg, ...nye])
  }

  function lesFil(fil: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        // Anthropic API forventer ren base64 uten data-URI prefix
        resolve(result.split(",")[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(fil)
    })
  }

  function oppdaterVedlegg(id: string, endring: Partial<Vedlegg>) {
    onChange(vedlegg.map((v) => (v.id === id ? { ...v, ...endring } : v)))
  }

  function fjernVedlegg(id: string) {
    onChange(vedlegg.filter((v) => v.id !== id))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) leggTilFiler(e.dataTransfer.files)
  }

  const kanLeggeTilFler = vedlegg.length < MAKS_ANTALL

  return (
    <div className="space-y-3">
      {/* Opplastingssone */}
      {kanLeggeTilFler && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <Upload className="w-5 h-5 text-slate-400" />
          <p className="text-sm text-slate-500">
            Dra og slipp, eller klikk for å velge
          </p>
          <p className="text-xs text-slate-400">
            JPG, PNG, GIF, WEBP eller PDF · maks {MAKS_STORRELSE_MB} MB per fil · maks {MAKS_ANTALL} filer
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && leggTilFiler(e.target.files)}
          />
        </div>
      )}

      {/* Liste over vedlegg */}
      {vedlegg.length > 0 && (
        <ul className="space-y-3">
          {vedlegg.map((v) => (
            <li
              key={v.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              {/* Topprad: ikon + navn + slett */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {v.mimeType === "application/pdf" ? (
                    <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                  ) : (
                    <ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-700 truncate">{v.navn}</span>
                </div>
                <button
                  onClick={() => fjernVedlegg(v.id)}
                  className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Fjern vedlegg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Oppgavevelger */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">
                  Claude sin oppgave med dette vedlegget
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(VEDLEGG_OPPGAVE_INFO) as [VedleggOppgave, { label: string; beskrivelse: string }][]).map(
                    ([oppgave, info]) => (
                      <button
                        key={oppgave}
                        onClick={() =>
                          oppdaterVedlegg(v.id, {
                            oppgave,
                            spirometriType:
                              oppgave === "spirometri"
                                ? (v.spirometriType ?? "uten_bronkodilator")
                                : undefined,
                            egendefinertPrompt:
                              oppgave === "egendefinert"
                                ? (v.egendefinertPrompt ?? "")
                                : undefined,
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                          v.oppgave === oppgave
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        }`}
                      >
                        {info.label}
                      </button>
                    )
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {VEDLEGG_OPPGAVE_INFO[v.oppgave].beskrivelse}
                </p>
              </div>

              {/* Spirometri-subvalg */}
              {v.oppgave === "spirometri" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">Type test</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(SPIROMETRI_TYPE_INFO) as [SpirometriType, { label: string; beskrivelse: string }][]).map(
                      ([type, info]) => (
                        <button
                          key={type}
                          onClick={() =>
                            oppdaterVedlegg(v.id, { spirometriType: type })
                          }
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            (v.spirometriType ?? "uten_bronkodilator") === type
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                          }`}
                        >
                          {info.label}
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {SPIROMETRI_TYPE_INFO[v.spirometriType ?? "uten_bronkodilator"].beskrivelse}
                  </p>
                </div>
              )}

              {/* Egendefinert prompt */}
              {v.oppgave === "egendefinert" && (
                <Textarea
                  placeholder="Eks: Vurder dette utslettet, tolk denne bentetthetsmålingen..."
                  value={v.egendefinertPrompt ?? ""}
                  onChange={(e) =>
                    oppdaterVedlegg(v.id, { egendefinertPrompt: e.target.value })
                  }
                  className="resize-none text-sm h-20 border-slate-200"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {vedlegg.length === 0 && !kanLeggeTilFler && null}

      {vedlegg.length >= MAKS_ANTALL && (
        <p className="text-xs text-slate-400 text-center">
          Maks {MAKS_ANTALL} vedlegg nådd.
        </p>
      )}
    </div>
  )
}
