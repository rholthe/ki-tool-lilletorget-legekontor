"use client"

import { useState, useRef, useCallback } from "react"
import type { KonsultasjonsType } from "@/types/konsultasjon"

// Dynamisk import — unngår "window is not defined" ved server-side rendering
async function lastSonioxClient() {
  const { SonioxClient } = await import("@soniox/speech-to-text-web")
  return SonioxClient
}

export type TranskriberingsStatus =
  | "klar"
  | "kobler"
  | "opptar"
  | "pause"
  | "feil"

export function useTranskribering(
  type: KonsultasjonsType,
  mikofonId: string | null
) {
  const [status, setStatus] = useState<TranskriberingsStatus>("klar")
  const [transkript, setTranskript] = useState("")
  const [partial, setPartial] = useState("")
  const [feil, setFeil] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const klientRef = useRef<any>(null)
  const transkriptRef = useRef("")

  const ryddOpp = useCallback(() => {
    klientRef.current?.cancel()
    klientRef.current = null
  }, [])

  const stopp = useCallback(async (): Promise<string> => {
    klientRef.current?.stop()
    klientRef.current = null
    setPartial("")
    setStatus("klar")
    return transkriptRef.current
  }, [])

  const pause = useCallback(() => {
    setStatus("pause")
  }, [])

  const fortsett = useCallback(() => {
    setStatus("opptar")
  }, [])

  const start = useCallback(async () => {
    setFeil(null)
    setStatus("kobler")
    setTranskript("")
    setPartial("")
    transkriptRef.current = ""

    try {
      // 1. Hent token + wsUrl i ett kall — token sendes direkte til SDK (ingen dobbel-fetch)
      const tokenRes = await fetch("/api/soniox-token")
      if (!tokenRes.ok) {
        const d = await tokenRes.json().catch(() => ({}))
        throw new Error(d.feil ?? `Token-feil ${tokenRes.status}`)
      }
      const { token, wsUrl } = await tokenRes.json()
      if (!token) throw new Error("Mangler token fra server")

      // 2. Hent mediestrøm
      let stream: MediaStream | undefined = undefined

      if (type === "DIALOGMOTE_NAV") {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          } as MediaTrackConstraints,
        })
        displayStream.getVideoTracks().forEach((t) => t.stop())
        const audioSpor = displayStream.getAudioTracks()
        if (audioSpor.length === 0) {
          throw new Error(
            "Ingen lyd deles. Velg «Del lyd fra fane» i skjermdelingsdialogen."
          )
        }
        stream = new MediaStream(audioSpor)
      }

      // 3. Last SDK og start — token sendes som streng (ikke funksjon) for å unngå dobbel-fetch
      const SonioxClient = await lastSonioxClient()

      const klient = new SonioxClient({
        apiKey: token,      // Streng-token fra steg 1, unngår ekstra nettverkskall
        webSocketUri: wsUrl,
      })
      klientRef.current = klient

      klient.start({
        model: "stt-rt-v4",
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
        ...(stream
          ? { stream }
          : mikofonId
            ? { audioConstraints: { deviceId: { exact: mikofonId } } }
            : {}),

        onStarted: () => setStatus("opptar"),

        onError: (_errStatus, message) => {
          setFeil(`Soniox: ${message}`)
          setStatus("feil")
          klientRef.current = null
        },

        onStateChange: ({ newState }: { newState: string }) => {
          if (newState === "Finished") {
            setPartial("")
            setStatus("klar")
            klientRef.current = null
          }
        },

        onPartialResult: (result: { tokens: Array<{ text: string; is_final: boolean }> }) => {
          let harNyeFinal = false
          const nonFinalTekst: string[] = []

          for (const token of result.tokens) {
            if (!token.text) continue
            if (token.is_final) {
              transkriptRef.current = transkriptRef.current
                ? `${transkriptRef.current}${token.text}`
                : token.text
              harNyeFinal = true
            } else {
              nonFinalTekst.push(token.text)
            }
          }

          if (harNyeFinal) setTranskript(transkriptRef.current)
          setPartial(nonFinalTekst.join(""))
        },
      })

      // Sett "opptar" som backup dersom onStarted ikke kalles innen 5 sek
      setTimeout(() => {
        if (klientRef.current && status === "kobler") {
          setStatus("opptar")
        }
      }, 5000)

    } catch (e) {
      const melding = e instanceof Error ? e.message : "Ukjent feil"
      setFeil(melding)
      setStatus("feil")
      ryddOpp()
    }
  }, [type, mikofonId, ryddOpp, status])

  const nullstill = useCallback(() => {
    setTranskript("")
    setPartial("")
    setFeil(null)
    setStatus("klar")
    transkriptRef.current = ""
  }, [])

  return {
    status,
    transkript,
    partial,
    visTekst:
      transkript + (partial ? (transkript ? ` ${partial}` : partial) : ""),
    feil,
    start,
    pause,
    fortsett,
    stopp,
    nullstill,
  }
}
