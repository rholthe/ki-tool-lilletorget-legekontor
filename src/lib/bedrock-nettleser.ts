/**
 * Claude på AWS Bedrock, kalt direkte fra nettleseren.
 *
 * Pasientinnhold (transkript, kontekst, vedlegg) går rett fra nettleseren til
 * Bedrock i EU og er aldri innom vår server. Serveren gir bare kortlivede
 * AWS-nøkler, modell, region og prompt-overrides (/api/ai/oppsett), og tar imot
 * forbrukstall (/api/bruk) — aldri innhold.
 *
 * Bedrock-SDK-et er laget for Node, så her signeres forespørslene med SigV4
 * og event-strømmen dekodes med AWS sine nettleservennlige moduler.
 */
import { SignatureV4 } from "@smithy/signature-v4"
import { Sha256 } from "@aws-crypto/sha256-js"
import { EventStreamCodec } from "@smithy/eventstream-codec"
import { fromUtf8, toUtf8 } from "@smithy/util-utf8"
import type { AiForesporsel } from "@/lib/ai-foresporsler"
import type { StagingOverrides } from "@/lib/staging-bygg"

export interface AiOppsett {
  modell: string
  region: string
  overrides: StagingOverrides
  legitimasjon: { accessKeyId: string; secretAccessKey: string; sessionToken: string; utloper: number }
}

export interface AiForbruk {
  inputTokens: number
  outputTokens: number
  cacheLesTokens: number
  cacheSkrivTokens: number
}

/** Funksjonene som logges i bruksstatistikken. */
export type AiFunksjon = "notat" | "chat" | "aihjelp" | "promptbygger" | "verktoyforslag"

// ─── Oppsett (nøkler hentes på nytt 5 min før de utløper) ────────────────────

let oppsett: Promise<AiOppsett> | null = null
let oppsettUtloper = 0

async function lastOppsett(): Promise<AiOppsett> {
  const res = await fetch("/api/ai/oppsett", { cache: "no-store", credentials: "same-origin" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.feil ?? `Kunne ikke hente AI-tilgang (${res.status})`)
  return { ...data, overrides: new Map(Object.entries(data.overrides ?? {})) } as AiOppsett
}

export async function hentAiOppsett(): Promise<AiOppsett> {
  if (!oppsett || Date.now() > oppsettUtloper - 5 * 60_000) {
    oppsett = lastOppsett()
    oppsett.then(
      (o) => { oppsettUtloper = o.legitimasjon.utloper },
      () => { oppsett = null }
    )
  }
  return oppsett
}

// ─── Signering ────────────────────────────────────────────────────────────────

async function signertForesporsel(o: AiOppsett, handling: "invoke" | "invoke-with-response-stream", body: string) {
  const hostname = `bedrock-runtime.${o.region}.amazonaws.com`
  const path = `/model/${encodeURIComponent(o.modell)}/${handling}`
  const signer = new SignatureV4({
    service: "bedrock",
    region: o.region,
    sha256: Sha256,
    credentials: {
      accessKeyId: o.legitimasjon.accessKeyId,
      secretAccessKey: o.legitimasjon.secretAccessKey,
      sessionToken: o.legitimasjon.sessionToken,
    },
  })
  const signert = await signer.sign({
    method: "POST",
    protocol: "https:",
    hostname,
    path,
    headers: {
      host: hostname,
      "content-type": "application/json",
      accept: handling === "invoke" ? "application/json" : "application/vnd.amazon.eventstream",
    },
    body,
  })
  const headers = { ...signert.headers }
  delete headers.host // nettleseren setter Host selv og nekter å la oss gjøre det
  return { url: `https://${hostname}${path}`, headers }
}

function bedrockBody(f: AiForesporsel): string {
  return JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: f.maxTokens,
    system: f.system,
    messages: f.messages,
  })
}

async function feilFraSvar(res: Response): Promise<Error> {
  const data = await res.json().catch(() => ({}))
  const melding = data.message ?? data.Message ?? res.headers.get("x-amzn-ErrorMessage") ?? ""
  if (res.status === 403) return new Error(`Ingen tilgang til AI-modellen (${melding || "403"})`)
  if (res.status === 429) return new Error("For mange forespørsler til AI-tjenesten. Vent litt og prøv igjen.")
  return new Error(`AI-feil ${res.status}${melding ? `: ${melding}` : ""}`)
}

// ─── Forbruksrapportering (kun tall, aldri innhold) ──────────────────────────

