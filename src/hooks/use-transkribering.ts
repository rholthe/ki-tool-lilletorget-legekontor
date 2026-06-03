"use client"

import { useState, useRef, useCallback } from "react"
import type { KonsultasjonsType } from "@/types/konsultasjon"

const SAMPLE_RATE = 16000
// v3 Streaming API
const STREAMING_WS_URL = "wss://streaming.assemblyai.com/v3/ws"

// Norske medisinske termer for word_boost
const MEDISINSKE_TERMER = [
  "diagnose", "symptom", "behandling", "blodtrykk", "blodprøve",
  "resept", "sykmelding", "henvisning", "epikrise", "journal",
  "pasient", "fastlege", "spesialist", "røntgen", "ultralyd",
  "operasjon", "medisin", "bivirkninger", "allergi", "diabetes",
  "hypertensjon", "kolesterol", "spirometri", "ekg", "ekkokardiografi",
  "nav", "arbeidsevne", "trygd", "uføretrygd", "rehabilitering",
]

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

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Ref unngår stale closure i onaudioprocess
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
        wsRef.current.send(JSON.stringify({ type: "Terminate" })) // v3 format
      }
      wsRef.current.close()
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
      // 1. Hent kortlivet token fra vår server (API-nøkkel forlater aldri serveren)
      const tokenRes = await fetch("/api/assemblyai-token")
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
        // Fang nettleserfane-lyd (inkl. motpartens stemme i videomøtet)
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Nettlesere krever video, vi stopper det umiddelbart
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          } as MediaTrackConstraints,
        })

        // Stopp videostrøm — vi trenger bare lyd
        displayStream.getVideoTracks().forEach((t) => t.stop())

        const audioSpor = displayStream.getAudioTracks()
        if (audioSpor.length === 0) {
          throw new Error(
            'Ingen lyd deles. Velg «Del lyd fra fane» i skjermdelingsdialogen, ' +
              'og del fanen der NAV-videomøtet kjører.'
          )
        }
        stream = new MediaStream(audioSpor)
      } else {
        // Vanlig mikrofonfangst
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

      // 3. Åpne WebSocket mot AssemblyAI v3 Streaming API
      const wsParams = new URLSearchParams({
        token,
        sample_rate: String(SAMPLE_RATE),
        encoding: "pcm_s16le",
      })
      // Boost norske medisinske termer
      wsParams.set("word_boost", JSON.stringify(MEDISINSKE_TERMER))

      const ws = new WebSocket(`${STREAMING_WS_URL}?${wsParams.toString()}`)
      wsRef.current = ws

      // Vent på åpen tilkobling (maks 10 sek)
      await new Promise<void>((resolve, reject) => {
        const tidBegrensning = setTimeout(
          () => reject(new Error("Tidsavbrudd ved tilkobling til AssemblyAI")),
          10_000
        )
        ws.onopen = () => {
          clearTimeout(tidBegrensning)
          setStatus("opptar")
          resolve()
        }
        ws.onerror = () => {
          clearTimeout(tidBegrensning)
          reject(new Error("WebSocket-tilkobling til AssemblyAI feilet"))
        }
      })

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string)
          // v3 bruker type:"Turn" med end_of_turn-flagg
          // end_of_turn: false → delvis setning (vis live)
          // end_of_turn: true  → ferdig setning (legg til i transkript)
          if (msg.type === "Turn" && msg.transcript) {
            if (msg.end_of_turn) {
              transkriptRef.current = transkriptRef.current
                ? `${transkriptRef.current} ${msg.transcript}`
                : msg.transcript
              setTranskript(transkriptRef.current)
              setPartial("")
            } else {
              setPartial(msg.transcript)
            }
          }
        } catch {
          // Ignorer meldinger som ikke er gyldig JSON
        }
      }

      ws.onerror = () => {
        setFeil("Tilkoblingsfeil mot AssemblyAI — prøv å starte på nytt")
        setStatus("feil")
        ryddOpp()
      }

      // 4. Lyd-prosessering: MediaStream → Float32 → Int16 PCM → WebSocket
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioCtxRef.current = audioCtx

      const kilde = audioCtx.createMediaStreamSource(stream)
      // ScriptProcessor er deprecated men støttet overalt; AudioWorklet er fremtiden
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
      prosessor.connect(audioCtx.destination) // Nødvendig for at prosessoren skal kjøre
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
    // Kombinert visning: ferdige setninger + gjeldende delsetning
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
