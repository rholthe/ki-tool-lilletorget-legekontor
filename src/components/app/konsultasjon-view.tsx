"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
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
  Maximize2,
  ScanText,
  BookOpen,
  Sparkles,
  ClipboardList,
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
import { useHurtigtaster } from "@/hooks/use-hurtigtaster"
import { TYPE_STAGING, konsultasjonEtikett, type Vedlegg, type KonsultasjonsForm } from "@/types/konsultasjon"
import { TYPE_TEMA } from "@/lib/tema"
import { VedleggPanel } from "@/components/app/vedlegg-panel"
import { ChatModal } from "@/components/app/chat-modal"
import { VerktoyModal } from "@/components/app/verktoy-modal"
import { TilSkjema } from "@/components/app/til-skjema"
import { synkVerktoySeksjon } from "@/lib/verktoy/beregn"
import { lagreKonsultasjon, hentKonsultasjon } from "@/lib/idb"
import { SendTilJournal } from "@/components/app/send-til-journal"

function parseStikkord(fullTekst: string): { notat: string; stikkord?: string[] } {
  const match = fullTekst.match(/\nSTIKKORD:\s*(.+?)[\n\r]*$/)
  if (!match) return { notat: fullTekst }
  return {
    notat: fullTekst.slice(0, match.index).trim(),
    stikkord: match[1].split(",").map(s => s.trim()).filter(Boolean).slice(0, 3),
  }
}

const TYPE_IKON = {
  KONSULTASJON: <Stethoscope className="w-3.5 h-3.5" />,
  TELEFONKONSULTASJON: <Phone className="w-3.5 h-3.5" />,
  MOTE: <Users className="w-3.5 h-3.5" />,
  JOURNALGJENNOMGANG: <BookOpen className="w-3.5 h-3.5" />,
  DIKTAT: <Mic className="w-3.5 h-3.5" />,
  AIHJELP: <Sparkles className="w-3.5 h-3.5" />,
  SKJEMA: <FileText className="w-3.5 h-3.5" />,
}

