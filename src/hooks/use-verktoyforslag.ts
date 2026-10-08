"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useKonsultasjon } from "@/hooks/use-konsultasjon"
import type { VerktoyForslag } from "@/types/konsultasjon"
import { hentAiOppsett, sendTilClaude } from "@/lib/bedrock-nettleser"
import { byggVerktoyforslagForesporsel, lesVerktoyforslag } from "@/lib/ai-foresporsler"

/**
 * AI-forslag om hvilke kliniske verktøy legen bør åpne.
 *
 * Forslagene lagres på konsultasjonen (IndexedDB) sammen med et avtrykk av
 * teksten de ble laget fra. Det gjør at modalen kan åpnes og lukkes fritt uten
 * å fyre av et nytt Bedrock-kall — kallet gjentas først når transkriptet,
 * konteksten eller tilleggsinfoen faktisk har endret seg.
 *
 * Nøkkelordforslagene i `sok.ts` er umiddelbare og krever ingen nettverkskall.
 * Dette er et supplement som fanger opp det nøkkelord ikke ser: «tungpustet,
 * blek og forvirret» nevner verken sepsis eller qSOFA.
 */

/** Under dette er det for lite tekst til at et forslag blir meningsfullt. */
const MINSTE_ORD = 15

/** Ventetid etter siste endring i kildeteksten før forslagene hentes. */
const FORSINKELSE_MS = 800

function ordTeller(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Billig avtrykk av kildeteksten. Kollisjoner er ufarlige her — verste utfall er
 * at et forslag står litt for lenge før det oppdateres.
 */
function avtrykk(tekst: string): string {
  let h = 5381
  for (let i = 0; i < tekst.length; i++) h = ((h << 5) + h + tekst.charCodeAt(i)) | 0
  return `${tekst.length}:${(h >>> 0).toString(36)}`
}

export function useVerktoyForslag() {
  const { aktiv, oppdater } = useKonsultasjon()
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  // Hindrer at to samtidige kall (rask åpne/lukke) begge skriver til basen
  const pågår = useRef<string | null>(null)

  const kildetekst = [aktiv?.transkript, aktiv?.kontekst, aktiv?.tilleggsinfo]
    .filter(Boolean)
    .join("\n\n")

  const nokTekst = ordTeller(kildetekst) >= MINSTE_ORD
  const nåværendeAvtrykk = nokTekst ? avtrykk(kildetekst) : ""
  const lagret = aktiv?.verktoyForslag
  const erFersk = Boolean(lagret && lagret.avtrykk === nåværendeAvtrykk)

  const hent = useCallback(async () => {
    if (!aktiv || !nokTekst) return
    if (pågår.current === nåværendeAvtrykk) return

    pågår.current = nåværendeAvtrykk
    setLaster(true)
    setFeil(null)

    try {
      // Direkte til Bedrock fra nettleseren; kandidatlisten validerer svaret
      const { overrides } = await hentAiOppsett()
      const foresporsel = byggVerktoyforslagForesporsel(
        {
          transkript: aktiv.transkript ?? "",
          kontekst: aktiv.kontekst ?? "",
          tilleggsinfo: aktiv.tilleggsinfo ?? "",
        },
        overrides
      )
      const forslag: VerktoyForslag[] = foresporsel
        ? lesVerktoyforslag(await sendTilClaude(foresporsel, "verktoyforslag"), foresporsel.gyldige)
        : []

      await oppdater({
        verktoyForslag: {
          forslag,
          avtrykk: nåværendeAvtrykk,
          hentetAt: Date.now(),
        },
      })
    } catch {
      setFeil("Kunne ikke hente forslag")
    } finally {
      pågår.current = null
      setLaster(false)
    }
  }, [aktiv, nokTekst, nåværendeAvtrykk, oppdater])

  /**
   * Hent automatisk når innholdet har endret seg siden forrige gang.
   *
   * Debouncen er ikke kosmetikk: `kontekst` og `tilleggsinfo` er tekstfelt legen
   * skriver i, så avtrykket endres på hvert tastetrykk. Uten forsinkelsen ville
   * hver bokstav utløst et nytt Bedrock-kall.
   *
   * `hent` og `laster` er bevisst utelatt fra dependencies: effekten skal kun
   * reagere på at kildeteksten er ny, ikke på at hooken har rendret på nytt.
   */
  useEffect(() => {
    if (!nokTekst || erFersk || laster) return
    const timer = setTimeout(() => void hent(), FORSINKELSE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nåværendeAvtrykk, erFersk, nokTekst])

  return {
    forslag: erFersk ? (lagret?.forslag ?? []) : [],
    laster,
    feil,
    /** Nok tekst til at AI-forslag er meningsfullt i det hele tatt. */
    tilgjengelig: nokTekst,
    oppdaterForslag: hent,
  }
}
