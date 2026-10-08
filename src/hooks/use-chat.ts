"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { Vedlegg, ChatMelding } from "@/types/konsultasjon"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import { cuid } from "@/lib/cuid"
import { hentAiOppsett, strommFraClaude } from "@/lib/bedrock-nettleser"
import { byggChatForesporsel } from "@/lib/ai-foresporsler"

const MAKS_HISTORIKK = 20 // 10 utvekslinger

export function useChat() {
  const { aktiv, oppdater } = useKonsultasjon()

  const [meldinger, setMeldinger] = useState<ChatMelding[]>(
    aktiv?.chatHistorikk ?? []
  )
  const [isSending, setIsSending] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [streamingTekst, setStreamingTekst] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  // Re-initialiser når bruker bytter konsultasjon
  useEffect(() => {
    setMeldinger(aktiv?.chatHistorikk ?? [])
    setFeil(null)
    setStreamingTekst("")
  }, [aktiv?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const leggTilMarkør = useCallback(
    async (felt: string) => {
      const markør: ChatMelding = {
        id: cuid(),
        role: "system",
        content: felt,
        timestamp: Date.now(),
      }
      setMeldinger((prev) => {
        const nyeMeldinger = [...prev, markør]
        oppdater({ chatHistorikk: nyeMeldinger })
        return nyeMeldinger
      })
    },
    [oppdater]
  )

  const sendMelding = useCallback(
    async (
      tekst: string,
      valgtVedlegg: Pick<Vedlegg, "mimeType" | "base64" | "oppgave" | "spirometriType" | "egendefinertPrompt">[],
      overstyrKontekst?: string
    ) => {
      if (!aktiv || !tekst.trim() || isSending) return

      // overstyrKontekst brukes når kontekst nettopp er satt (f.eks. lim-inn-fra-utklippstavle)
      // og React-staten i `aktiv` ennå ikke er oppdatert i denne closuren.
      const effektivKontekst = overstyrKontekst ?? aktiv.kontekst

      setIsSending(true)
      setFeil(null)

      const controller = new AbortController()
      abortRef.current = controller

      const brukerMelding: ChatMelding = {
        id: cuid(),
        role: "user",
        content: tekst.trim(),
        timestamp: Date.now(),
      }

      // Bygg historikk til API — kun user/assistant, trimmet til maks
      const historikkTilSend = meldinger
        .filter((m) => m.role !== "system")
        .slice(-MAKS_HISTORIKK)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

      const nyeMeldinger = [...meldinger, brukerMelding]
      setMeldinger(nyeMeldinger)

      let akkumulert = ""

      try {
        // Direkte til Bedrock fra nettleseren — pasientinnhold er aldri innom serveren
        const { overrides } = await hentAiOppsett()
        const erAiHjelp = aktiv.type === "AIHJELP"
        const foresporsel = byggChatForesporsel(
          {
            transkript: aktiv.transkript,
            kontekst: effektivKontekst,
            tilleggsinfo: aktiv.tilleggsinfo,
            notat: aktiv.notat,
            vedlegg: valgtVedlegg,
            messages: historikkTilSend,
            nyMelding: tekst.trim(),
            ...(erAiHjelp ? { modus: "aihjelp" as const } : {}),
          },
          overrides
        )
        akkumulert = await strommFraClaude(
          foresporsel,
          erAiHjelp ? "aihjelp" : "chat",
          (del) => {
            akkumulert += del
            setStreamingTekst(akkumulert)
          },
          controller.signal
        )

        const assistentMelding: ChatMelding = {
          id: cuid(),
          role: "assistant",
          content: akkumulert,
          timestamp: Date.now(),
        }

        const medSvar = [...nyeMeldinger, assistentMelding]
        setMeldinger(medSvar)
        setStreamingTekst("")

        await oppdater({
          chatHistorikk: medSvar,
          chatKontekstSnapshot: {
            transkript: aktiv.transkript,
            kontekst: effektivKontekst,
            tilleggsinfo: aktiv.tilleggsinfo,
            vedleggIds: (aktiv.vedlegg ?? []).map((v) => v.id),
          },
        })
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        const melding = e instanceof Error ? e.message : "Ukjent feil"
        setFeil(melding)
        // Fjern brukermelding ved feil så bruker kan prøve igjen
        setMeldinger(meldinger)
      } finally {
        setIsSending(false)
        setStreamingTekst("")
        abortRef.current = null
      }
    },
    [aktiv, isSending, meldinger, oppdater]
  )

  const nullstill = useCallback(async () => {
    abortRef.current?.abort()
    setMeldinger([])
    setStreamingTekst("")
    setFeil(null)
    setIsSending(false)
    await oppdater({ chatHistorikk: [], chatKontekstSnapshot: undefined })
  }, [oppdater])

  const avbryt = useCallback(() => {
    abortRef.current?.abort()
    setIsSending(false)
    setStreamingTekst("")
  }, [])

  return { meldinger, isSending, feil, streamingTekst, sendMelding, leggTilMarkør, nullstill, avbryt }
}
