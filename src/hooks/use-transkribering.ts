"use client"

import { useState, useRef, useCallback } from "react"
import { SonioxClient } from "@soniox/speech-to-text-web"
import type { KonsultasjonsType } from "@/types/konsultasjon"

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

  const klientRef = useRef<SonioxClient | null>(null)
  const transkriptRef = useRef("")
  const wsUrlRef = useRef<string | undefined>(undefined)

  // Asynkron token-henting — kalles av SDK når WebSocket åpnes
  const hentToken = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/soniox-token")
    if (!res.ok) {
      let feilmelding = `Serverfeil ${res.status}`
      try {
        const data = await res.json()
        if (data.feil) feilmelding = data.feil
      } catch { /* tom respons */ }
      throw new Error(feilmelding)
    }
    const data = await res.json()
    if (!data.token) throw new Error(data.feil ?? "Mangler token")
    // Lagre wsUrl fra serveren (styrer EU-endepunkt)
    wsUrlRef.current = data.wsUrl
    return data.token
  }, [])

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
    // Soniox SDK støtter ikke native pause — stopper og markerer som pauset
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
      // Hent wsUrl fra serveren (sikrer at EU-endepunkt styres server-side)
      // Vi henter token én gang for å få wsUrl, SDK vil hente på nytt ved WebSocket-åpning
      const preRes = await fetch("/api/soniox-token")
      if (!preRes.ok) {
        const d = await preRes.json().catch(() => ({}))
        throw new Error(d.feil ?? `Serverfeil ${preRes.status}`)
      }
      const { token: _firstToken, wsUrl } = await preRes.json()
      wsUrlRef.current = wsUrl

      // Hent mediestrøm for NAV-møter (displayMedia) eller mikrofon
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

      // Opprett Soniox SDK-klient med temp-token-funksjon og EU-WebSocket-URL
      const klient = new SonioxClient({
        apiKey: hentToken,           // SDK kaller denne når WebSocket åpnes
        webSocketUri: wsUrl,         // EU-endepunkt styrt fra server
      })
      klientRef.current = klient

      await klient.start({
        model: "stt-rt-v4",
        languageHints: ["nb", "no"],
        enableEndpointDetection: true,
        enableSpeakerDiarization: false,
        // Medisinsk kontekst for bedre norsk fagterminologi
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
        // Tilpass lydkilde
        ...(stream ? { stream } : mikofonId
          ? { audioConstraints: { deviceId: { exact: mikofonId } } }
          : {}),

        onStarted: () => setStatus("opptar"),

        onError: (_status, message) => {
          setFeil(`Soniox-feil: ${message}`)
          setStatus("feil")
          klientRef.current = null
        },

        onStateChange: ({ newState }) => {
          if (newState === "Finished") {
            setPartial("")
            setStatus("klar")
            klientRef.current = null
          }
        },

        onPartialResult: (result) => {
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
    } catch (e) {
      const melding = e instanceof Error ? e.message : "Ukjent feil"
      setFeil(melding)
      setStatus("feil")
      ryddOpp()
    }
  }, [type, mikofonId, hentToken, ryddOpp])

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
