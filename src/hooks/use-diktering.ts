"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { registrerAktivitet } from "@/lib/aktivitet"
import { lagSonioxMaaler, type SonioxMaaler } from "@/lib/soniox-maaler"
import { SONIOX_MODELL } from "@/lib/soniox-modell"

// Dynamisk import — unngår "window is not defined" ved server-side rendering
async function lastSonioxClient() {
  const { SonioxClient } = await import("@soniox/speech-to-text-web")
  return SonioxClient
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const klientRef = useRef<any>(null)
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
    klientRef.current?.stop()
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

      const SonioxClient = await lastSonioxClient()
      const klient = new SonioxClient({
        apiKey: token,
        webSocketUri: wsUrl,
        keepAlive: true,
        keepAliveInterval: 10_000,
      })
      klientRef.current = klient
      maalerRef.current?.avslutt()
      maalerRef.current = lagSonioxMaaler("diktering")

      klient.start({
        model: SONIOX_MODELL,
        languageHints: ["no"],
        enableEndpointDetection: true,
        enableSpeakerDiarization: false,
        context: {
          general: [
            { key: "domain", value: "Healthcare" },
            { key: "topic", value: "Medical consultation in Norwegian" },
          ],
          terms: [
            "diagnose", "symptom", "behandling", "blodtrykk", "blodprøve",
            "resept", "sykmelding", "henvisning", "epikrise", "journal",
            "fastlege", "spesialist", "røntgen", "ultralyd", "spirometri",
            "hypertensjon", "kolesterol", "diabetes", "ekkokardiografi",
            "nav", "arbeidsevne", "uføretrygd", "rehabilitering",
          ],
        },
        ...(mikofonId
          ? { audioConstraints: { deviceId: { exact: mikofonId } } }
          : {}),
        onStarted: () => setStatus("lytter"),
        onError: (_s: string, message: string) => {
          setFeil(`Soniox: ${message}`)
          maalerRef.current?.avslutt()
          setStatus("feil")
          klientRef.current = null
        },
        onStateChange: ({ newState }: { newState: string }) => {
          if (newState === "Finished") {
            maalerRef.current?.avslutt()
            setPartial("")
            setStatus("av")
            klientRef.current = null
          }
        },
        onPartialResult: (result: { total_audio_proc_ms?: number; tokens: Array<{ text: string; is_final: boolean }> }) => {
          registrerAktivitet() // et pågående opptak er aktivitet, også uten tastetrykk
          maalerRef.current?.oppdater(result)
          let finalDelta = ""
          const nonFinalTekst: string[] = []
          for (const tok of result.tokens) {
            if (!tok.text) continue
            // Soniox-spesialtokens (f.eks. <end> ved endepunktdeteksjon) skal ikke vises
            if (/^<[a-z]+>$/i.test(tok.text)) continue
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
