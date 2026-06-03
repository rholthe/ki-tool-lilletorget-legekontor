"use client"

import { useState, useRef, useCallback } from "react"
import type { KonsultasjonsType } from "@/types/konsultasjon"

const SAMPLE_RATE = 16000
// Korrekt URL fra offisielle Soniox-eksempler
const SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket"

export type TranskriberingsStatus =
  | "klar"
  | "kobler"
  | "opptar"
  | "pause"
  | "feil"

interface SonioxToken {
  text: string
  start_ms: number
  end_ms: number
  is_final: boolean
  speaker?: string
  language?: string
}

interface SonioxMelding {
  tokens?: SonioxToken[]
  finished?: boolean
  error_code?: string
  error_message?: string
}

export function useTranskribering(
  type: KonsultasjonsType,
  mikofonId: string | null
) {
  const [status, setStatus] = useState<TranskriberingsStatus>("klar")
  const [transkript, setTranskript] = useState("")
  const [partial, setPartial] = useState("")
  const [feil, setFeil] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transkriptRef = useRef("")

  const ryddOpp = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close()
    }
    audioCtxRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("") // Tom streng = slutt på lyd (Soniox-konvensjon)
        wsRef.current.close()
      }
      wsRef.current = null
    }
  }, [])

  const stopp = useCallback(async (): Promise<string> => {
    ryddOpp()
    setPartial("")
    setStatus("klar")
    return transkriptRef.current
  }, [ryddOpp])

  const pause = useCallback(() => {
    processorRef.current?.disconnect()
    setStatus("pause")
  }, [])

  const fortsett = useCallback(() => {
    if (processorRef.current && audioCtxRef.current) {
      processorRef.current.connect(audioCtxRef.current.destination)
    }
    setStatus("opptar")
  }, [])

  const start = useCallback(async () => {
    setFeil(null)
    setStatus("kobler")
    setTranskript("")
    setPartial("")
    transkriptRef.current = ""

    try {
      // 1. Hent Soniox API-nøkkel fra serveren (kun for innloggede brukere)
      const res = await fetch("/api/soniox-token")
      if (!res.ok) {
        let feilmelding = `Serverfeil ${res.status}`
        try {
          const data = await res.json()
          if (data.feil) feilmelding = data.feil
        } catch { /* tom respons */ }
        throw new Error(feilmelding)
      }
      const { apiKey } = await res.json()
      if (!apiKey) throw new Error("Mangler API-nøkkel i serverrespons")

      // 2. Hent mediestrøm
      let stream: MediaStream

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
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: mikofonId
            ? {
                deviceId: { exact: mikofonId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
        })
      }

      streamRef.current = stream

      // 3. Koble til Soniox WebSocket
      const ws = new WebSocket(SONIOX_WS_URL)
      wsRef.current = ws

      await new Promise<void>((resolve, reject) => {
        const tidBegrensning = setTimeout(
          () => reject(new Error("Tidsavbrudd ved tilkobling til Soniox")),
          10_000
        )

        ws.onopen = () => {
          clearTimeout(tidBegrensning)

          // Første melding: Soniox-konfigurasjon med API-nøkkel
          ws.send(
            JSON.stringify({
              api_key: apiKey,
              model: "stt-rt-v4",
              language_hints: ["nb", "no"],
              audio_format: "pcm_s16le",
              sample_rate: SAMPLE_RATE,
              num_channels: 1,
              enable_endpoint_detection: true,
              enable_speaker_diarization: false,
              // Medisinsk kontekst for bedre gjenkjenning av fagtermer
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
            })
          )

          setStatus("opptar")
          resolve()
        }

        ws.onerror = () => {
          clearTimeout(tidBegrensning)
          reject(new Error("WebSocket-tilkobling til Soniox feilet"))
        }
      })

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as SonioxMelding

          if (msg.error_code) {
            setFeil(`Soniox-feil: ${msg.error_message ?? msg.error_code}`)
            setStatus("feil")
            ryddOpp()
            return
          }

          if (msg.tokens && msg.tokens.length > 0) {
            let harNyeFinal = false
            const nonFinal: SonioxToken[] = []

            for (const token of msg.tokens) {
              if (token.text) {
                if (token.is_final) {
                  transkriptRef.current = transkriptRef.current
                    ? `${transkriptRef.current}${token.text}`
                    : token.text
                  harNyeFinal = true
                } else {
                  nonFinal.push(token)
                }
              }
            }

            if (harNyeFinal) {
              setTranskript(transkriptRef.current)
            }

            // Vis foreløpige tokens som live-forhåndsvisning
            setPartial(nonFinal.map((t) => t.text).join(""))
          }

          if (msg.finished) {
            setPartial("")
          }
        } catch {
          // Ignorer meldinger som ikke er gyldig JSON
        }
      }

      ws.onerror = () => {
        setFeil("Tilkoblingsfeil mot Soniox — prøv å starte på nytt")
        setStatus("feil")
        ryddOpp()
      }

      ws.onclose = (e) => {
        if (e.code !== 1000 && e.code !== 1001) {
          setFeil(`Soniox koblet fra uventet (kode ${e.code})`)
          setStatus("feil")
        }
      }

      // 4. Lyd-prosessering: Float32 → Int16 PCM → WebSocket
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = audioCtx

      const kilde = audioCtx.createMediaStreamSource(stream)
      const prosessor = audioCtx.createScriptProcessor(4096, 1, 1)
      processorRef.current = prosessor

      prosessor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        ws.send(int16.buffer)
      }

      kilde.connect(prosessor)
      prosessor.connect(audioCtx.destination)
    } catch (e) {
      const melding = e instanceof Error ? e.message : "Ukjent feil"
      setFeil(melding)
      setStatus("feil")
      ryddOpp()
    }
  }, [type, mikofonId, ryddOpp])

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
