"use client"

import { useState, useRef, useCallback } from "react"
import type { KonsultasjonsType } from "@/types/konsultasjon"

const SAMPLE_RATE = 16000
const SONIOX_WS_URL = "wss://api.soniox.com/transcribe-websocket"

export type TranskriberingsStatus =
  | "klar"
  | "kobler"
  | "opptar"
  | "pause"
  | "feil"

// Soniox respons-token
interface SonioxToken {
  text: string
  start_ms: number
  end_ms: number
  is_final?: boolean
  speaker?: number
}

// Soniox meldings-format:
// fw  = final words    (ferdig transkribert)
// nfw = non-final words (foreløpig, kan endre seg)
interface SonioxMelding {
  fw?: SonioxToken[]
  nfw?: SonioxToken[]
}

function tokensTilTekst(tokens: SonioxToken[]): string {
  return tokens
    .map((t) => t.text)
    .join("")
    .trim()
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
        // Soniox: send tom melding for å signalisere slutt på lyd
        wsRef.current.send(new ArrayBuffer(0))
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
      // 1. Hent kortlivet Soniox-token fra serveren
      const tokenRes = await fetch("/api/soniox-token")
      if (!tokenRes.ok) {
        let feilmelding = `Serverfeil ${tokenRes.status}`
        try {
          const data = await tokenRes.json()
          if (data.feil) feilmelding = data.feil
        } catch { /* tom respons */ }
        throw new Error(feilmelding)
      }
      const tokenData = await tokenRes.json()
      if (!tokenData.token) {
        throw new Error(tokenData.feil ?? "Mangler token i serverrespons")
      }
      const { token } = tokenData

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

      // Vent på åpen tilkobling (maks 10 sek)
      await new Promise<void>((resolve, reject) => {
        const tidBegrensning = setTimeout(
          () => reject(new Error("Tidsavbrudd ved tilkobling til Soniox")),
          10_000
        )
        ws.onopen = () => {
          clearTimeout(tidBegrensning)
          // Send Soniox-konfigurasjon som første melding
          ws.send(
            JSON.stringify({
              token,
              model: "soniox_speech:en-norsk",  // Norsk modell
              language_hints: ["no", "nb"],
              sample_rate: SAMPLE_RATE,
              include_nonfinal: true,
              enable_endpoint_detection: true,
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

          // Legg til ferdig-transkribert tekst (fw = final words)
          if (msg.fw && msg.fw.length > 0) {
            const nyTekst = tokensTilTekst(msg.fw)
            if (nyTekst) {
              transkriptRef.current = transkriptRef.current
                ? `${transkriptRef.current} ${nyTekst}`
                : nyTekst
              setTranskript(transkriptRef.current)
            }
          }

          // Vis foreløpig tekst live (nfw = non-final words)
          if (msg.nfw && msg.nfw.length > 0) {
            setPartial(tokensTilTekst(msg.nfw))
          } else if (msg.fw && msg.fw.length > 0) {
            // Ferdig segment — tøm partial
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
        if (e.code !== 1000 && status === "opptar") {
          setFeil(`Soniox koblet fra (${e.code})`)
          setStatus("feil")
        }
      }

      // 4. Lyd-prosessering: MediaStream → Float32 → Int16 PCM → WebSocket
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
