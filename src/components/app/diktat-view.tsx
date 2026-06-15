"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  Mic,
  Pause,
  Square,
  FileText,
  RefreshCw,
  Copy,
  ChevronDown,
  AlertCircle,
  Check,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { useMikrofon } from "@/hooks/use-mikrofon"
import { useTranskribering } from "@/hooks/use-transkribering"
import { useClaude } from "@/hooks/use-claude"
import { TYPE_TEMA } from "@/lib/tema"
import { lagreKonsultasjon, hentKonsultasjon } from "@/lib/idb"

function parseStikkord(fullTekst: string): { notat: string; stikkord?: string[] } {
  const match = fullTekst.match(/\nSTIKKORD:\s*(.+?)[\n\r]*$/)
  if (!match) return { notat: fullTekst }
  return {
    notat: fullTekst.slice(0, match.index).trim(),
    stikkord: match[1].split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3),
  }
}

export function DiktatView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const { mikrofoner, valgtId, valgtEtikett, velgMikrofon, beOmTillatelse } =
    useMikrofon()

  const [visTranskript, setVisTranskript] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const [visning, setVisning] = useState<"bearbeidet" | "original">("bearbeidet")
  const [maler, setMaler] = useState<{ id: string; tittel: string; beskrivelse: string | null; innhold: string }[]>([])

  // Diktat bruker alltid mikrofon ("fysisk" => brukerMikrofon)
  const transkribering = useTranskribering(aktiv?.type ?? "DIKTAT", valgtId, "fysisk")
  const { genererNotat, isGenerating, feil: claudeFeil, avbryt } = useClaude()
  const [streamingNotat, setStreamingNotat] = useState("")
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Last DIKTAT-maler
  const lastMaler = useCallback(async (currentMalId: string | null) => {
    try {
      const res = await fetch(`/api/maler?kategori=DIKTAT`)
      if (!res.ok) return
      const data: { id: string; tittel: string; beskrivelse: string | null; innhold: string }[] = await res.json()
      setMaler(data)
      if (currentMalId === null) {
        const raw = localStorage.getItem(`legeassist_siste_mal_DIKTAT`)
        if (raw) {
          const prefs = JSON.parse(raw) as { malId: string | null }
          if (prefs.malId) {
            const lagretMal = data.find((m) => m.id === prefs.malId)
            if (lagretMal) oppdater({ malId: lagretMal.id, malInnhold: lagretMal.innhold })
          }
        }
      }
    } catch { /* stille */ }
  }, [oppdater])

  useEffect(() => {
    if (aktiv?.id) lastMaler(aktiv?.malId ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv?.id])

  const handleStreamDelta = useCallback((delta: string) => {
    setStreamingNotat((prev) => {
      const combined = prev + delta
      const idx = combined.indexOf("\nSTIKKORD:")
      return idx !== -1 ? combined.slice(0, idx) : combined
    })
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  const handleStreamFerdig = useCallback(async (fullTekst: string) => {
    const { notat, stikkord } = parseStikkord(fullTekst)
    setStreamingNotat("")
    await oppdater({ notat, ...(stikkord ? { stikkord } : {}) })
  }, [oppdater])

  const livTranskriptRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (livTranskriptRef.current) {
      livTranskriptRef.current.scrollLeft = livTranskriptRef.current.scrollWidth
    }
  }, [transkribering.transkript, transkribering.partial])

  // Auto-pause + lagring når bruker bytter diktat midt i opptak
  const prevAktivIdRef = useRef<string | null>(null)
  const transkriberingRef = useRef(transkribering)
  transkriberingRef.current = transkribering

  useEffect(() => {
    const prevId = prevAktivIdRef.current
    const currId = aktiv?.id ?? null

    if (prevId !== null && prevId !== currId) {
      const t = transkriberingRef.current
      const wasActive =
        t.status === "opptar" || t.status === "kobler" || t.status === "pause"

      if (wasActive) {
        if (t.status === "opptar" || t.status === "kobler") {
          t.pause()
        }
        const transkriptNaa = t.transkript
        hentKonsultasjon(prevId).then((fersk) => {
          if (!fersk) return
          return lagreKonsultasjon({
            ...fersk,
            transkript: transkriptNaa || fersk.transkript,
            status: "pause",
          })
        }).then(() => {
          window.dispatchEvent(new Event("legeassist:refresh-liste"))
        })
      }

      t.nullstill()
    }

    prevAktivIdRef.current = aktiv?.id ?? null
  }, [aktiv?.id])

  // Autolagring av transkript hvert 10. sekund under aktivt opptak
  useEffect(() => {
    if (transkribering.status !== "opptar") return
    const id = setInterval(() => {
      const t = transkriberingRef.current.transkript
      if (t) oppdater({ transkript: t })
    }, 10_000)
    return () => clearInterval(id)
  }, [transkribering.status, oppdater])

  if (!aktiv) return null

  const erOpptar = transkribering.status === "opptar"
  const erPause = transkribering.status === "pause"
  const erAktiv = erOpptar || erPause
  const erKobler = transkribering.status === "kobler"
  const erLagretPause = aktiv.status === "pause" && !erAktiv && !erKobler
  const harTranskript = Boolean(aktiv.transkript) || Boolean(transkribering.transkript)
  const visNotat = isGenerating ? streamingNotat : aktiv.notat
  const harNotat = Boolean(visNotat)
  // Under streaming tvinges «bearbeidet»-visning slik at teksten vises live
  const visningAktiv = isGenerating ? "bearbeidet" : visning
  const tema = TYPE_TEMA[aktiv.type]
  const aktivMal = aktiv.malId ? (maler.find((m) => m.id === aktiv.malId) ?? null) : null

  function velgMal(mal: { id: string; innhold: string } | null) {
    if (mal) {
      oppdater({ malId: mal.id, malInnhold: mal.innhold })
      localStorage.setItem(`legeassist_siste_mal_DIKTAT`, JSON.stringify({ malId: mal.id }))
    } else {
      oppdater({ malId: null, malInnhold: null })
      localStorage.setItem(`legeassist_siste_mal_DIKTAT`, JSON.stringify({ malId: null }))
    }
  }

  async function handleStart() {
    if (mikrofoner.length === 0) await beOmTillatelse()
    await transkribering.start()
    await oppdater({ status: "opptar" })
  }

  async function handleFortsettOpptak() {
    if (!aktiv) return
    if (mikrofoner.length === 0) await beOmTillatelse()
    await transkribering.fortsetFraLagret(aktiv.transkript)
    await oppdater({ status: "opptar" })
  }

  async function handlePause() {
    const transkriptNaa = transkribering.transkript
    transkribering.pause()
    await oppdater({ transkript: transkriptNaa, status: "pause" })
  }

  async function handleFortsettInSession() {
    await transkribering.fortsett()
    await oppdater({ status: "opptar" })
  }

  async function handleStopp() {
    const nyTranskript = await transkribering.stopp()
    if (!aktiv) return
    const oppdatert = { ...aktiv, transkript: nyTranskript, status: "ferdig" as const }
    await oppdater({ transkript: nyTranskript, status: "ferdig" })
    setStreamingNotat("")
    await genererNotat(oppdatert, undefined, handleStreamDelta, handleStreamFerdig)
  }

  async function handleFortsettFraPause() {
    if (!aktiv) return
    if (mikrofoner.length === 0) await beOmTillatelse()
    await transkribering.fortsetFraLagret(aktiv.transkript)
    await oppdater({ status: "opptar" })
  }

  async function handleStoppOgSendFraPause() {
    if (!aktiv?.transkript) return
    const oppdatert = { ...aktiv, status: "ferdig" as const }
    await oppdater({ status: "ferdig" })
    setStreamingNotat("")
    await genererNotat(oppdatert, undefined, handleStreamDelta, handleStreamFerdig)
  }

  async function handleRegenerer() {
    if (!aktiv) return
    setStreamingNotat("")
    await genererNotat(aktiv, undefined, handleStreamDelta, handleStreamFerdig)
  }

  async function kopierNotat() {
    const tekst = aktiv?.notat
    if (!tekst) return
    await navigator.clipboard.writeText(tekst)
    setKopiert(true)
    setTimeout(() => setKopiert(false), 2000)
  }

  async function handleTom() {
    if (!aktiv) return
    if (!confirm("Tøm diktatet og start på nytt? Transkript og resultat slettes.")) return
    if (isGenerating) avbryt()
    transkribering.nullstill()
    setStreamingNotat("")
    setVisning("bearbeidet")
    await oppdater({ transkript: "", notat: "", stikkord: [], status: "ny" })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Topprad */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4">
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-xs font-medium shrink-0 bg-amber-100 text-amber-700 border-amber-200"
        >
          <Mic className="w-3.5 h-3.5" />
          Diktat
        </Badge>
        <Input
          placeholder="Pasient / Notat-ID (f.eks. Frank Hansen 210182)"
          value={aktiv.pasientId}
          onChange={(e) => oppdater({ pasientId: e.target.value })}
          className="max-w-xs text-sm border-slate-200"
          disabled={erAktiv}
        />
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Mal-valg */}
        <div className="flex items-center gap-3 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground h-9">
              <FileText className="w-4 h-4" />
              {aktivMal ? aktivMal.tittel : "Velg mal"}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs">Diktatmal</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => velgMal(null)}>
                  <span className={!aktiv.malId ? `font-medium ${tema.tekst}` : ""}>
                    Kun språkvask
                  </span>
                </DropdownMenuItem>
                {maler.length > 0 && <DropdownMenuSeparator />}
                {maler.map((mal) => (
                  <DropdownMenuItem key={mal.id} onClick={() => velgMal(mal)}>
                    <span className={`truncate ${aktiv.malId === mal.id ? `font-medium ${tema.tekst}` : ""}`}>
                      {mal.tittel}
                    </span>
                  </DropdownMenuItem>
                ))}
                {maler.length === 0 && (
                  <DropdownMenuItem disabled>
                    <span className="text-slate-400 text-xs">Ingen maler — opprett i Innstillinger</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/innstillinger?tab=prompts" className="text-xs text-blue-600 w-full">
                    Administrer maler →
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <p className="text-xs text-slate-400 italic">
            {aktivMal
              ? (aktivMal.beskrivelse ?? aktivMal.innhold).substring(0, 60) + "…"
              : "Renser opp diktatet til korrekt, lesbar tekst."}
          </p>
        </div>

        {/* ─── Opptakskontroller ─── */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            erOpptar
              ? "border-red-200 bg-red-50"
              : erPause
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Start opptak — nytt diktat */}
            {!erAktiv && !erLagretPause && aktiv.status !== "ferdig" && (
              <Button
                size="sm"
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleStart}
                disabled={erKobler}
              >
                <Mic className="w-4 h-4" />
                {erKobler ? "Kobler til…" : "Start diktat"}
              </Button>
            )}

            {/* Fortsett opptak — ferdig diktat (legg til) */}
            {!erAktiv && !erLagretPause && aktiv.status === "ferdig" && (
              <Button
                size="sm"
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={handleFortsettOpptak}
                disabled={erKobler}
              >
                <Mic className="w-4 h-4" />
                {erKobler ? "Kobler til…" : "Fortsett diktat"}
              </Button>
            )}

            {/* Pause-gjenoppretting — byttet diktat midt i opptak */}
            {erLagretPause && (
              <>
                <Button
                  size="sm"
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleFortsettFraPause}
                >
                  <Mic className="w-4 h-4" />
                  Fortsett
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={handleStoppOgSendFraPause}
                >
                  <Square className="w-4 h-4" />
                  Stopp og send
                </Button>
              </>
            )}

            {erOpptar && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={handlePause}
              >
                <Pause className="w-4 h-4" />
                Pause
              </Button>
            )}

            {erPause && (
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 ${tema.utlinje}`}
                onClick={handleFortsettInSession}
              >
                <Mic className="w-4 h-4" />
                Fortsett
              </Button>
            )}

            {erAktiv && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleStopp}
              >
                <Square className="w-4 h-4" />
                Stopp & Send
              </Button>
            )}

            {/* Mikrofon-velger */}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={erAktiv}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="max-w-[130px] truncate">{valgtEtikett}</span>
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs">Velg mikrofon</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {mikrofoner.length === 0 ? (
                    <DropdownMenuItem onClick={beOmTillatelse}>
                      <Mic className="w-4 h-4 mr-2 text-slate-400" />
                      Gi tilgang til mikrofon
                    </DropdownMenuItem>
                  ) : (
                    mikrofoner.map((m) => (
                      <DropdownMenuItem key={m.deviceId} onClick={() => velgMikrofon(m.deviceId)}>
                        {valgtId === m.deviceId ? (
                          <Check className="w-3.5 h-3.5 mr-2 text-blue-600 shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 mr-2 shrink-0" />
                        )}
                        <span className="truncate text-xs">{m.label}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Statusindikator */}
            <div className="flex items-center gap-2 text-xs">
              {erOpptar && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Tar opp
                </span>
              )}
              {erPause && <span className="text-amber-600 font-medium">Pauset</span>}
              {erKobler && <span className="text-blue-600">Kobler til…</span>}
            </div>
          </div>

          {/* Feilmelding */}
          {transkribering.feil && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{transkribering.feil}</span>
            </div>
          )}

          {/* Live transkript-forhåndsvisning */}
          {(erAktiv || erKobler) && (
            <div ref={livTranskriptRef} className="mt-3 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 h-8 flex items-center overflow-x-hidden">
              {transkribering.visTekst ? (() => {
                const sisteLinje = transkribering.transkript
                  .split("\n")
                  .filter((l: string) => l.trim())
                  .at(-1) ?? ""
                return (
                  <span className="whitespace-nowrap">
                    {sisteLinje}
                    {transkribering.partial && (
                      <span className="text-slate-400 italic">
                        {sisteLinje ? " " : ""}
                        {transkribering.partial}
                      </span>
                    )}
                  </span>
                )
              })() : (
                <span className="text-slate-300 italic">
                  {erKobler ? "Kobler til…" : "Venter på tale…"}
                </span>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Handlingsknapper */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                disabled={!harTranskript}
                onClick={() => setVisTranskript(true)}
              >
                <FileText className="w-4 h-4" />
                Transkript
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vis fullstendig diktat-transkript</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                disabled={!harTranskript || isGenerating}
                onClick={handleRegenerer}
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Genererer…" : "Regenerer"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isGenerating ? "Klikk for å avbryte" : "Generer på nytt med Claude"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm text-slate-500 hover:text-red-600"
                disabled={erOpptar || isGenerating || (!harTranskript && !harNotat)}
                onClick={handleTom}
              >
                <RotateCcw className="w-4 h-4" />
                Tøm
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tøm diktatet og start på nytt</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {isGenerating && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-sm border-red-200 text-red-600 hover:bg-red-50"
              onClick={avbryt}
            >
              Avbryt
            </Button>
          )}

          <Button
            size="sm"
            className="gap-1.5 text-sm bg-slate-800 hover:bg-slate-900"
            disabled={!harNotat || isGenerating}
            onClick={kopierNotat}
          >
            <Copy className="w-4 h-4" />
            {kopiert ? "Kopiert!" : "Kopier"}
          </Button>
        </div>

        {/* Claude-feilmelding */}
        {claudeFeil && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Claude: {claudeFeil}</span>
          </div>
        )}

        {/* Resultatfelt — bytt mellom bearbeidet og originalt diktat */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {([
                { id: "bearbeidet", label: "Bearbeidet" },
                { id: "original", label: "Original" },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setVisning(id)}
                  disabled={isGenerating}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
                    visningAktiv === id
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isGenerating && (
              <span className={`flex items-center gap-1.5 text-xs ${tema.tekst}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Claude skriver…
              </span>
            )}
          </div>
          {visningAktiv === "original" ? (
            <Textarea
              placeholder="Ingen diktat ennå — klikk «Start diktat»…"
              value={aktiv.transkript}
              readOnly
              className="min-h-64 text-sm border-slate-200 font-mono bg-slate-50 text-slate-600"
            />
          ) : (
            <Textarea
              placeholder="Teksten genereres automatisk etter «Stopp & Send», eller klikk «Regenerer»…"
              value={visNotat}
              onChange={(e) => !isGenerating && oppdater({ notat: e.target.value })}
              readOnly={isGenerating}
              className={`min-h-64 text-sm border-slate-200 ${isGenerating ? "bg-slate-50 text-slate-600" : ""}`}
            />
          )}
        </div>
      </div>

      {/* Transkript-modal */}
      <Dialog open={visTranskript} onOpenChange={setVisTranskript}>
        <DialogContent className="!w-[80vw] !max-w-[1200px]">
          <DialogHeader>
            <DialogTitle>Diktat — {aktiv.pasientId || "Uten ID"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={aktiv.transkript}
            readOnly
            className="min-h-64 text-sm font-mono resize-none"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
