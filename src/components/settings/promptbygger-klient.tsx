"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles, Send, Trash2, Copy, Check, FilePlus2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cuid } from "@/lib/cuid"
import { hentAiOppsett, strommFraClaude } from "@/lib/bedrock-nettleser"
import { byggChatForesporsel } from "@/lib/ai-foresporsler"

interface Melding {
  id: string
  role: "user" | "assistant"
  content: string
}

interface KategoriValg {
  id: string
  label: string
}

interface Props {
  kategorier: KategoriValg[]
  onBrukSomMal: (kategoriId: string, innhold: string) => void
}

const FORSLAG = [
  "Lag et prompt for henvisning til fysioterapeut.",
  "Lag et prompt for et kort pasientbrev om prøvesvar.",
  "Lag et prompt for et strukturert diabeteskontroll-notat.",
]

export function PromptbyggerKlient({ kategorier, onBrukSomMal }: Props) {
  const [meldinger, setMeldinger] = useState<Melding[]>([])
  const [input, setInput] = useState("")
  const [streamingTekst, setStreamingTekst] = useState("")
  const [sender, setSender] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [kopiertId, setKopiertId] = useState<string | null>(null)
  const [valgtKategori, setValgtKategori] = useState(kategorier[0]?.id ?? "KONSULTASJON")
  const bunnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bunnRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [meldinger, streamingTekst])

  const send = useCallback(
    async (tekst: string) => {
      const ren = tekst.trim()
      if (!ren || sender) return
      setInput("")
      setFeil(null)
      setSender(true)

      const historikk = meldinger.map((m) => ({ role: m.role, content: m.content }))
      const nyeMeldinger: Melding[] = [...meldinger, { id: cuid(), role: "user", content: ren }]
      setMeldinger(nyeMeldinger)

      let akkumulert = ""
      try {
        // Direkte til Bedrock fra nettleseren
        const { overrides } = await hentAiOppsett()
        const foresporsel = byggChatForesporsel(
          { transkript: "", kontekst: "", tilleggsinfo: "", notat: "", messages: historikk, nyMelding: ren, modus: "promptbygger" },
          overrides
        )
        akkumulert = await strommFraClaude(foresporsel, "promptbygger", (del) => {
          akkumulert += del
          setStreamingTekst(akkumulert)
        })
        setMeldinger((prev) => [...prev, { id: cuid(), role: "assistant", content: akkumulert }])
        setStreamingTekst("")
      } catch (e) {
        setFeil(e instanceof Error ? e.message : "Ukjent feil")
        setMeldinger(meldinger)
      } finally {
        setSender(false)
        setStreamingTekst("")
      }
    },
    [meldinger, sender]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  async function kopier(m: Melding) {
    await navigator.clipboard.writeText(m.content)
    setKopiertId(m.id)
    setTimeout(() => setKopiertId(null), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <p className="text-xs text-teal-800">
          Chat deg frem til et godt prompt. Når du er fornøyd, bruk «Bruk som ny mal» under et svar for å
          forhåndsutfylle skjemaet i ønsket kategori.
        </p>
      </div>

      {/* Chat-tråd */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="h-[44vh] min-h-72 overflow-y-auto px-4 py-3 space-y-3">
          {meldinger.length === 0 && !streamingTekst ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm text-slate-400">Beskriv oppgaven du vil lage et prompt for</p>
                <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
                  {FORSLAG.map((f) => (
                    <button
                      key={f}
                      onClick={() => send(f)}
                      className="text-xs px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-700 transition-colors"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {meldinger.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="bg-teal-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col items-start gap-1.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                    <div className="flex items-center gap-1.5 pl-1">
                      <button
                        onClick={() => kopier(m)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {kopiertId === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {kopiertId === m.id ? "Kopiert" : "Kopier"}
                      </button>
                      <span className="text-slate-300">·</span>
                      <select
                        value={valgtKategori}
                        onChange={(e) => setValgtKategori(e.target.value)}
                        className="text-[11px] rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-500 focus:outline-none"
                      >
                        {kategorier.map((k) => (
                          <option key={k.id} value={k.id}>{k.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => onBrukSomMal(valgtKategori, m.content)}
                        className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-800 font-medium transition-colors"
                      >
                        <FilePlus2 className="w-3 h-3" />
                        Bruk som ny mal
                      </button>
                    </div>
                  </div>
                )
              )}

              {streamingTekst && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
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

          <div ref={bunnRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 px-3 py-2.5 flex items-end gap-2">
          {meldinger.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-slate-400 hover:text-red-600 self-end"
              onClick={() => { setMeldinger([]); setFeil(null) }}
              title="Tøm samtalen"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Textarea
            placeholder="Skriv hva promptet skal gjøre… (Enter for å sende)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sender}
            className="resize-none text-sm max-h-32 overflow-y-auto flex-1 border-slate-200"
          />
          <Button
            size="icon"
            className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white self-end"
            disabled={sender || !input.trim()}
            onClick={() => send(input)}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
