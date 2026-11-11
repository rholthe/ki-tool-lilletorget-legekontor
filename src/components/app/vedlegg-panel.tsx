"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { X, FileText, Upload, ImageIcon, ChevronDown, ChevronUp, Camera, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Vedlegg, VedleggOppgave, VedleggOcrBruk, SpirometriType } from "@/types/konsultasjon"
import { VEDLEGG_OPPGAVE_INFO, VEDLEGG_OCR_BRUK_INFO, SPIROMETRI_TYPE_INFO } from "@/lib/vedlegg"
import { cuid } from "@/lib/cuid"

const MAKS_STORRELSE_MB = 8
const MAKS_ANTALL = 5
/** PDF-er som leses som tekst, sendes ikke som fil og kan derfor være større. */
const MAKS_TEKST_PDF_MB = 50
/** Over dette er teksten trolig for lang til én forespørsel (omtrent 150 000 tokens). */
const LANG_TEKST_TEGN = 450_000

/** Beskjed om hva som skjedde med en fil. Bare i minnet; forsvinner når visningen lukkes. */
interface Filmelding {
  id: string
  type: "tekst" | "skannet" | "feil"
  navn: string
  tekst: string
  /** Lest som tekst: blokken som ble lagt i konteksten, og filen i tilfelle legen heller vil sende den. */
  blokk?: string
  base64?: string
}
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
  /** "ocr" = les tekst-modus, "enkel" = ren kontekst uten oppgave-/OCR-instruks. */
  modus?: "ocr" | "enkel"
  /** Kompakt opplastingssone (én rad) — sparer plass. */
  kompakt?: boolean
  /**
   * Sammen med `onKontekst`: PDF-er med tekstlag leses som tekst her i nettleseren og legges
   * i konteksten i stedet for å sendes som fil. Skannede PDF-er blir vedlegg som før.
   */
  kontekst?: string
  onKontekst?: (ny: string) => void
}

