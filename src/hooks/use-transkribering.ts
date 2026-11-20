"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { KonsultasjonsType } from "@/types/konsultasjon"
import { registrerAktivitet } from "@/lib/aktivitet"
import { lagSonioxMaaler, type SonioxMaaler } from "@/lib/soniox-maaler"
import { SONIOX_MODELL } from "@/lib/soniox-modell"

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

export type MoteForm = "video" | "telefon" | "fysisk"

export function useTranskribering(
  type: KonsultasjonsType,
  mikofonId: string | null,
  moteform: MoteForm = "video"
) {
  const [status, setStatus] = useState<TranskriberingsStatus>("klar")
  const [transkript, setTranskript] = useState("")
  const [partial, setPartial] = useState("")
  const [feil, setFeil] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const klientRef = useRef<any>(null)
  const maalerRef = useRef<SonioxMaaler | null>(null)
  const transkriptRef = useRef("")
  // Lagrer config for gjenoppretting etter pause
  const pauseConfigRef = useRef<{ type: KonsultasjonsType; mikofonId: string | null } | null>(null)

  const ryddOpp = useCallback(() => {
    klientRef.current?.cancel()
    maalerRef.current?.avslutt()
    klientRef.current = null
  }, [])

  // Lukk WebSocket-tilkobling ordentlig når komponenten unmountes
  useEffect(() => {
    return () => { ryddOpp() }
  }, [ryddOpp])

  const stopp = useCallback(async (): Promise<string> => {
    klientRef.current?.stop()
    maalerRef.current?.avsluttSnart()
    klientRef.current = null
    pauseConfigRef.current = null
    setPartial("")
    setStatus("klar")
    return transkriptRef.current
  }, [])

  // Pause: lukker tilkoblingen men beholder transkriptet
  const pause = useCallback(() => {
    klientRef.current?.cancel()
    maalerRef.current?.avslutt()
    klientRef.current = null
    setPartial("")
    setStatus("pause")
  }, [])

  // Fortsett: gjenoppretter tilkobling med nytt token, legger til eksisterende transkript
  const fortsett = useCallback(async () => {
    setStatus("kobler")
    try {
      const tokenRes = await fetch("/api/soniox-token")
      if (!tokenRes.ok) throw new Error(`Token-feil ${tokenRes.status}`)
      const { token, wsUrl } = await tokenRes.json()

      const SonioxClient = await lastSonioxClient()
      const klient = new SonioxClient({
        apiKey: token,
        webSocketUri: wsUrl,
        keepAlive: true,
        keepAliveInterval: 10_000,
      })
      klientRef.current = klient
      maalerRef.current?.avslutt()
      maalerRef.current = lagSonioxMaaler("transkribering")

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
        ...(pauseConfigRef.current?.mikofonId
          ? { audioConstraints: { deviceId: { exact: pauseConfigRef.current.mikofonId } } }
          : {}),
        onStarted: () => setStatus("opptar"),
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
            setStatus("klar")
            klientRef.current = null
          }
        },
        onPartialResult: (result: { total_audio_proc_ms?: number; tokens: Array<{ text: string; is_final: boolean }> }) => {
          registrerAktivitet() // et pågående opptak er aktivitet, også uten tastetrykk
          maalerRef.current?.oppdater(result)
          let harNyeFinal = false
          const nonFinalTekst: string[] = []
          for (const tok of result.tokens) {
            if (!tok.text) continue
            // Soniox-spesialtokens (f.eks. <end> ved endepunktdeteksjon) skal ikke i transkriptet
            if (/^<[a-z]+>$/i.test(tok.text)) continue
            if (tok.is_final) {
              transkriptRef.current = transkriptRef.current
                ? `${transkriptRef.current}${tok.text}`
                : tok.text
              harNyeFinal = true
            } else {
              nonFinalTekst.push(tok.text)
            }
          }
          if (harNyeFinal) setTranskript(transkriptRef.current)
          setPartial(nonFinalTekst.join(""))
        },
      })
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Gjenoppkobling feilet")
      setStatus("feil")
    }
  }, [])

  // Fortsett fra lagret pause (byttet konsultasjon): laster inn eksisterende transkript og kobler til
  const fortsetFraLagret = useCallback(async (eksisterendeTranskript: string) => {
    transkriptRef.current = eksisterendeTranskript
    setTranskript(eksisterendeTranskript)
    await fortsett()
  }, [fortsett])

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

      if (moteform === "video") {
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

      // Lagre config for bruk ved gjenoppkobling (Fortsett etter pause)
      pauseConfigRef.current = { type, mikofonId }

      const klient = new SonioxClient({
        apiKey: token,
        webSocketUri: wsUrl,
        keepAlive: true,          // Sender keepalive hvert 10. sekund — holder tilkoblingen
        keepAliveInterval: 10_000, // ved kortere pauser (toalett, ta telefon etc.)
      })
      klientRef.current = klient
      maalerRef.current?.avslutt()
      maalerRef.current = lagSonioxMaaler("transkribering")

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
        ...(stream
          ? { stream }
          : mikofonId
            ? { audioConstraints: { deviceId: { exact: mikofonId } } }
            : {}),

        onStarted: () => setStatus("opptar"),

        onError: (_errStatus, message) => {
          setFeil(`Soniox: ${message}`)
          maalerRef.current?.avslutt()
          setStatus("feil")
          klientRef.current = null
        },

        onStateChange: ({ newState }: { newState: string }) => {
          if (newState === "Finished") {
            maalerRef.current?.avslutt()
            setPartial("")
            setStatus("klar")
            klientRef.current = null
          }
        },

        onPartialResult: (result: { total_audio_proc_ms?: number; tokens: Array<{ text: string; is_final: boolean }> }) => {
          registrerAktivitet() // et pågående opptak er aktivitet, også uten tastetrykk
          maalerRef.current?.oppdater(result)
          let harNyeFinal = false
          const nonFinalTekst: string[] = []

          for (const token of result.tokens) {
            if (!token.text) continue
            // Soniox-spesialtokens (f.eks. <end> ved endepunktdeteksjon) skal ikke i transkriptet
            if (/^<[a-z]+>$/i.test(token.text)) continue
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
  }, [type, mikofonId, moteform, ryddOpp, status])

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
    fortsetFraLagret,
    stopp,
    nullstill,
  }
}
