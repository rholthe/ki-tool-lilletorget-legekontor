"use client"

import type { AudioSource, AudioSourceHandlers, Recording } from "@soniox/client"
import { SONIOX_MODELL } from "@/lib/soniox-modell"

/**
 * Felles oppsett for sanntidsopptak mot Soniox med `@soniox/client`.
 *
 * Den nye SDK-en sender den kortlivede nøkkelen som WebSocket-subprotokoll
 * (`soniox-api-key`), slik Soniox krever fra 15.01.2027. Den gamle
 * `@soniox/speech-to-text-web` sendte den som `api_key` i startmeldingen.
 *
 * Lydoppsettet er det samme som med den gamle SDK-en:
 * - valgt mikrofon: bare `deviceId`, ellers nettleserens standard
 *   (ekkodemping, støyreduksjon og automatisk forsterkning på)
 * - ingen valgt mikrofon: alt av, mono, 44,1 kHz
 * - MediaRecorder leverer biter hvert 120. ms
 */

export type SonioxResultat = {
  total_audio_proc_ms?: number
  tokens: Array<{ text: string; is_final: boolean }>
}

const TIMESLICE_MS = 120

const STANDARD_LYD: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
  sampleRate: 44100,
}

const KONTEKST = {
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
}

/** Soniox-spesialtokens (f.eks. `<end>` ved endepunktdeteksjon) skal ikke vises. */
export function erSpesialtoken(tekst: string): boolean {
  return /^<[a-z]+>$/i.test(tekst)
}

/**
 * Lydkilde for en ferdig `MediaStream` (lyd fra skjermdeling i Møte/video).
 * `MicrophoneSource` i SDK-en kan bare hente mikrofon selv. Strømmen klones,
 * som i den gamle SDK-en, så den opprinnelige strømmen lever videre etter stopp.
 */
class StromKilde implements AudioSource {
  private strom: MediaStream | null = null
  private opptaker: MediaRecorder | null = null
  private paaData: ((e: BlobEvent) => void) | null = null
  private paaFeil: ((e: Event) => void) | null = null

  constructor(private readonly kilde: MediaStream) {}

  async start(handlers: AudioSourceHandlers): Promise<void> {
    this.stop()
    if (typeof MediaRecorder === "undefined") throw new Error("Nettleseren støtter ikke MediaRecorder")
    this.strom = this.kilde.clone()
    this.paaData = (e) => {
      if (e.data.size > 0) {
        e.data.arrayBuffer().then(
          (b) => handlers.onData(b),
          (err) => handlers.onError(err instanceof Error ? err : new Error(String(err)))
        )
      }
    }
    this.paaFeil = () => handlers.onError(new Error("Feil i lydopptaket (MediaRecorder)"))
    this.lagOpptaker()
  }

  private lagOpptaker() {
    if (!this.strom || !this.paaData || !this.paaFeil) return
    const opptaker = new MediaRecorder(this.strom)
    opptaker.addEventListener("dataavailable", this.paaData)
    opptaker.addEventListener("error", this.paaFeil)
    opptaker.start(TIMESLICE_MS)
    this.opptaker = opptaker
  }

  private fjernOpptaker() {
    const opptaker = this.opptaker
    if (!opptaker) return
    this.opptaker = null
    const paaData = this.paaData
    const paaFeil = this.paaFeil
    if (opptaker.state !== "inactive") {
      // Siste bit kommer etter stop(); lytterne fjernes først når den er levert
      opptaker.addEventListener("stop", () => {
        if (paaData) opptaker.removeEventListener("dataavailable", paaData)
        if (paaFeil) opptaker.removeEventListener("error", paaFeil)
      }, { once: true })
      opptaker.stop()
    } else {
      if (paaData) opptaker.removeEventListener("dataavailable", paaData)
      if (paaFeil) opptaker.removeEventListener("error", paaFeil)
    }
  }

  stop(): void {
    this.fjernOpptaker()
    this.strom?.getTracks().forEach((t) => t.stop())
    this.strom = null
  }

  pause(): void {
    if (this.opptaker?.state === "recording") this.opptaker.pause()
  }

  resume(): void {
    if (this.opptaker?.state === "paused") this.opptaker.resume()
  }

  /** Ny MediaRecorder på samme strøm, så neste bit får nytt container-hode. */
  restart(): void {
    if (!this.strom || !this.opptaker) return
    const opptaker = this.opptaker
    if (this.paaData) opptaker.removeEventListener("dataavailable", this.paaData)
    if (this.paaFeil) opptaker.removeEventListener("error", this.paaFeil)
    if (opptaker.state !== "inactive") opptaker.stop()
    this.lagOpptaker()
  }
}

export type SonioxOpptakValg = {
  token: string
  wsUrl: string
  /** Ferdig lydstrøm (skjermdeling). Har forrang foran `mikrofonId`. */
  strom?: MediaStream
  mikrofonId?: string | null
  onStartet: () => void
  onResultat: (resultat: SonioxResultat) => void
  onFeil: (melding: string) => void
  /** Kalles når Soniox har levert siste resultat etter `stop()`. */
  onFerdig: () => void
}

/** Starter et opptak. Returnerer `Recording` (stopp med `stop()`, avbryt med `cancel()`). */
export async function startSonioxOpptak(valg: SonioxOpptakValg): Promise<Recording> {
  // Dynamisk import: unngår at SDK-en lastes ved server-side rendering
  const { SonioxClient, MicrophoneSource } = await import("@soniox/client")

  const klient = new SonioxClient({
    config: { api_key: valg.token, stt_ws_url: valg.wsUrl },
  })

  const kilde: AudioSource = valg.strom
    ? new StromKilde(valg.strom)
    : new MicrophoneSource({
        constraints: valg.mikrofonId ? { deviceId: { exact: valg.mikrofonId } } : STANDARD_LYD,
        timesliceMs: TIMESLICE_MS,
      })

  const opptak = klient.realtime.record({
    model: SONIOX_MODELL,
    language_hints: ["no"],
    enable_endpoint_detection: true,
    enable_speaker_diarization: false,
    context: KONTEKST,
    source: kilde,
  })

  opptak.on("connected", valg.onStartet)
  opptak.on("result", (r) => valg.onResultat(r))
  opptak.on("error", (e) => valg.onFeil(e.message || "Ukjent feil"))
  opptak.on("finished", valg.onFerdig)

  return opptak
}

/** Stopper og venter på siste resultat. Feil kommer også som `error`-hendelse. */
export function stoppOpptak(opptak: Recording | null) {
  opptak?.stop().catch(() => { /* rapportert via error-hendelsen */ })
}