export function VedleggPanel({ vedlegg, onChange, modus, kompakt, kontekst, onKontekst }: Props) {
  const synligeVedlegg = modus === "ocr"
    ? vedlegg.filter((v) => v.oppgave === "ocr")
    : modus === "enkel"
      ? vedlegg
      : vedlegg.filter((v) => v.oppgave !== "ocr")
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [leser, setLeser] = useState<string | null>(null)
  const [filmeldinger, setFilmeldinger] = useState<Filmelding[]>([])
  // Lesingen av en PDF tar tid; konteksten kan ha endret seg når den er ferdig
  const kontekstRef = useRef(kontekst ?? "")
  useEffect(() => {
    kontekstRef.current = kontekst ?? ""
  }, [kontekst])
  const [kameraStream, setKameraStream] = useState<MediaStream | null>(null)
  const [kameraFeil, setKameraFeil] = useState<string | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [tilgjengeligeKameraer, setTilgjengeligeKameraer] = useState<MediaDeviceInfo[]>([])
  const [valgtKameraId, setValgtKameraId] = useState<string>("")

  // Callback-ref: kobler stream til video-elementet når det monteres i DOM
  const videoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    setVideoEl(node)
  }, [])

  // Koble stream til video-elementet (kjører når enten stream eller videoEl endres)
  useEffect(() => {
    if (videoEl && kameraStream) {
      // Å sette srcObject på et DOM-element er nettopp det effekter er til for;
      // regelen tror feilaktig at videoEl er React-tilstand som ikke skal endres.
      // eslint-disable-next-line react-hooks/immutability
      videoEl.srcObject = kameraStream
    }
  }, [videoEl, kameraStream])

  // Rydd opp stream hvis komponenten unmountes mens kameraet er åpent
  useEffect(() => {
    return () => {
      kameraStream?.getTracks().forEach((t) => t.stop())
    }
  }, [kameraStream])

  function setExpanded(id: string, expanded: boolean) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (expanded) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleExpand(id: string) {
    setExpanded(id, !expandedIds.has(id))
  }

  async function leggTilFiler(filer: FileList) {
    const nye: Vedlegg[] = []
    const meldinger: Filmelding[] = []
    let nyKontekst: string | null = null
    const feil = (navn: string, tekst: string) => meldinger.push({ id: cuid(), type: "feil", navn, tekst })

    for (const fil of Array.from(filer)) {
      if (!GODKJENTE_TYPER.includes(fil.type as GodkjentMimeType)) {
        feil(fil.name, "Filtypen støttes ikke (bilde eller PDF).")
        continue
      }
      const forStor = fil.size > MAKS_STORRELSE_MB * 1024 * 1024
      const full = vedlegg.length + nye.length >= MAKS_ANTALL
      let skannet = false

      // PDF med tekstlag → tekst i konteksten
      if (onKontekst && fil.type === "application/pdf") {
        if (fil.size > MAKS_TEKST_PDF_MB * 1024 * 1024) {
          feil(fil.name, `Filen er for stor (maks ${MAKS_TEKST_PDF_MB} MB).`)
          continue
        }
        setLeser(fil.name)
        try {
          const { lesPdfTekst } = await import("@/lib/pdf-tekst")
          const lest = await lesPdfTekst(await fil.arrayBuffer())
          if (lest.harTekstlag) {
            const blokk = `--- ${fil.name} (${lest.sider} ${lest.sider === 1 ? "side" : "sider"}) ---\n${lest.tekst}\n--- slutt ${fil.name} ---`
            const fra: string = nyKontekst ?? kontekstRef.current
            nyKontekst = fra.trim() ? `${fra.replace(/\s+$/, "")}\n\n${blokk}` : blokk
            const tegn = lest.tekst.length.toLocaleString("nb-NO")
            meldinger.push({
              id: cuid(),
              type: "tekst",
              navn: fil.name,
              tekst:
                `Lest som tekst (${lest.sider} ${lest.sider === 1 ? "side" : "sider"}, ${tegn} tegn) og lagt i konteksten.` +
                (lest.tekst.length > LANG_TEKST_TEGN ? " Teksten er svært lang – stryk det som ikke er relevant." : ""),
              blokk,
              base64: forStor ? undefined : await lesFil(fil),
            })
            continue
          }
          skannet = true
        } catch {
          // Passordbeskyttet eller skadet: prøv å sende filen som den er
        } finally {
          setLeser(null)
        }
      }

      if (forStor) {
        feil(
          fil.name,
          skannet
            ? `Skannet dokument uten lesbar tekst, og for stort til å sendes som fil (maks ${MAKS_STORRELSE_MB} MB).`
            : `Filen er for stor (maks ${MAKS_STORRELSE_MB} MB).`,
        )
        continue
      }
      if (full) {
        feil(fil.name, `Maks ${MAKS_ANTALL} vedlegg.`)
        continue
      }
      const base64 = await lesFil(fil)
      nye.push({ id: cuid(), navn: fil.name, mimeType: fil.type as GodkjentMimeType, base64, oppgave: modus === "ocr" ? "ocr" : "kontekst", ...(modus === "ocr" ? { ocrBruk: "kontekst" as VedleggOcrBruk } : {}) })
      if (skannet) {
        meldinger.push({ id: cuid(), type: "skannet", navn: fil.name, tekst: "Skannet dokument uten lesbar tekst – sendes som PDF." })
      }
    }
    if (nyKontekst !== null) onKontekst?.(nyKontekst)
    if (meldinger.length > 0) setFilmeldinger((f) => [...f, ...meldinger])
    if (nye.length > 0) {
      onChange([...vedlegg, ...nye])
      setExpandedIds((prev) => new Set([...prev, ...nye.map((v) => v.id)]))
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  /** Legen vil heller sende filen: teksten tas ut av konteksten igjen, og PDF-en blir vedlegg. */
  function sendSomPdf(m: Filmelding) {
    if (!m.base64 || !m.blokk || vedlegg.length >= MAKS_ANTALL) return
    const na = kontekstRef.current
    if (na.includes(m.blokk)) onKontekst?.(na.replace(m.blokk, "").replace(/\n{3,}/g, "\n\n").trim())
    onChange([...vedlegg, { id: cuid(), navn: m.navn, mimeType: "application/pdf", base64: m.base64, oppgave: "kontekst" }])
    setFilmeldinger((f) => f.filter((x) => x.id !== m.id))
  }

  function lesFil(fil: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve((e.target?.result as string).split(",")[1])
      reader.onerror = reject
      reader.readAsDataURL(fil)
    })
  }

  function kameraFeilmelding(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        return "Kameraet er i bruk av et annet program eller en annen nettleserfane."
      }
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        return "Ingen kamera funnet på denne enheten."
      }
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        return "Kameratilgang ble avvist. Sjekk nettleserens tillatelser for dette nettstedet."
      }
      if (err.name === "OverconstrainedError") {
        return "Valgt kamera støtter ikke forespurt oppløsning. Prøv et annet kamera."
      }
      return `Kamerafeil (${err.name}): ${err.message}`
    }
    return "Ukjent kamerafeil. Se konsollen for detaljer."
  }

  async function hentVideoStream(deviceId?: string): Promise<MediaStream> {
    if (deviceId) {
      // Prøv exact, fall tilbake til ideal (ved driver-quirks)
      try {
        return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } })
      } catch {
        return navigator.mediaDevices.getUserMedia({ video: { deviceId: { ideal: deviceId } } })
      }
    }
    // Ingen deviceId: prøv uten constraints
    try {
      return await navigator.mediaDevices.getUserMedia({ video: {} })
    } catch (err) {
      if (err instanceof Error && err.name === "OverconstrainedError") {
        // Standard kamera feiler (IR-kamera, virtuelt kamera e.l.) — prøv alle enumerte kameraer
        const enheter = await navigator.mediaDevices.enumerateDevices()
        const kameraer = enheter.filter((e) => e.kind === "videoinput")
        for (const k of kameraer) {
          try {
            return await navigator.mediaDevices.getUserMedia({ video: { deviceId: k.deviceId } })
          } catch {
            continue
          }
        }
      }
      throw err
    }
  }

  async function åpneKamera(deviceId?: string) {
    setKameraFeil(null)
    let stream: MediaStream | null = null
    try {
      stream = await hentVideoStream(deviceId)

      const enheter = await navigator.mediaDevices.enumerateDevices()
      const kameraer = enheter.filter((e) => e.kind === "videoinput")
      setTilgjengeligeKameraer(kameraer)

      const aktivId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? ""
      setValgtKameraId(aktivId)
      setKameraStream(stream)
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop())
      console.error("Kamerafeil:", err)
      setKameraFeil(kameraFeilmelding(err))
    }
  }

  async function byttKamera(deviceId: string) {
    setValgtKameraId(deviceId)
    kameraStream?.getTracks().forEach((t) => t.stop())
    setKameraStream(null)
    try {
      const stream = await hentVideoStream(deviceId)
      setKameraStream(stream)
    } catch (err) {
      console.error("Kamerafeil ved bytte:", err)
      setKameraFeil(kameraFeilmelding(err))
    }
  }

  function lukkKamera() {
    kameraStream?.getTracks().forEach((t) => t.stop())
    setKameraStream(null)
    setKameraFeil(null)
    setTilgjengeligeKameraer([])
    setValgtKameraId("")
  }

  function fangBilde() {
    const video = videoEl
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)

    const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1]
    const tid = new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    const nytt: Vedlegg = {
      id: cuid(),
      navn: `Kamerabilde ${tid}.jpg`,
      mimeType: "image/jpeg",
      base64,
      oppgave: modus === "ocr" ? "ocr" : "kontekst",
      ...(modus === "ocr" ? { ocrBruk: "kontekst" as VedleggOcrBruk } : {}),
    }
    onChange([...vedlegg, nytt])
    setExpandedIds((prev) => new Set([...prev, nytt.id]))
    lukkKamera()
  }

  function oppdaterVedlegg(id: string, endring: Partial<Vedlegg>) {
    onChange(vedlegg.map((v) => (v.id === id ? { ...v, ...endring } : v)))
  }

  function velgOppgave(id: string, oppgave: VedleggOppgave, extra: Partial<Vedlegg> = {}) {
    oppdaterVedlegg(id, { oppgave, ...extra })
    if (oppgave !== "spirometri" && oppgave !== "egendefinert") {
      setExpanded(id, false)
    }
  }

  function fjernVedlegg(id: string) {
    onChange(vedlegg.filter((v) => v.id !== id))
    setExpanded(id, false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) leggTilFiler(e.dataTransfer.files)
  }

  const kanLeggeTilFler = synligeVedlegg.length < MAKS_ANTALL

  return (
    <div className="space-y-3">
      {/* Opplastingssone — kompakt (én rad) */}
      {kanLeggeTilFler && kompakt && (
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-lg px-3 py-2"
          >
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 flex-1 min-w-0 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="truncate">Dra og slipp, eller klikk for å velge fil</span>
            </button>
            <button
              onClick={() => åpneKamera()}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors shrink-0 border-l border-slate-200 pl-2"
            >
              <Camera className="w-4 h-4" />
              Ta bilde
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && leggTilFiler(e.target.files)}
            />
          </div>
          {kameraFeil && <p className="text-xs text-red-600 mt-1">{kameraFeil}</p>}
        </div>
      )}

      {/* Opplastingssone */}
      {kanLeggeTilFler && !kompakt && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden"
        >
          {/* Filvelger-del */}
          <div
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-5 text-center cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-5 h-5 text-slate-400" />
            <p className="text-sm text-slate-500">Dra og slipp, eller klikk for å velge</p>
            <p className="text-xs text-slate-400">
              JPG, PNG, GIF, WEBP eller PDF · maks {MAKS_STORRELSE_MB} MB · maks {MAKS_ANTALL} filer
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

          {/* Skillelinje */}
          <div className="flex items-center gap-3 px-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">eller</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Kamera-del */}
          <button
            onClick={() => åpneKamera()}
            className="w-full flex items-center justify-center gap-2 p-3.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Ta bilde med kamera
          </button>

          {kameraFeil && (
            <p className="text-xs text-red-600 px-5 pb-3">{kameraFeil}</p>
          )}
        </div>
      )}

      {leser && (
        <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Leser {leser} …
        </p>
      )}

      {filmeldinger.length > 0 && (
        <ul className="space-y-1.5">
          {filmeldinger.map((m) => (
            <li
              key={m.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                m.type === "feil"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : m.type === "skannet"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="font-medium break-all">{m.navn}:</span> {m.tekst}
                {m.type === "tekst" && m.base64 && vedlegg.length < MAKS_ANTALL && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => sendSomPdf(m)}
                      className="underline hover:text-slate-800"
                      title="For dokumenter med tabeller, bilder eller kurver som ikke kommer med i teksten"
                    >
                      Send som PDF i stedet
                    </button>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setFilmeldinger((f) => f.filter((x) => x.id !== m.id))}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="Lukk meldingen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Liste over vedlegg */}
      {synligeVedlegg.length > 0 && (
        <ul className="space-y-2">
          {synligeVedlegg.map((v) => {
            const erEkspandert = expandedIds.has(v.id)
            const FileIkon =
              v.mimeType === "application/pdf" ? (
                <FileText className="w-4 h-4 shrink-0 text-slate-400" />
              ) : (
                <ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />
              )

            return (
              <li key={v.id} className="rounded-xl border border-slate-200 bg-white">
                {(!erEkspandert || modus === "enkel") ? (
                  /* ── Kollapsert ── */
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    {FileIkon}
                    <span className="text-sm text-slate-700 truncate flex-1 min-w-0">{v.navn}</span>
                    {modus !== "enkel" && (
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                        {modus === "ocr"
                          ? VEDLEGG_OCR_BRUK_INFO[v.ocrBruk ?? "kontekst"].label
                          : VEDLEGG_OPPGAVE_INFO[v.oppgave].label + (v.oppgave === "spirometri" && v.spirometriType ? ` · ${SPIROMETRI_TYPE_INFO[v.spirometriType].label}` : "")}
                      </span>
                    )}
                    {modus !== "enkel" && (
                      <button onClick={() => toggleExpand(v.id)} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Vis detaljer">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => fjernVedlegg(v.id)} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Fjern vedlegg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  /* ── Ekspandert ── */
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {FileIkon}
                        <span className="text-sm text-slate-700 truncate">{v.navn}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleExpand(v.id)} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Skjul detaljer">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => fjernVedlegg(v.id)} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Fjern vedlegg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {modus === "ocr" ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500">Bruk i notatet</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.entries(VEDLEGG_OCR_BRUK_INFO) as [VedleggOcrBruk, { label: string; beskrivelse: string }][]).map(
                            ([bruk, info]) => (
                              <button
                                key={bruk}
                                onClick={() => { oppdaterVedlegg(v.id, { ocrBruk: bruk }); setExpanded(v.id, false) }}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                                  (v.ocrBruk ?? "kontekst") === bruk
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                }`}
                              >
                                {info.label}
                              </button>
                            )
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{VEDLEGG_OCR_BRUK_INFO[v.ocrBruk ?? "kontekst"].beskrivelse}</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500">Claude sin oppgave med dette vedlegget</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.entries(VEDLEGG_OPPGAVE_INFO) as [VedleggOppgave, { label: string; beskrivelse: string }][])
                            .filter(([oppgave]) => oppgave !== "ocr")
                            .map(([oppgave, info]) => (
                              <button
                                key={oppgave}
                                onClick={() => velgOppgave(v.id, oppgave, {
                                  spirometriType: oppgave === "spirometri" ? (v.spirometriType ?? "uten_bronkodilator") : undefined,
                                  egendefinertPrompt: oppgave === "egendefinert" ? (v.egendefinertPrompt ?? "") : undefined,
                                })}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                                  v.oppgave === oppgave
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                }`}
                              >
                                {info.label}
                              </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400">{VEDLEGG_OPPGAVE_INFO[v.oppgave].beskrivelse}</p>
                      </div>
                    )}

                    {v.oppgave === "spirometri" && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500">Type test</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.entries(SPIROMETRI_TYPE_INFO) as [SpirometriType, { label: string; beskrivelse: string }][]).map(
                            ([type, info]) => (
                              <button
                                key={type}
                                onClick={() => oppdaterVedlegg(v.id, { spirometriType: type })}
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

                    {v.oppgave === "egendefinert" && (
                      <Textarea
                        placeholder="Eks: Vurder dette utslettet, tolk denne bentetthetsmålingen..."
                        value={v.egendefinertPrompt ?? ""}
                        onChange={(e) => oppdaterVedlegg(v.id, { egendefinertPrompt: e.target.value })}
                        className="resize-none text-sm h-20 border-slate-200"
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {synligeVedlegg.length >= MAKS_ANTALL && (
        <p className="text-xs text-slate-400 text-center">Maks {MAKS_ANTALL} vedlegg nådd.</p>
      )}

      {/* Kamera-dialog */}
      <Dialog open={!!kameraStream} onOpenChange={(open) => { if (!open) lukkKamera() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ta bilde med kamera</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <video
              ref={videoRefCallback}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg bg-black"
            />
            <canvas ref={canvasRef} className="hidden" />
            {tilgjengeligeKameraer.length > 1 && (
              <select
                value={valgtKameraId}
                onChange={(e) => byttKamera(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {tilgjengeligeKameraer.map((k, i) => (
                  <option key={k.deviceId} value={k.deviceId}>
                    {k.label || `Kamera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={lukkKamera}>Avbryt</Button>
              <Button onClick={fangBilde} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Camera className="w-4 h-4" />
                Ta bilde
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
