"use client"

import { useState, useCallback, useRef } from "react"
import type { Konsultasjon } from "@/types/konsultasjon"

export function useClaude() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /**
   * Generer notat via Claude API med SSE-streaming.
   * onDelta: kalles for hvert tekst-fragment
   * onFerdig: kalles med fullstendig tekst når streaming er ferdig
   */
  const genererNotat = useCallback(
    async (
      konsultasjon: Konsultasjon,
      onDelta: (tekst: string) => void,
      onFerdig: (fullTekst: string) => Promise<void>
    ) => {
      setIsGenerating(true)
      setFeil(null)

      const controller = new AbortController()
      abortRef.current = controller

      let akkumulert = ""

      try {
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: konsultasjon.type,
            transkript: konsultasjon.transkript,
            kontekst: konsultasjon.kontekst,
            tilleggsinfo: konsultasjon.tilleggsinfo,
            malInnhold: konsultasjon.malInnhold,
            vedlegg: konsultasjon.vedlegg ?? [],
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.feil ?? `Serverfeil ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error("Ingen datastrøm fra server")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? "" // behold ufullstendig linje

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const payload = line.slice(6).trim()
            if (payload === "[DONE]") break

            try {
              const parsed = JSON.parse(payload)
              if (parsed.feil) throw new Error(parsed.feil)
              if (parsed.text) {
                akkumulert += parsed.text
                onDelta(parsed.text)
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== payload) {
                throw parseErr
              }
            }
          }
        }

        await onFerdig(akkumulert)
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        const melding = e instanceof Error ? e.message : "Ukjent feil"
        setFeil(melding)
      } finally {
        setIsGenerating(false)
        abortRef.current = null
      }
    },
    []
  )

  const avbryt = useCallback(() => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }, [])

  return { genererNotat, isGenerating, feil, avbryt }
}
