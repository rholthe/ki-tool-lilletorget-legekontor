"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { MessageSquare, Send, Trash2, X, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { useChat } from "@/hooks/use-chat"

interface Props {
  open: boolean
  onClose: () => void
}

interface ChatMal {
  id: string
  tittel: string
  innhold: string
}

function ordTeller(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length
}

export function ChatModal({ open, onClose }: Props) {
  const { aktiv } = useKonsultasjon()
  const { meldinger, isSending, feil, streamingTekst, sendMelding, leggTilMarkør, nullstill } = useChat()

  const [inputTekst, setInputTekst] = useState("")
  const [chatMaler, setChatMaler] = useState<ChatMal[]>([])
  const [aktiveVedleggIds, setAktiveVedleggIds] = useState<Set<string>>(
    new Set(aktiv?.vedlegg?.map((v) => v.id) ?? [])
  )
  const bunneRef = useRef<HTMLDivElement>(null)
  const forrigeVerdierRef = useRef<{
    transkript: string
    kontekst: string
    tilleggsinfo: string
    vedleggIds: string
  } | null>(null)

  // Last chat-maler når modal åpnes
  useEffect(() => {
    if (!open) return
    fetch("/api/maler?kategori=CHAT")
      .then((r) => r.ok ? r.json() : [])
      .then(setChatMaler)
      .catch(() => setChatMaler([]))
  }, [open])

  // Synkroniser vedlegg-toggles når vedlegg endres
  useEffect(() => {
    setAktiveVedleggIds((prev) => {
      const nyeIds = new Set(prev)
      for (const v of aktiv?.vedlegg ?? []) {
        if (!nyeIds.has(v.id)) nyeIds.add(v.id)
      }
      return nyeIds
    })
  }, [aktiv?.vedlegg])

  // Endringsdeteksjon — case A: sjekk snapshot når modal åpnes
  useEffect(() => {
    if (!open || !aktiv || meldinger.length === 0) {
      forrigeVerdierRef.current = null
      return
    }
    const snap = aktiv.chatKontekstSnapshot
    if (!snap) {
      forrigeVerdierRef.current = {
        transkript: aktiv.transkript,
        kontekst: aktiv.kontekst,
        tilleggsinfo: aktiv.tilleggsinfo,
        vedleggIds: (aktiv.vedlegg ?? []).map((v) => v.id).sort().join(","),
      }
      return
    }

    const endringer: string[] = []
    if (aktiv.transkript !== snap.transkript) endringer.push("Transkript endret")
    if (aktiv.kontekst !== snap.kontekst) endringer.push("Kontekst endret")
    if (aktiv.tilleggsinfo !== snap.tilleggsinfo) endringer.push("Tilleggsinfo endret")
    const vedleggIds = (aktiv.vedlegg ?? []).map((v) => v.id).sort().join(",")
    if (vedleggIds !== snap.vedleggIds.sort().join(",")) endringer.push("Filvedlegg endret")

    endringer.forEach((e) => leggTilMarkør(e))

    forrigeVerdierRef.current = {
      transkript: aktiv.transkript,
      kontekst: aktiv.kontekst,
      tilleggsinfo: aktiv.tilleggsinfo,
      vedleggIds,
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Endringsdeteksjon — case B: endringer mens modal er åpen
  const vedleggIdsStreng = (aktiv?.vedlegg ?? []).map((v) => v.id).sort().join(",")
  useEffect(() => {
    if (!open || !aktiv || !forrigeVerdierRef.current || meldinger.length === 0) return

    const forrige = forrigeVerdierRef.current
    const endringer: string[] = []

    if (aktiv.transkript !== forrige.transkript) endringer.push("Transkript endret")
    if (aktiv.kontekst !== forrige.kontekst) endringer.push("Kontekst endret")
    if (aktiv.tilleggsinfo !== forrige.tilleggsinfo) endringer.push("Tilleggsinfo endret")
    if (vedleggIdsStreng !== forrige.vedleggIds) endringer.push("Filvedlegg endret")

    if (endringer.length > 0) {
      endringer.forEach((e) => leggTilMarkør(e))
      forrigeVerdierRef.current = {
        transkript: aktiv.transkript,
        kontekst: aktiv.kontekst,
        tilleggsinfo: aktiv.tilleggsinfo,
        vedleggIds: vedleggIdsStreng,
      }
    }
  }, [aktiv?.transkript, aktiv?.kontekst, aktiv?.tilleggsinfo, vedleggIdsStreng]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll til bunn
  useEffect(() => {
    bunneRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [meldinger, streamingTekst])

  const handleSend = useCallback(async () => {
    const tekst = inputTekst.trim()
    if (!tekst || isSending || !aktiv) return
    setInputTekst("")

    const valgtVedlegg = (aktiv.vedlegg ?? [])
      .filter((v) => aktiveVedleggIds.has(v.id))
      .map((v) => ({
        mimeType: v.mimeType,
        base64: v.base64,
        oppgave: v.oppgave,
        spirometriType: v.spirometriType,
        egendefinertPrompt: v.egendefinertPrompt,
      }))

    await sendMelding(tekst, valgtVedlegg)
  }, [inputTekst, isSending, aktiv, aktiveVedleggIds, sendMelding])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function toggleVedlegg(id: string) {
    setAktiveVedleggIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const erOpptar = aktiv?.status === "opptar"
  const harVedlegg = (aktiv?.vedlegg?.length ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="!w-[90vw] !max-w-[1400px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="bg-slate-800 text-white px-5 py-4 rounded-t-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-5 h-5 text-slate-300" />
            <div>
              <h2 className="text-base font-semibold leading-none">Chat / AI-hjelp</h2>
              <p className="text-xs text-slate-400 mt-1">Still spørsmål om konsultasjonen — eller bruk en snarvei</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-slate-400 hover:text-white hover:bg-slate-700"
                  onClick={nullstill}
                  disabled={meldinger.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tøm chat-historikk</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Kontekst-banner ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-600">Konsultasjonens innhold er lagt til kontekst</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aktiv?.transkript ? (
              <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium">
                Transkript · {ordTeller(aktiv.transkript)} ord
                {erOpptar && <span className="ml-1 text-red-500">● live</span>}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-400">
                Transkript · tomt
              </span>
            )}
            {aktiv?.kontekst?.trim() && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                Kontekst · {ordTeller(aktiv.kontekst)} ord
              </span>
            )}
            {aktiv?.tilleggsinfo?.trim() && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                Tilleggsinfo · {ordTeller(aktiv.tilleggsinfo)} ord
              </span>
            )}
            {aktiv?.notat?.trim() && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-600">
                Notat · {ordTeller(aktiv.notat)} ord
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 italic">
            AI er skriveassistent og gir ikke selvstendige kliniske vurderinger.
            {erOpptar && " Transkript ved aktivt opptak viser lagret versjon (oppdateres automatisk)."}
          </p>
        </div>

        {/* ── Vedlegg-toggles ── */}
        {harVedlegg && (
          <div className="px-5 py-2 border-b border-slate-100 flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 font-medium shrink-0">Vedlegg i kontekst:</span>
            {aktiv!.vedlegg!.map((v) => (
              <button
                key={v.id}
                onClick={() => toggleVedlegg(v.id)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  aktiveVedleggIds.has(v.id)
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-400 line-through"
                }`}
              >
                {v.navn}
              </button>
            ))}
          </div>
        )}

        {/* ── Chat-meldinger ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {meldinger.length === 0 && !streamingTekst ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm text-slate-400">Still spørsmål om konsultasjonen</p>
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
                      <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%] text-sm whitespace-pre-wrap">
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

              {/* Streaming-melding */}
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

        {/* ── Snarveier ── */}
        <div className="px-5 py-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-xs text-slate-400 font-medium shrink-0 uppercase tracking-wide">Snarveier</span>
          {chatMaler.map((mal) => (
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
          {chatMaler.length === 0 && (
            <Link
              href="/innstillinger?tab=prompts"
              className="text-xs text-slate-400 hover:text-blue-600 transition-colors italic"
            >
              Ingen snarveier — legg til i Innstillinger
            </Link>
          )}
        </div>

        {/* ── Input ── */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-end gap-2 shrink-0">
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
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white self-end"
            disabled={isSending || !inputTekst.trim()}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
