"use client"

import { useState, useEffect, useRef } from "react"
import {
  Mic,
  Pause,
  Square,
  FileText,
  RefreshCw,
  MessageSquare,
  Copy,
  Paperclip,
  ChevronDown,
  Stethoscope,
  Phone,
  Users,
  MonitorPlay,
  AlertCircle,
  Check,
  Video,
  PersonStanding,
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
import { useTranskribering, type MoteForm } from "@/hooks/use-transkribering"
import { useClaude } from "@/hooks/use-claude"
import { TYPE_LABELS, TYPE_STAGING, type Vedlegg, type Konsultasjon } from "@/types/konsultasjon"
import { VedleggPanel } from "@/components/app/vedlegg-panel"
import { lagreKonsultasjon, hentKonsultasjon } from "@/lib/idb"

const TYPE_IKON = {
  KONSULTASJON: <Stethoscope className="w-3.5 h-3.5" />,
  TELEFONKONSULTASJON: <Phone className="w-3.5 h-3.5" />,
  DIALOGMOTE_NAV: <Users className="w-3.5 h-3.5" />,
}

const TYPE_FARGE = {
  KONSULTASJON: "bg-blue-100 text-blue-700 border-blue-200",
  TELEFONKONSULTASJON: "bg-violet-100 text-violet-700 border-violet-200",
  DIALOGMOTE_NAV: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

export function KonsultasjonView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const { mikrofoner, valgtId, valgtEtikett, velgMikrofon, beOmTillatelse } =
    useMikrofon()

  const [visTranskript, setVisTranskript] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const [moteform, setMoteform] = useState<MoteForm>("video")
  const [visVedlegg, setVisVedlegg] = useState(false)

  const transkribering = useTranskribering(
    aktiv?.type ?? "KONSULTASJON",
    valgtId,
    moteform
  )

  const { genererNotat, isGenerating, feil: claudeFeil, avbryt } = useClaude()
  // Buffer for streaming-tekst (vises i notat-feltet mens Claude genererer)
  const [streamingNotat, setStreamingNotat] = useState("")

  // Kun ID lagres — hele objektet kan bli stale om brukeren redigerer felt mens det tas opp
  const prevAktivIdRef = useRef<string | null>(null)
  const transkriberingRef = useRef(transkribering)
  transkriberingRef.current = transkribering

  // Sett automatisk på pause når bruker bytter konsultasjon midt i opptak.
  // Må ligge FØR tidlig return — hooks kan ikke kalles betinget.
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
        // Hooken inneholder alltid fullstendig transkript (inkl. pre-lastet fra DB).
        // Hent fersk versjon fra DB for øvrige felt, overskriv bare transkript + status.
        const transkriptNaa = t.transkript
        hentKonsultasjon(prevId).then(fersk => {
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
  }, [aktiv?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autolagring av transkript til IndexedDB hvert 10. sekund under aktivt opptak.
  useEffect(() => {
    if (transkribering.status !== "opptar") return
    const id = setInterval(() => {
      const t = transkriberingRef.current.transkript
      if (t) oppdater({ transkript: t })
    }, 10_000)
    return () => clearInterval(id)
  }, [transkribering.status, oppdater]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!aktiv) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
            <Stethoscope className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700">
            Ingen aktiv konsultasjon
          </h2>
          <p className="text-sm text-slate-400">
            Klikk en av knappene i sidepanelet for å starte en ny konsultasjon.
          </p>
        </div>
      </div>
    )
  }

  const erOpptar = transkribering.status === "opptar"
  const erPause = transkribering.status === "pause"
  const erAktiv = erOpptar || erPause
  const erKobler = transkribering.status === "kobler"
  // Pause fra forrige sesjon (status i DB = "pause", men hook er fersk)
  const erLagretPause = aktiv.status === "pause" && !erAktiv && !erKobler
  const harTranskript = Boolean(aktiv.transkript) || Boolean(transkribering.transkript)
  const visNotat = isGenerating ? streamingNotat : aktiv.notat
  const harNotat = Boolean(visNotat)
  const erNAV = aktiv.type === "DIALOGMOTE_NAV"

  const brukerMikrofon = !erNAV || moteform !== "video"

  async function handleStart() {
    if (mikrofoner.length === 0 && brukerMikrofon) {
      await beOmTillatelse()
    }
    await transkribering.start()
    if (aktiv) await oppdater({ status: "opptar" })
  }

  async function handleFortsettOpptak() {
    if (!aktiv) return
    if (mikrofoner.length === 0 && brukerMikrofon) {
      await beOmTillatelse()
    }
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

    // Auto-generer notat med Claude
    setStreamingNotat("")
    await genererNotat(
      oppdatert,
      (delta) => setStreamingNotat((prev) => prev + delta),
      async (fullTekst) => {
        setStreamingNotat("")
        await oppdater({ notat: fullTekst })
      }
    )
  }

  async function handleRegenerer() {
    if (!aktiv) return
    setStreamingNotat("")
    await genererNotat(
      aktiv,
      (delta) => setStreamingNotat((prev) => prev + delta),
      async (fullTekst) => {
        setStreamingNotat("")
        await oppdater({ notat: fullTekst })
      }
    )
  }

  async function handleFortsettFraPause() {
    if (!aktiv) return
    if (mikrofoner.length === 0 && brukerMikrofon) {
      await beOmTillatelse()
    }
    await transkribering.fortsetFraLagret(aktiv.transkript)
    await oppdater({ status: "opptar" })
  }

  async function handleStoppOgSendFraPause() {
    if (!aktiv?.transkript) return
    const oppdatert = { ...aktiv, status: "ferdig" as const }
    await oppdater({ status: "ferdig" })
    setStreamingNotat("")
    await genererNotat(
      oppdatert,
      (delta) => setStreamingNotat((prev) => prev + delta),
      async (fullTekst) => {
        setStreamingNotat("")
        await oppdater({ notat: fullTekst })
      }
    )
  }

  async function kopierNotat() {
    const tekst = aktiv?.notat
    if (!tekst) return
    await navigator.clipboard.writeText(tekst)
    setKopiert(true)
    setTimeout(() => setKopiert(false), 2000)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Topprad */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4">
        <Badge
          variant="outline"
          className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${TYPE_FARGE[aktiv.type]}`}
        >
          {TYPE_IKON[aktiv.type]}
          {TYPE_LABELS[aktiv.type]}
        </Badge>
        <Input
          placeholder="Pasient / Notat-ID (f.eks. Frank Hansen 210182)"
          value={aktiv.pasientId}
          onChange={(e) => oppdater({ pasientId: e.target.value })}
          className="max-w-xs text-sm border-slate-200"
          disabled={erAktiv}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Kontekst + Tilleggsinfo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Kontekst
            </label>
            <Textarea
              placeholder="Lim inn epikriser, tidligere journalnotater eller annen relevant bakgrunn..."
              value={aktiv.kontekst}
              onChange={(e) => oppdater({ kontekst: e.target.value })}
              className="resize-none text-sm h-28 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Tilleggsinfo
            </label>
            <Textarea
              placeholder="Blodprøvesvar, målinger, observasjoner eller annet..."
              value={aktiv.tilleggsinfo}
              onChange={(e) => oppdater({ tilleggsinfo: e.target.value })}
              className="resize-none text-sm h-28 border-slate-200"
            />
          </div>
        </div>

        {/* Vedlegg + Mal */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-sm"
              onClick={() => setVisVedlegg((v) => !v)}
            >
              <Paperclip className="w-4 h-4" />
              Bilder / PDF
              {(aktiv.vedlegg?.length ?? 0) > 0 && (
                <span className="ml-0.5 bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {aktiv.vedlegg!.length}
                </span>
              )}
            </Button>

            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Button variant="outline" size="sm" className="gap-2 text-sm">
                  <FileText className="w-4 h-4" />
                  {aktiv.malId ? "Bytt mal" : "Velg notatmal"}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Velg systemprompt / notatmal (kommer snart)</TooltipContent>
            </Tooltip>

            <p className="text-xs text-slate-400 italic">
              {TYPE_STAGING[aktiv.type].substring(0, 55)}…
            </p>
          </div>

          {visVedlegg && (
            <VedleggPanel
              vedlegg={aktiv.vedlegg ?? []}
              onChange={(nyeVedlegg: Vedlegg[]) => oppdater({ vedlegg: nyeVedlegg })}
            />
          )}
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
          {/* Møteform-velger for NAV-dialogmøte */}
          {erNAV && !erAktiv && (
            <div className="mb-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Møteform
              </p>
              <div className="flex gap-2">
                {(
                  [
                    { id: "video", ikon: <Video className="w-3.5 h-3.5" />, label: "Video" },
                    { id: "telefon", ikon: <Phone className="w-3.5 h-3.5" />, label: "Telefon" },
                    { id: "fysisk", ikon: <PersonStanding className="w-3.5 h-3.5" />, label: "Fysisk" },
                  ] as { id: MoteForm; ikon: React.ReactNode; label: string }[]
                ).map(({ id, ikon, label }) => (
                  <button
                    key={id}
                    onClick={() => setMoteform(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      moteform === id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {ikon}
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {moteform === "video" && (
                  <>
                    <MonitorPlay className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>
                      Velg <strong>nettleserfanen</strong> der videomøtet kjører og huk av{" "}
                      <strong>«Del lyd fra fane»</strong>. Begge stemmer fanges.
                    </span>
                  </>
                )}
                {moteform === "telefon" && (
                  <>
                    <Phone className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>
                      Mikrofon brukes. Legg telefonen nær mikrofonen eller bruk høyttaler
                      slik at alle stemmer fanges.
                    </span>
                  </>
                )}
                {moteform === "fysisk" && (
                  <>
                    <PersonStanding className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>
                      Mikrofon brukes. Plasser enheten sentralt i rommet slik at alle
                      deltakere høres tydelig.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Start opptak — ny konsultasjon */}
            {!erAktiv && !erLagretPause && aktiv.status !== "ferdig" && (
              <Button
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleStart}
                disabled={erKobler}
              >
                {erNAV && moteform === "video" ? (
                  <MonitorPlay className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                {erKobler ? "Kobler til…" : "Start opptak"}
              </Button>
            )}

            {/* Fortsett opptak — ferdig konsultasjon (legg til transkript) */}
            {!erAktiv && !erLagretPause && aktiv.status === "ferdig" && (
              <Button
                size="sm"
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                onClick={handleFortsettOpptak}
                disabled={erKobler}
              >
                <Mic className="w-4 h-4" />
                {erKobler ? "Kobler til…" : "Fortsett opptak"}
              </Button>
            )}

            {/* Pause-gjenoppretting — byttet konsultasjon midt i opptak */}
            {erLagretPause && (
              <>
                <Button
                  size="sm"
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
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

            {/* Mikrofon-velger — alle typer unntatt NAV-video */}
            {(!erNAV || moteform !== "video") && (
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
                    <DropdownMenuLabel className="text-xs">
                      Velg mikrofon
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {mikrofoner.length === 0 ? (
                      <DropdownMenuItem onClick={beOmTillatelse}>
                        <Mic className="w-4 h-4 mr-2 text-slate-400" />
                        Gi tilgang til mikrofon
                      </DropdownMenuItem>
                    ) : (
                      mikrofoner.map((m) => (
                        <DropdownMenuItem
                          key={m.deviceId}
                          onClick={() => velgMikrofon(m.deviceId)}
                        >
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
            )}

            {/* Statusindikator */}
            <div className={`flex items-center gap-2 text-xs ${!erNAV ? "" : "ml-auto"}`}>
              {erOpptar && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Opptar
                </span>
              )}
              {erPause && (
                <span className="text-amber-600 font-medium">Pauset</span>
              )}
              {erKobler && (
                <span className="text-blue-600">Kobler til…</span>
              )}
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
            <div className="mt-3 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 min-h-8 leading-relaxed">
              {transkribering.visTekst ? (
                <>
                  <span>{transkribering.transkript}</span>
                  {transkribering.partial && (
                    <span className="text-slate-400 italic">
                      {transkribering.transkript ? " " : ""}
                      {transkribering.partial}
                    </span>
                  )}
                </>
              ) : (
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
            <TooltipContent>Vis fullstendig transkript</TooltipContent>
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
              {isGenerating ? "Klikk for å avbryte" : "Regenerer notat med Claude"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                disabled={!harTranskript}
              >
                <MessageSquare className="w-4 h-4" />
                Chat / AI-hjelp
              </Button>
            </TooltipTrigger>
            <TooltipContent>Spør AI om konsultasjonen (kommer snart)</TooltipContent>
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
            {kopiert ? "Kopiert!" : "Kopier notat"}
          </Button>
        </div>

        {/* Claude-feilmelding */}
        {claudeFeil && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Claude: {claudeFeil}</span>
          </div>
        )}

        {/* Notatfelt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Generert notat
            </label>
            {isGenerating && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Claude skriver…
              </span>
            )}
          </div>
          <Textarea
            placeholder="Notat genereres automatisk etter «Stopp & Send», eller klikk «Regenerer»…"
            value={visNotat}
            onChange={(e) => !isGenerating && oppdater({ notat: e.target.value })}
            readOnly={isGenerating}
            className={`min-h-48 text-sm border-slate-200 font-mono ${isGenerating ? "bg-slate-50 text-slate-600" : ""}`}
          />
        </div>
      </div>

      {/* Transkript-modal */}
      <Dialog open={visTranskript} onOpenChange={setVisTranskript}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transkript — {aktiv.pasientId || "Uten ID"}</DialogTitle>
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
