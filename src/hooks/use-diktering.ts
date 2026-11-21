"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { Recording } from "@soniox/client"
import { registrerAktivitet } from "@/lib/aktivitet"
import { lagSonioxMaaler, type SonioxMaaler } from "@/lib/soniox-maaler"
import { erSpesialtoken, startSonioxOpptak, stoppOpptak } from "@/lib/soniox-opptak"

export type DikteringsStatus = "av" | "kobler" | "lytter" | "feil"

/**
 * Enkel mikrofon-diktering via Soniox — kun sanntidstranskripsjon, ingen AI-behandling.
 * Brukes til å diktere tekst rett inn i tekstfelt. For hvert resultat leveres
 * både nylig ferdigstilt tekst (`finalDelta`) og gjeldende foreløpige tekst
 * (`partial`), slik at tekst kan vises umiddelbart og erstattes når den blir endelig.
 */
export function useDiktering(opts: {
  mikofonId: string | null
  onOppdatering: (finalDelta: string, partial: string) => void
}) {
  const { mikofonId } = opts
  const [status, setStatus] = useState<DikteringsStatus>("av")
  const [partial, setPartial] = useState("")
  const [feil, setFeil] = useState<string | null>(null)

  const klientRef = useRef<Recording | null>(null)
  const maalerRef = useRef<SonioxMaaler | null>(null)
  const onOppdateringRef = useRef(opts.onOppdatering)
  useEffect(() => {
    onOppdateringRef.current = opts.onOppdatering
  }, [opts.onOppdatering])

  // Rydd opp tilkoblingen når komponenten unmountes
  useEffect(() => {
    return () => {
      klientRef.current?.cancel()
      maalerRef.current?.avslutt()
      klientRef.current = null
    }
  }, [])

  const stopp = useCallback(() => {
    stoppOpptak(klientRef.current)
    maalerRef.current?.avsluttSnart()
    klientRef.current = null
    setPartial("")
    setStatus("av")
  }, [])

  const start = useCallback(async () => {
    setFeil(null)
    setStatus("kobler")
    setPartial("")

    try {
      const tokenRes = await fetch("/api/soniox-token")
      if (!tokenRes.ok) {
        const d = await tokenRes.json().catch(() => ({}))
        throw new Error(d.feil ?? `Token-feil ${tokenRes.status}`)
      }
      const { token, wsUrl } = await tokenRes.json()
      if (!token) throw new Error("Mangler token fra server")

      maalerRef.current?.avslutt()
      maalerRef.current = lagSonioxMaaler("diktering")
      klientRef.current = await startSonioxOpptak({
        token,
        wsUrl,
        mikrofonId: mikofonId,
        onStartet: () => setStatus("lytter"),
        onFeil: (message) => {
          setFeil(`Soniox: ${message}`)
          maalerRef.current?.avslutt()
          setStatus("feil")
          klientRef.current = null
        },
        onFerdig: () => {
          maalerRef.current?.avslutt()
          setPartial("")
          setStatus("av")
          klientRef.current = null
        },
        onResultat: (result) => {
          registrerAktivitet() // et pågående opptak er aktivitet, også uten tastetrykk
          maalerRef.current?.oppdater(result)
          let finalDelta = ""
          const nonFinalTekst: string[] = []
          for (const tok of result.tokens) {
            if (!tok.text) continue
            if (erSpesialtoken(tok.text)) continue
            if (tok.is_final) finalDelta += tok.text
            else nonFinalTekst.push(tok.text)
          }
          const partialTekst = nonFinalTekst.join("")
          onOppdateringRef.current(finalDelta, partialTekst)
          setPartial(partialTekst)
        },
      })
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Kunne ikke starte diktering")
      setStatus("feil")
      klientRef.current?.cancel()
      maalerRef.current?.avslutt()
      klientRef.current = null
    }
  }, [mikofonId])

  return { status, partial, feil, start, stopp }
}
