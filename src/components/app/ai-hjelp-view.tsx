"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Sparkles,
  Send,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Maximize2,
  ClipboardPaste,
  Copy,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { VedleggPanel } from "@/components/app/vedlegg-panel"
import { DikteringKnapp } from "@/components/app/diktering-knapp"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { useChat } from "@/hooks/use-chat"
import type { Vedlegg } from "@/types/konsultasjon"

interface AiHjelpMal {
  id: string
  tittel: string
  innhold: string
}

function ordTeller(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length
}

function KopierKnapp({ tekst }: { tekst: string }) {
  const [kopiert, setKopiert] = useState(false)

  async function kopier() {
    try {
      await navigator.clipboard.writeText(tekst)
      setKopiert(true)
      setTimeout(() => setKopiert(false), 1500)
    } catch {
      // utklippstavle utilgjengelig (f.eks. ikke-sikker kontekst) — ignorer
    }
  }

  return (
    <button
      onClick={kopier}
      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-700 transition-colors"
      aria-label="Kopier svar"
    >
      {kopiert ? (
        <>
          <Check className="w-3 h-3" /> Kopiert
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" /> Kopier
        </>
      )}
    </button>
  )
}

export function AiHjelpView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const { meldinger, isSending, feil, streamingTekst, sendMelding, nullstill } = useChat()

  const [inputTekst, setInputTekst] = useState("")
  const [maler, setMaler] = useState<AiHjelpMal[]>([])
  const [visKontekst, setVisKontekst] = useState(true)
  const [utvidetKontekst, setUtvidetKontekst] = useState(false)
  const bunneRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Åpne kontekstfeltet automatisk når en ny oppgave opprettes/åpnes
  const aktivId = aktiv?.id
  useEffect(() => {
    setVisKontekst(true)
  }, [aktivId])

  // Last AI-hjelp-snarveier
  useEffect(() => {
    fetch("/api/maler?kategori=AIHJELP")
      .then((r) => (r.ok ? r.json() : []))
      .then(setMaler)
      .catch(() => setMaler([]))
  }, [])

  // Auto-scroll til bunn
  useEffect(() => {
    bunneRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [meldinger, streamingTekst])

  const handleSend = useCallback(async () => {
    const tekst = inputTekst.trim()
    if (!tekst || isSending || !aktiv) return
    setInputTekst("")
    setVisKontekst(false)

    const valgtVedlegg = (aktiv.vedlegg ?? []).map((v) => ({
      mimeType: v.mimeType,
      base64: v.base64,
      oppgave: v.oppgave,
      spirometriType: v.spirometriType,
      egendefinertPrompt: v.egendefinertPrompt,
    }))

    await sendMelding(tekst, valgtVedlegg)
  }, [inputTekst, isSending, aktiv, sendMelding])

  // Snarvei i ett klikk: hent tekst fra utklippstavle → kontekst, legg snarveien
  // i instruksjonsfeltet og send forespørselen.
  const handleSnarveiMedUtklippstavle = useCallback(
    async (mal: AiHjelpMal) => {
      if (isSending || !aktiv) return

      let utklippstekst = ""
      try {
        utklippstekst = (await navigator.clipboard.readText()).trim()
      } catch {
        // utklippstavle utilgjengelig/nektet — fortsett med eksisterende kontekst
      }

      if (utklippstekst) {
        await oppdater({ kontekst: utklippstekst })
      }

      setInputTekst("")
      setVisKontekst(false)

      const valgtVedlegg = (aktiv.vedlegg ?? []).map((v) => ({
        mimeType: v.mimeType,
        base64: v.base64,
        oppgave: v.oppgave,
        spirometriType: v.spirometriType,
        egendefinertPrompt: v.egendefinertPrompt,
      }))

      await sendMelding(mal.innhold, valgtVedlegg, utklippstekst || undefined)
    },
    [isSending, aktiv, oppdater, sendMelding]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!aktiv) return null

  const antallVedlegg = aktiv.vedlegg?.length ?? 0
  const harKontekst = Boolean(aktiv.kontekst?.trim()) || antallVedlegg > 0
  const tomChat = meldinger.length === 0 && !streamingTekst

  return (
    <div className="h-full flex flex-col">
      {/* Topprad */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4">
        <Badge
          variant="outline"
          className="flex items-center gap-1.5 text-xs font-medium shrink-0 bg-teal-100 text-teal-700 border-teal-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI-hjelp
        </Badge>
        <Input
          placeholder="Tittel (valgfritt)"
          value={aktiv.pasientId}
          onChange={(e) => oppdater({ pasientId: e.target.value })}
          className="max-w-xs text-sm border-slate-200"
        />
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:text-red-600"
              onClick={nullstill}
              disabled={meldinger.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tøm chat-historikk</TooltipContent>
        </Tooltip>
      </div>

      {/* Kontekst og vedlegg (sammenleggbart) */}
      <div className="border-b border-slate-200 bg-slate-50 shrink-0">
        <button
          onClick={() => setVisKontekst((v) => !v)}
          className="w-full flex items-center gap-2 px-6 py-2.5 text-left hover:bg-slate-100/60 transition-colors"
        >
          {visKontekst ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-medium text-slate-600">Kontekst og vedlegg</span>
          <div className="flex items-center gap-1.5 ml-1">
            {aktiv.kontekst?.trim() && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 font-medium">
                {ordTeller(aktiv.kontekst)} ord
              </span>
            )}
            {antallVedlegg > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600 font-medium inline-flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {antallVedlegg}
              </span>
            )}
            {!harKontekst && (
              <span className="text-xs text-slate-400 italic">tomt — legg til det AI skal jobbe med</span>
            )}
          </div>
        </button>

        {visKontekst && (
          <div className="px-6 pb-4 space-y-3 max-h-[42vh] overflow-y-auto">
            <div className="relative">
              <Textarea
                placeholder="Lim inn eller skriv all informasjon AI skal bruke — notater, epikriser, prøvesvar, bakgrunn… Det er instruksjonen din nederst som styrer hva AI gjør med dette."
                value={aktiv.kontekst}
                onChange={(e) => oppdater({ kontekst: e.target.value })}
                className="resize-none h-28 text-sm border-slate-200 bg-white pr-9"
              />
              <button
                onClick={() => setUtvidetKontekst(true)}
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Utvid kontekst til fullskjerm"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <VedleggPanel
              modus="enkel"
              kompakt
              vedlegg={aktiv.vedlegg ?? []}
              onChange={(nyeVedlegg: Vedlegg[]) => oppdater({ vedlegg: nyeVedlegg })}
            />
          </div>
        )}
      </div>

      {/* Utvidet kontekst-dialog (fullskjerm) */}
      <Dialog open={utvidetKontekst} onOpenChange={setUtvidetKontekst}>
        <DialogContent className="!w-[90vw] !max-w-[1400px] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Kontekst</DialogTitle>
          </DialogHeader>
          <Textarea
            autoFocus
            placeholder="Lim inn eller skriv all informasjon AI skal bruke — notater, epikriser, prøvesvar, bakgrunn… Det er instruksjonen din nederst som styrer hva AI gjør med dette."
            value={aktiv.kontekst}
            onChange={(e) => oppdater({ kontekst: e.target.value })}
            className="flex-1 resize-none text-sm border-slate-200 min-h-0"
          />
        </DialogContent>
      </Dialog>

      {/* Chat-meldinger */}
      <div className={`${tomChat ? "shrink-0" : "flex-1"} overflow-y-auto px-6 py-4 space-y-3`}>
        {tomChat ? null : (
          <>
            {meldinger.map((m) => {
              if (m.role === "system") {
                return (
                  <div key={m.id} className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 shrink-0">{m.content}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )
              }
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="bg-teal-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%] text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                )
              }
              return (
                <div key={m.id} className="flex justify-start group">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[75%] text-sm">
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div className="flex justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <KopierKnapp tekst={m.content} />
                    </div>
                  </div>
                </div>
              )
            })}

            {streamingTekst && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[75%] text-sm whitespace-pre-wrap">
                  {streamingTekst}
                  <span className="inline-block w-0.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-middle" />
                </div>
              </div>
            )}
          </>
        )}

        {feil && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{feil}</span>
          </div>
        )}

        <div ref={bunneRef} />
      </div>

      {/* Snarveier */}
      <div className="px-6 py-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-xs text-slate-400 font-medium shrink-0 uppercase tracking-wide">Snarveier</span>
        {maler.map((mal) => (
          <div key={mal.id} className="relative group shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputTekst(mal.innhold)}
              disabled={isSending}
              className="text-xs h-7 px-2.5 group-hover:pr-7"
            >
              {mal.tittel}
            </Button>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <button
                  onClick={() => handleSnarveiMedUtklippstavle(mal)}
                  disabled={isSending}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-400 hover:bg-teal-100 hover:text-teal-700 disabled:opacity-40"
                  aria-label="Lim inn fra utklippstavle og send"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Lim inn utklippstavle som kontekst og send</TooltipContent>
            </Tooltip>
          </div>
        ))}
        {maler.length === 0 && (
          <Link
            href="/innstillinger?tab=prompts"
            className="text-xs text-slate-400 hover:text-teal-600 transition-colors italic"
          >
            Ingen snarveier — legg til i Innstillinger (kategori AI-hjelp)
          </Link>
        )}
      </div>

      {/* Input */}
      <div className={`px-6 py-3 border-t border-slate-200 flex gap-2 ${tomChat ? "flex-1 items-stretch" : "items-end shrink-0"}`}>
        <div className="relative flex-1 flex">
          <Textarea
            ref={inputRef}
            placeholder="Still et spørsmål eller gi en instruksjon — bruk gjerne en snarvei… (Enter for å sende, Shift+Enter for ny linje)"
            value={inputTekst}
            onChange={(e) => setInputTekst(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            className={`resize-none text-sm overflow-y-auto flex-1 border-slate-200 pr-10 ${tomChat ? "h-full" : "max-h-32"}`}
          />
          <div className="absolute bottom-1.5 right-1.5">
            <DikteringKnapp
              tekst={inputTekst}
              onTekst={setInputTekst}
              textareaRef={inputRef}
              disabled={isSending}
            />
          </div>
        </div>
        <Button
          size="icon"
          className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white self-end"
          disabled={isSending || !inputTekst.trim()}
          onClick={handleSend}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
