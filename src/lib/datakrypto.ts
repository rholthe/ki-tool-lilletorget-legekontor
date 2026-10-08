/**
 * Kryptering av konsultasjoner i nettleseren (AES-256-GCM via WebCrypto).
 *
 * Nøkkelen hentes fra /api/datanokkel etter innlogging og holdes bare i minnet
 * som en ikke-eksporterbar CryptoKey. Ved utlogging, inaktivitet eller lukket
 * nettleser lastes siden på nytt eller lukkes, og nøkkelen er borte: dataene i
 * IndexedDB er da låst til brukeren logger inn igjen.
 */

export interface DataKontekst {
  userId: string
  nokkel: CryptoKey
}

export interface Kryptert {
  iv: Uint8Array<ArrayBuffer>
  chiffer: ArrayBuffer
}

let kontekst: Promise<DataKontekst> | null = null

async function lastKontekst(): Promise<DataKontekst> {
  const res = await fetch("/api/datanokkel", { cache: "no-store", credentials: "same-origin" })
  if (!res.ok) throw new Error(`Kunne ikke hente datanøkkel (${res.status})`)
  const { userId, nokkel } = (await res.json()) as { userId: string; nokkel: string }
  const raa = Uint8Array.from(atob(nokkel), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey("raw", raa, "AES-GCM", false, ["encrypt", "decrypt"])
  raa.fill(0)
  return { userId, nokkel: cryptoKey }
}

/** Nøkkel og bruker-id for innlogget bruker. Hentes én gang per sidelasting. */
export function hentDataKontekst(): Promise<DataKontekst> {
  if (!kontekst) {
    kontekst = lastKontekst().catch((e) => {
      kontekst = null // prøv igjen neste gang
      throw e
    })
  }
  return kontekst
}

const enkoder = new TextEncoder()
const dekoder = new TextDecoder()

export async function krypter(verdi: unknown, nokkel: CryptoKey): Promise<Kryptert> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const chiffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    nokkel,
    enkoder.encode(JSON.stringify(verdi))
  )
  return { iv, chiffer }
}

export async function dekrypter<T>(data: Kryptert, nokkel: CryptoKey): Promise<T> {
  const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.iv }, nokkel, data.chiffer)
  return JSON.parse(dekoder.decode(klar)) as T
}
