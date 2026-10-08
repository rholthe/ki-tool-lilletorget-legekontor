/**
 * Måler forbruket i én Soniox-økt (fra start til stopp/pause/feil) og
 * rapporterer det én gang til /api/bruk. Bare tall sendes: behandlet lydtid
 * (Soniox sitt eget `total_audio_proc_ms`) og antall transkriberte tegn —
 * aldri lyd eller tekst.
 */
export type SonioxFunksjon = "transkribering" | "diktering"

export interface SonioxMaaler {
  oppdater(result: { total_audio_proc_ms?: number; tokens: Array<{ text: string; is_final: boolean }> }): void
  /** Rapporter nå (feil, pause, avbrudd). */
  avslutt(): void
  /** Vent litt på siste resultat etter stopp, rapporter så. */
  avsluttSnart(): void
}

const SPESIALTOKEN = /^<[^>]+>$/

export function lagSonioxMaaler(funksjon: SonioxFunksjon, modell = "stt-rt-v5"): SonioxMaaler {
  let lydMs = 0
  let antallTegn = 0
  let ferdig = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const avslutt = () => {
    if (ferdig) return
    ferdig = true
    if (timer) clearTimeout(timer)
    window.removeEventListener("pagehide", avslutt)
    if (lydMs <= 0) return
    void fetch("/api/bruk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true, // overlever at fanen lukkes
      body: JSON.stringify({ tjeneste: "SONIOX", funksjon, modell, lydMs: Math.round(lydMs), antallTegn }),
    }).catch(() => { /* statistikk skal aldri velte opptaket */ })
  }

  window.addEventListener("pagehide", avslutt)

  return {
    oppdater(result) {
      if (ferdig) return
      if (typeof result.total_audio_proc_ms === "number") lydMs = Math.max(lydMs, result.total_audio_proc_ms)
      for (const t of result.tokens) if (t.is_final && t.text && !SPESIALTOKEN.test(t.text)) antallTegn += t.text.length
    },
    avslutt,
    avsluttSnart() {
      if (ferdig || timer) return
      timer = setTimeout(avslutt, 5000)
    },
  }
}
