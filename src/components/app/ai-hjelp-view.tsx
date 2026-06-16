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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { VedleggPanel } from "@/components/app/vedlegg-panel"
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

export function AiHjelpView() {
  const { aktiv, oppdater } = useKonsultasjon()
  const { meldinger, isSending, feil, streamingTekst, sendMelding, nullstill } = useChat()

  const [inputTekst, setInputTekst] = useState("")
  const [maler, setMaler] = useState<AiHjelpMal[]>([])
  const [visKontekst, setVisKontekst] = useState(true)
  const bunneRef = useRef<HTMLDivElement>(null)

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!aktiv) return null

  const antallVedlegg = aktiv.vedlegg?.length ?? 0
  const harKontekst = Boolean(aktiv.kontekst?.trim()) || antallVedlegg > 0

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
            <Textarea
              placeholder="Lim inn eller skriv all informasjon AI skal bruke — notater, epikriser, prøvesvar, bakgrunn… Det er instruksjonen din nederst som styrer hva AI gjør med dette."
              value={aktiv.kontekst}
              onChange={(e) => oppdater({ kontekst: e.target.value })}
              className="resize-none h-28 text-sm border-slate-200 bg-white"
            />
            <VedleggPanel
              modus="enkel"
              vedlegg={aktiv.vedlegg ?? []}
              onChange={(nyeVedlegg: Vedlegg[]) => oppdater({ vedlegg: nyeVedlegg })}
            />
          </div>
        )}
      </div>

      {/* Chat-meldinger */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {meldinger.length === 0 && !streamingTekst ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm text-slate-400">
                Still et spørsmål eller gi en instruksjon — bruk gjerne en snarvei
              </p>
            </div>
          </div>
        ) : (
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
                <div key={m.id} className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[75%] text-sm whitespace-pre-wrap">
                    {m.content}
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
          <Button
            key={mal.id}
            variant="outline"
            size="sm"
            onClick={() => setInputTekst(mal.innhold)}
            className="shrink-0 text-xs h-7 px-2.5"
          >
            {mal.tittel}
          </Button>
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
      <div className="px-6 py-3 border-t border-slate-200 flex items-end gap-2 shrink-0">
        <Textarea
          placeholder="Skriv spørsmål eller instruksjon… (Enter for å sende, Shift+Enter for ny linje)"
          value={inputTekst}
          onChange={(e) => setInputTekst(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          className="resize-none text-sm max-h-32 overflow-y-auto flex-1 border-slate-200"
        />
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