function rapporterForbruk(funksjon: AiFunksjon, modell: string, f: AiForbruk): void {
  void fetch("/api/bruk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ tjeneste: "BEDROCK", funksjon, modell, ...f }),
  }).catch(() => { /* statistikk skal aldri velte selve arbeidet */ })
}

function tomtForbruk(): AiForbruk {
  return { inputTokens: 0, outputTokens: 0, cacheLesTokens: 0, cacheSkrivTokens: 0 }
}

// ─── Kall ─────────────────────────────────────────────────────────────────────

/** Ett kall uten strømming (verktøyforslag). Returnerer hele svarteksten. */
export async function sendTilClaude(f: AiForesporsel, funksjon: AiFunksjon, signal?: AbortSignal): Promise<string> {
  const o = await hentAiOppsett()
  const body = bedrockBody(f)
  const { url, headers } = await signertForesporsel(o, "invoke", body)
  const res = await fetch(url, { method: "POST", headers, body, signal })
  if (!res.ok) throw await feilFraSvar(res)
  const data = await res.json()
  const u = data.usage ?? {}
  rapporterForbruk(funksjon, o.modell, {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheLesTokens: u.cache_read_input_tokens ?? 0,
    cacheSkrivTokens: u.cache_creation_input_tokens ?? 0,
  })
  return (data.content ?? []).map((b: { type: string; text?: string }) => (b.type === "text" ? b.text : "")).join("")
}

/**
 * Strømmer svaret. `onDelta` får hvert tekstfragment; returnerer hele teksten.
 * Forbruk leses fra Bedrocks egne invocation-metrics i siste hendelse.
 */
export async function strommFraClaude(
  f: AiForesporsel,
  funksjon: AiFunksjon,
  onDelta: (tekst: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const o = await hentAiOppsett()
  const body = bedrockBody(f)
  const { url, headers } = await signertForesporsel(o, "invoke-with-response-stream", body)
  const res = await fetch(url, { method: "POST", headers, body, signal })
  if (!res.ok) throw await feilFraSvar(res)
  if (!res.body) throw new Error("Ingen datastrøm fra AI-tjenesten")

  const codec = new EventStreamCodec(toUtf8, fromUtf8)
  const leser = res.body.getReader()
  const forbruk = tomtForbruk()
  let buffer = new Uint8Array(0)
  let tekst = ""

  const behandle = (hendelse: Record<string, unknown>) => {
    switch (hendelse.type) {
      case "message_start": {
        const u = (hendelse.message as { usage?: Record<string, number> })?.usage ?? {}
        forbruk.inputTokens = u.input_tokens ?? 0
        forbruk.cacheLesTokens = u.cache_read_input_tokens ?? 0
        forbruk.cacheSkrivTokens = u.cache_creation_input_tokens ?? 0
        break
      }
      case "content_block_delta": {
        const d = hendelse.delta as { type?: string; text?: string }
        if (d?.type === "text_delta" && d.text) {
          tekst += d.text
          onDelta(d.text)
        }
        break
      }
      case "message_delta": {
        const u = (hendelse.usage as Record<string, number>) ?? {}
        if (u.output_tokens) forbruk.outputTokens = u.output_tokens
        break
      }
      case "message_stop": {
        const m = hendelse["amazon-bedrock-invocationMetrics"] as Record<string, number> | undefined
        if (m) {
          forbruk.inputTokens = m.inputTokenCount ?? forbruk.inputTokens
          forbruk.outputTokens = m.outputTokenCount ?? forbruk.outputTokens
        }
        break
      }
    }
  }

  while (true) {
    const { done, value } = await leser.read()
    if (done) break
    const samlet = new Uint8Array(buffer.length + value.length)
    samlet.set(buffer)
    samlet.set(value, buffer.length)
    buffer = samlet

    // En event-stream-melding starter med sin egen totale lengde (4 byte, big-endian)
    while (buffer.length >= 4) {
      const lengde = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0)
      if (buffer.length < lengde) break
      const melding = codec.decode(buffer.subarray(0, lengde))
      buffer = buffer.slice(lengde)

      const meldingstype = melding.headers[":message-type"]?.value
      const nyttelast = JSON.parse(toUtf8(melding.body))
      if (meldingstype === "exception" || meldingstype === "error") {
        throw new Error(`AI-feil: ${nyttelast.message ?? melding.headers[":exception-type"]?.value ?? "ukjent"}`)
      }
      if (nyttelast.bytes) {
        behandle(JSON.parse(toUtf8(Uint8Array.from(atob(nyttelast.bytes), (c) => c.charCodeAt(0)))))
      }
    }
  }

  rapporterForbruk(funksjon, o.modell, forbruk)
  return tekst
}