export function KonsultasjonView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const { mikrofoner, valgtId, valgtEtikett, velgMikrofon, beOmTillatelse } =
    useMikrofon()

  const [visTranskript, setVisTranskript] = useState(false)
  const [visChat, setVisChat] = useState(false)
  const [visVerktoy, setVisVerktoy] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const [utvidetFelt, setUtvidetFelt] = useState<"kontekst" | "tilleggsinfo" | null>(null)
  const [moteform, setMoteform] = useState<MoteForm>("fysisk")
  const [visVedlegg, setVisVedlegg] = useState(false)
  const [visOcr, setVisOcr] = useState(false)
  const [maler, setMaler] = useState<{ id: string; tittel: string; beskrivelse: string | null; innhold: string }[]>([])

  // Init moteform ved nytt konsultasjonsvalg: bruk lagret form hvis den finnes,
  // ellers standard (Møte starter på video, alt annet på fysisk).
  useEffect(() => {
    if (!aktiv) return
    setMoteform(aktiv.form ?? (aktiv.type === "MOTE" ? "video" : "fysisk"))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv?.id])

  // Last maler for aktiv konsultasjonstype
  const lastMaler = useCallback(async (type: string, currentMalId: string | null) => {
    const kat = type === "KONSULTASJON" ? "KONSULTASJON" : type === "MOTE" ? "MOTE" : null
    if (!kat) { setMaler([]); return }
    try {
      const res = await fetch(`/api/maler?kategori=${kat}`)
      if (!res.ok) return
      const data: { id: string; tittel: string; beskrivelse: string | null; innhold: string }[] = await res.json()
      setMaler(data)
      if (currentMalId === null) {
        const raw = localStorage.getItem(`legeassist_siste_mal_${type}`)
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
    if (aktiv?.type) lastMaler(aktiv.type, aktiv?.malId ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv?.id])

  const transkribering = useTranskribering(
    aktiv?.type ?? "KONSULTASJON",
    valgtId,
    moteform
  )

  const { genererNotat, isGenerating, feil: claudeFeil, avbryt } = useClaude()
  const [streamingNotat, setStreamingNotat] = useState("")
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
    // Verktøyseksjonen bygges av appen, ikke av Claude — legges inn igjen etter
    // hver generering slik at utførte verktøy overlever «Regenerer».
    await oppdater({
      notat: synkVerktoySeksjon(notat, aktiv?.verktoyResultater ?? []),
      ...(stikkord ? { stikkord } : {}),
    })
  }, [oppdater, aktiv?.verktoyResultater])

  const livTranskriptRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (livTranskriptRef.current) {
      livTranskriptRef.current.scrollLeft = livTranskriptRef.current.scrollWidth
    }
  }, [transkribering.transkript, transkribering.partial])

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
  }, [aktiv?.id])

  // Autolagring av transkript til IndexedDB hvert 10. sekund under aktivt opptak.
  useEffect(() => {
    if (transkribering.status !== "opptar") return
    const id = setInterval(() => {
      const t = transkriberingRef.current.transkript
      if (t) oppdater({ transkript: t })
    }, 10_000)
    return () => clearInterval(id)
  }, [transkribering.status, oppdater])

  // Hurtigtaster: Alt+R veksler opptak (kontekstavhengig), Alt+S stopper & sender
  function hurtigtastOpptak() {
    if (!aktiv) return
    const s = transkribering.status
    if (s === "kobler") return
    if (s === "opptar") return void handlePause()
    if (s === "pause") return void handleFortsettInSession()
    if (aktiv.status === "pause") return void handleFortsettFraPause()
    if (aktiv.status === "ferdig") return void handleFortsettOpptak()
    return void handleStart()
  }
  function hurtigtastStopp() {
    if (!aktiv) return
    const s = transkribering.status
    if (s === "opptar" || s === "pause") return void handleStopp()
    if (aktiv.status === "pause") return void handleStoppOgSendFraPause()
  }
  useHurtigtaster([
    { code: "KeyR", handler: hurtigtastOpptak },
    { code: "KeyS", handler: hurtigtastStopp },
    { code: "KeyV", handler: () => setVisVerktoy((v) => !v) },
  ])

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
  const erMote = aktiv.type === "MOTE"
  const erKonsultasjon = aktiv.type === "KONSULTASJON"
  const tema = TYPE_TEMA[aktiv.type]
  const aktivMal = aktiv.malId ? (maler.find((m) => m.id === aktiv.malId) ?? null) : null

  function velgMal(mal: { id: string; innhold: string } | null) {
    if (!aktiv) return
    if (mal) {
      oppdater({ malId: mal.id, malInnhold: mal.innhold })
      localStorage.setItem(`legeassist_siste_mal_${aktiv.type}`, JSON.stringify({ malId: mal.id }))
    } else {
      oppdater({ malId: null, malInnhold: null })
      localStorage.setItem(`legeassist_siste_mal_${aktiv.type}`, JSON.stringify({ malId: null }))
    }
  }

  const brukerMikrofon = moteform !== "video"

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
    await genererNotat(oppdatert, moteform as KonsultasjonsForm, handleStreamDelta, handleStreamFerdig)
  }

  async function handleRegenerer() {
    if (!aktiv) return
    setStreamingNotat("")
    await genererNotat(aktiv, moteform as KonsultasjonsForm, handleStreamDelta, handleStreamFerdig)
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
    await genererNotat(oppdatert, moteform as KonsultasjonsForm, handleStreamDelta, handleStreamFerdig)
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
          className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${tema.badge}`}
        >
          {aktiv.type === "KONSULTASJON" && aktiv.form === "telefon"
            ? <Phone className="w-3.5 h-3.5" />
            : aktiv.type === "KONSULTASJON" && aktiv.form === "video"
              ? <Video className="w-3.5 h-3.5" />
              : TYPE_IKON[aktiv.type]}
          {konsultasjonEtikett(aktiv)}
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
        {/* Kontekst + Tilleggsinfo */}
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              {
                id: "kontekst" as const,
                label: "Kontekst",
                placeholder: "Lim inn epikriser, tidligere journalnotater eller annen relevant bakgrunn...",
                value: aktiv.kontekst,
                onChange: (v: string) => oppdater({ kontekst: v }),
              },
              {
                id: "tilleggsinfo" as const,
                label: "Tilleggsinfo",
                placeholder: "Blodprøvesvar, målinger, observasjoner eller annet...",
                value: aktiv.tilleggsinfo,
                onChange: (v: string) => oppdater({ tilleggsinfo: v }),
              },
            ] as const
          ).map(({ id, label, placeholder, value, onChange }) => (
            <div key={id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {label}
                </label>
                <button
                  onClick={() => setUtvidetFelt(id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={`Utvid ${label}`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <Textarea
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="resize-none text-sm h-28 border-slate-200"
              />
            </div>
          ))}
        </div>

        {/* Utvidet teksteditor-dialog */}
        <Dialog open={utvidetFelt !== null} onOpenChange={(open) => { if (!open) setUtvidetFelt(null) }}>
          <DialogContent className="!w-[90vw] !max-w-[1400px] h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {utvidetFelt === "kontekst" ? "Kontekst" : "Tilleggsinfo"}
              </DialogTitle>
            </DialogHeader>
            <Textarea
              autoFocus
              placeholder={
                utvidetFelt === "kontekst"
                  ? "Lim inn epikriser, tidligere journalnotater eller annen relevant bakgrunn..."
                  : "Blodprøvesvar, målinger, observasjoner eller annet..."
              }
              value={utvidetFelt === "kontekst" ? aktiv.kontekst : aktiv.tilleggsinfo}
              onChange={(e) => {
                if (utvidetFelt === "kontekst") oppdater({ kontekst: e.target.value })
                else oppdater({ tilleggsinfo: e.target.value })
              }}
              className="flex-1 resize-none text-sm border-slate-200 min-h-0"
            />
          </DialogContent>
        </Dialog>

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
              {(aktiv.vedlegg?.filter((v) => v.oppgave !== "ocr").length ?? 0) > 0 && (
                <span className="ml-0.5 bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {aktiv.vedlegg!.filter((v) => v.oppgave !== "ocr").length}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-sm"
              onClick={() => setVisOcr((v) => !v)}
            >
              <ScanText className="w-4 h-4" />
              Les tekst
              {(aktiv.vedlegg?.filter((v) => v.oppgave === "ocr").length ?? 0) > 0 && (
                <span className="ml-0.5 bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {aktiv.vedlegg!.filter((v) => v.oppgave === "ocr").length}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground h-9">
                <FileText className="w-4 h-4" />
                {aktivMal ? aktivMal.tittel : "Velg notatmal"}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs">Notatmal</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => velgMal(null)}>
                    <span className={!aktiv.malId ? "font-medium text-blue-600" : ""}>
                      Ingen tilleggsmal
                    </span>
                  </DropdownMenuItem>
                  {maler.length > 0 && <DropdownMenuSeparator />}
                  {maler.map((mal) => (
                    <DropdownMenuItem
                      key={mal.id}
                      onClick={() => velgMal(mal)}
                    >
                      <span className={`truncate ${aktiv.malId === mal.id ? "font-medium text-blue-600" : ""}`}>
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
                : TYPE_STAGING[aktiv.type].substring(0, 55) + "…"
              }
            </p>
          </div>

          {visVedlegg && (
            <VedleggPanel
              vedlegg={aktiv.vedlegg ?? []}
              onChange={(nyeVedlegg: Vedlegg[]) => oppdater({ vedlegg: nyeVedlegg })}
            />
          )}

          {visOcr && (
            <VedleggPanel
              modus="ocr"
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
          {/* Form-velger for konsultasjon og møte */}
          {(erMote || erKonsultasjon) && !erAktiv && (
            <div className="mb-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {erMote ? "Møteform" : "Konsultasjonsform"}
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
                    onClick={() => { setMoteform(id); oppdater({ form: id }) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      moteform === id
                        ? erMote
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-blue-500 bg-blue-50 text-blue-700"
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
                    <MonitorPlay className={`w-4 h-4 shrink-0 mt-0.5 ${erMote ? "text-emerald-600" : "text-blue-600"}`} />
                    <span>
                      Velg <strong>nettleserfanen</strong> der videomøtet kjører og huk av{" "}
                      <strong>«Del lyd fra fane»</strong>. Begge stemmer fanges.
                    </span>
                  </>
                )}
                {moteform === "telefon" && (
                  <>
                    <Phone className={`w-4 h-4 shrink-0 mt-0.5 ${erMote ? "text-emerald-600" : "text-blue-600"}`} />
                    <span>
                      Mikrofon brukes. Legg telefonen nær mikrofonen eller bruk høyttaler
                      slik at alle stemmer fanges.
                    </span>
                  </>
                )}
                {moteform === "fysisk" && (
                  <>
                    <PersonStanding className={`w-4 h-4 shrink-0 mt-0.5 ${erMote ? "text-emerald-600" : "text-blue-600"}`} />
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
                className={`gap-2 ${tema.knapp}`}
                onClick={handleStart}
                disabled={erKobler}
                title="Hurtigtast: Alt+R"
              >
                {moteform === "video" ? (
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
                className={`gap-2 ${tema.knapp}`}
                onClick={handleFortsettOpptak}
                disabled={erKobler}
                title="Hurtigtast: Alt+R"
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
                  className={`gap-2 ${tema.knapp}`}
                  onClick={handleFortsettFraPause}
                  title="Hurtigtast: Alt+R"
                >
                  <Mic className="w-4 h-4" />
                  Fortsett
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={handleStoppOgSendFraPause}
                  title="Hurtigtast: Alt+S"
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
                title="Hurtigtast: Alt+R"
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
                title="Hurtigtast: Alt+R"
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
                title="Hurtigtast: Alt+S"
              >
                <Square className="w-4 h-4" />
                Stopp & Send
              </Button>
            )}

            {/* Mikrofon-velger — alle typer unntatt møte-video */}
            {(!erMote || moteform !== "video") && (
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
            <div className={`flex items-center gap-2 text-xs ${!erMote ? "" : "ml-auto"}`}>
              {erOpptar && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Tar opp
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
            <div ref={livTranskriptRef} className="mt-3 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 h-8 flex items-center overflow-x-hidden">
              {transkribering.visTekst ? (() => {
                const sisteLinje = transkribering.transkript
                  .split('\n')
                  .filter((l: string) => l.trim())
                  .at(-1) ?? ''
                return (
                  <span className="whitespace-nowrap">
                    {sisteLinje}
                    {transkribering.partial && (
                      <span className="text-slate-400 italic">
                        {sisteLinje ? ' ' : ''}
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
                onClick={() => setVisChat(true)}
              >
                <MessageSquare className="w-4 h-4" />
                Chat / AI-hjelp
              </Button>
            </TooltipTrigger>
            <TooltipContent>Spør AI om konsultasjonen</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-sm"
                onClick={() => setVisVerktoy(true)}
                title="Kliniske verktøy (Alt+V)"
              >
                <ClipboardList className="w-4 h-4" />
                Kliniske verktøy
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Skåringsverktøy, undersøkelser og retningslinjer (Alt+V)
            </TooltipContent>
          </Tooltip>

          {(aktiv.type === "KONSULTASJON" || aktiv.type === "TELEFONKONSULTASJON") && <TilSkjema
            disabled={isGenerating || erOpptar || erPause || !(harNotat || aktiv.transkript.trim() || aktiv.kontekst.trim())}
            grunn={
              isGenerating
                ? "Vent til notatet er ferdig"
                : erOpptar || erPause
                  ? "Stopp opptaket først"
                  : "Ingenting å fylle ut fra ennå"
            }
          />}

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

          <SendTilJournal notat={aktiv.notat} disabled={!harNotat || isGenerating} />
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
              <span className={`flex items-center gap-1.5 text-xs ${tema.tekst}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
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
        <DialogContent className="!w-[80vw] !max-w-[1200px]">
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

      <ChatModal open={visChat} onClose={() => setVisChat(false)} />

      <VerktoyModal open={visVerktoy} onClose={() => setVisVerktoy(false)} />
    </div>
  )
}
