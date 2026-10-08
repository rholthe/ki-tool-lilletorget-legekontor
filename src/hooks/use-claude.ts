"use client"

import { useState, useCallback, useRef } from "react"
import type { Konsultasjon, KonsultasjonsForm } from "@/types/konsultasjon"
import { hentAiOppsett, strommFraClaude } from "@/lib/bedrock-nettleser"
import { byggNotatForesporsel } from "@/lib/ai-foresporsler"

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
      konsultasjonsform: KonsultasjonsForm | undefined,
      onDelta: (tekst: string) => void,
      onFerdig: (fullTekst: string) => Promise<void>
    ) => {
      setIsGenerating(true)
      setFeil(null)

      const controller = new AbortController()
      abortRef.current = controller

      let akkumulert = ""

      try {
        // Direkte til Bedrock fra nettleseren — transkriptet er aldri innom serveren
        const { overrides } = await hentAiOppsett()
        const foresporsel = byggNotatForesporsel(
          {
            type: konsultasjon.type,
            konsultasjonsform: konsultasjon.type === "KONSULTASJON" ? konsultasjonsform : undefined,
            transkript: konsultasjon.transkript,
            kontekst: konsultasjon.kontekst,
            tilleggsinfo: konsultasjon.tilleggsinfo,
            malInnhold: konsultasjon.malInnhold,
            vedlegg: konsultasjon.vedlegg ?? [],
            verktoyResultater: konsultasjon.verktoyResultater ?? [],
          },
          overrides
        )
        akkumulert = await strommFraClaude(foresporsel, "notat", onDelta, controller.signal)

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
