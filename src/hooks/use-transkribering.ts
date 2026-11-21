"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { Recording } from "@soniox/client"
import type { KonsultasjonsType } from "@/types/konsultasjon"
import { registrerAktivitet } from "@/lib/aktivitet"
import { lagSonioxMaaler, type SonioxMaaler } from "@/lib/soniox-maaler"
import { erSpesialtoken, startSonioxOpptak, stoppOpptak } from "@/lib/soniox-opptak"


export type TranskriberingsStatus =
  | "klar"
  | "kobler"
  | "opptar"
  | "pause"
  | "feil"

export type MoteForm = "video" | "telefon" | "fysisk"

/** Ber om å dele en fane med lyd (videomøte). Videosporet stoppes; bare lyden brukes. */
async function hentFanelyd(): Promise<MediaStream> {
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
  return new MediaStream(audioSpor)
}

function erLevende(strom: MediaStream | null): strom is MediaStream {
  return !!strom && strom.getAudioTracks().some((t) => t.readyState === "live")
}

export function useTranskribering(
  type: KonsultasjonsType,
  mikofonId: string | null,
  moteform: MoteForm = "video"
) {
  const [status, setStatus] = useState<TranskriberingsStatus>("klar")
  const [transkript, setTranskript] = useState("")
  const [partial, setPartial] = useState("")
  const [feil, setFeil] = useState<string | null>(null)

  const klientRef = useRef<Recording | null>(null)
  const maalerRef = useRef<SonioxMaaler | null>(null)
  const transkriptRef = useRef("")
  // Lagrer config for gjenoppretting etter pause
  const pauseConfigRef = useRef<{ type: KonsultasjonsType; mikofonId: string | null } | null>(null)
  // Delt fanelyd (video): beholdes over pause, så Fortsett bruker samme fane uten ny dialog
  const fanelydRef = useRef<MediaStream | null>(null)

  const slippFanelyd = useCallback(() => {
    fanelydRef.current?.getTracks().forEach((t) => t.stop())
    fanelydRef.current = null
  }, [])

  const ryddOpp = useCallback(() => {
    klientRef.current?.cancel()
    maalerRef.current?.avslutt()
    klientRef.current = null
    slippFanelyd()
  }, [slippFanelyd])

  // Lukk WebSocket-tilkobling ordentlig når komponenten unmountes
  useEffect(() => {
    return () => { ryddOpp() }
  }, [ryddOpp])

  const stopp = useCallback(async (): Promise<string> => {
    stoppOpptak(klientRef.current)
    maalerRef.current?.avsluttSnart()
    klientRef.current = null
    pauseConfigRef.current = null
    slippFanelyd()
    setPartial("")
    setStatus("klar")
    return transkriptRef.current
  }, [slippFanelyd])

  // Pause: lukker tilkoblingen men beholder transkriptet (og en delt fane, se fortsett)
  const pause = useCallback(() => {
    klientRef.current?.cancel()
    maalerRef.current?.avslutt()
    klientRef.current = null
    setPartial("")
    setStatus("pause")
  }, [])

  // Kobler til Soniox og legger nye ferdige tokens til transkriptet
  const kobleTil = useCallback(async (
    token: string,
    wsUrl: string,
    kilde: { strom?: MediaStream; mikrofonId?: string | null }
  ) => {
    maalerRef.current?.avslutt()
    maalerRef.current = lagSonioxMaaler("transkribering")
    klientRef.current = await startSonioxOpptak({
      token,
      wsUrl,
      ...kilde,
      onStartet: () => setStatus("opptar"),
      onFeil: (message) => {
        setFeil(`Soniox: ${message}`)
        maalerRef.current?.avslutt()
        setStatus("feil")
        klientRef.current = null
      },
      onFerdig: () => {
        maalerRef.current?.avslutt()
        setPartial("")
        setStatus("klar")
        klientRef.current = null
      },
      onResultat: (result) => {
        registrerAktivitet() // et pågående opptak er aktivitet, også uten tastetrykk
        maalerRef.current?.oppdater(result)
        let harNyeFinal = false
        const nonFinalTekst: string[] = []
        for (const tok of result.tokens) {
          if (!tok.text) continue
          if (erSpesialtoken(tok.text)) continue
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
  }, [])

  // Fortsett: gjenoppretter tilkobling med nytt token, legger til eksisterende transkript.
  // Video: bruker den delte fanen fra før pausen, eller ber om ny deling hvis den er stoppet.
  // `nyFane` tvinger ny deling (fortsett fra lagret pause kan gjelde et annet møte).
  const fortsett = useCallback(async (nyFane = false) => {
    setFeil(null)
    setStatus("kobler")
    try {
      const tokenRes = await fetch("/api/soniox-token")
      if (!tokenRes.ok) throw new Error(`Token-feil ${tokenRes.status}`)
      const { token, wsUrl } = await tokenRes.json()
      if (moteform === "video") {
        if (nyFane || !erLevende(fanelydRef.current)) {
          slippFanelyd()
          fanelydRef.current = await hentFanelyd()
        }
        await kobleTil(token, wsUrl, { strom: fanelydRef.current! })
      } else {
        slippFanelyd()
        await kobleTil(token, wsUrl, { mikrofonId: pauseConfigRef.current?.mikofonId ?? mikofonId })
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Gjenoppkobling feilet")
      setStatus("feil")
    }
  }, [kobleTil, moteform, mikofonId, slippFanelyd])

  // Fortsett fra lagret pause (byttet konsultasjon): laster inn eksisterende transkript og kobler til
  const fortsetFraLagret = useCallback(async (eksisterendeTranskript: string) => {
    transkriptRef.current = eksisterendeTranskript
    setTranskript(eksisterendeTranskript)
    await fortsett(true)
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

      // 2. Hent mediestrøm (video: delt fane med lyd)
      slippFanelyd()
      if (moteform === "video") fanelydRef.current = await hentFanelyd()

      // 3. Start opptaket — token sendes som streng (ikke funksjon) for å unngå dobbel-fetch
      // Lagre config for bruk ved gjenoppkobling (Fortsett etter pause)
      pauseConfigRef.current = { type, mikofonId }
      await kobleTil(token, wsUrl, fanelydRef.current ? { strom: fanelydRef.current } : { mikrofonId: mikofonId })

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
  }, [type, mikofonId, moteform, ryddOpp, status, kobleTil, slippFanelyd])

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
