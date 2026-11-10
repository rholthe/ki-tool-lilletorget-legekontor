"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Check, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { delNotatIJournalfelt } from "@/lib/journal-eksport"
import {
  finnJournalNotater,
  fyllJournalNotat,
  useJournalUtvidelse,
  type JournalModus,
  type JournalNotat,
  type JournalSvar,
} from "@/hooks/use-journal-utvidelse"

/** Eldste utvidelsesversjon som kan finne flere notater og velge mellom dem. */
const MIN_VERSJON = [1, 1]

function erForeldet(versjon: string | null): boolean {
  if (!versjon) return false
  const [hoved = 0, minor = 0] = versjon.split(".").map(Number)
  return hoved < MIN_VERSJON[0] || (hoved === MIN_VERSJON[0] && minor < MIN_VERSJON[1])
}

function pasientTekst(n: JournalNotat): string {
  const navn = n.navn ?? "ukjent pasient"
  return n.fodt ? `${navn} (født ${n.fodt})` : navn
}

type Melding = { type: "ok" | "info" | "feil"; tekst: string }

/** Hvor lenge meldingen står før den forsvinner. Feil og info er lengre tekster. */
const VISNINGSTID_MS: Record<Melding["type"], number> = { ok: 5000, info: 8000, feil: 8000 }

/**
 * «Send til journal»: legger notatet inn i et åpent notat i Pridok via
 * nettleserutvidelsen. Er flere notater åpne (i én eller flere faner), velger legen
 * hvilket, med pasientens navn og fødselsdato fra Pridok. Vises bare når utvidelsen
 * er installert. Pasientnavnet finnes bare i minnet her og sendes ingen steder.
 */
export function SendTilJournal({ notat, disabled }: { notat?: string; disabled: boolean }) {
  const { installert, versjon } = useJournalUtvidelse()
  const [sender, setSender] = useState(false)
  const [melding, setMelding] = useState<Melding | null>(null)
  const [valg, setValg] = useState<JournalNotat[] | null>(null)
  const [bekreft, setBekreft] = useState<JournalNotat | null>(null)
  const [holdes, setHoldes] = useState(false)

  // Forsvinner av seg selv; står så lenge musepekeren er over den.
  useEffect(() => {
    if (!melding || holdes) return
    const t = setTimeout(() => setMelding(null), VISNINGSTID_MS[melding.type])
    return () => clearTimeout(t)
  }, [melding, holdes])

  if (!installert) return null

  const flereFaner = new Set(valg?.map((n) => n.tabId)).size > 1

  async function start() {
    if (!notat) return
    setMelding(null)
    if (erForeldet(versjon)) {
      setMelding({
        type: "feil",
        tekst: `Nettleserutvidelsen (versjon ${versjon}) må oppdateres for å kunne velge mellom flere åpne notater.`,
      })
      return
    }
    setSender(true)
    const svar = await finnJournalNotater()
    setSender(false)
    if (!svar.ok) {
      setMelding({ type: "feil", tekst: `Kunne ikke sende til journal${svar.melding ? `: ${svar.melding}` : "."}` })
      return
    }
    if (svar.notater.length === 0) {
      setMelding({
        type: "feil",
        tekst:
          svar.antallFaner === 0
            ? "Fant ingen åpen Pridok-fane (epj3.pridok.no). Åpne dagsnotatet til pasienten og prøv igjen."
            : svar.laaste > 0
              ? "Notatet som er åpent i Pridok er låst. Åpne et nytt dagsnotat og prøv igjen."
              : "Fant ingen åpne dagsnotater i Pridok. Åpne et dagsnotat og prøv igjen.",
      })
      return
    }
    if (svar.notater.length === 1) velg(svar.notater[0])
    else setValg(svar.notater)
  }

  function velg(n: JournalNotat) {
    setValg(null)
    if (n.harInnhold.length) setBekreft(n)
    else void fyll(n, "tom")
  }

  async function fyll(n: JournalNotat, modus: JournalModus) {
    if (!notat) return
    setBekreft(null)
    setSender(true)
    const { seksjoner, fantOverskrifter } = delNotatIJournalfelt(notat)
    const svar = await fyllJournalNotat(n, seksjoner, modus)
    setSender(false)
    if (svar.ok) {
      setMelding({
        type: fantOverskrifter ? "ok" : "info",
        tekst:
          `Lagt inn i ${n.tittel.toLowerCase()} for ${pasientTekst(n)}. Se over teksten i Pridok.` +
          (fantOverskrifter
            ? ""
            : " Notatet hadde ikke overskriftene ANAMNESE, UNDERSØKELSE, VURDERING og TILTAK, så hele teksten ligger i Anamnese."),
      })
      return
    }
    if (svar.grunn === "har-innhold") {
      setBekreft({ ...n, harInnhold: svar.felt ?? n.harInnhold })
      return
    }
    setMelding({ type: "feil", tekst: feiltekst(svar) })
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <Button
            size="sm"
            className="gap-1.5 text-sm bg-sky-700 hover:bg-sky-800"
            disabled={disabled || sender}
            onClick={start}
          >
            <Send className="w-4 h-4" />
            {sender ? "Sender…" : "Send til journal"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Fyller Anamnese, Funn, Vurdering og Tiltak til dagsnotat i Pridok
        </TooltipContent>
      </Tooltip>

      {melding && (
        <div
          role="status"
          onMouseEnter={() => setHoldes(true)}
          onMouseLeave={() => setHoldes(false)}
          className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${
            melding.type === "feil"
              ? "border-red-200 bg-red-50 text-red-700"
              : melding.type === "info"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {melding.type === "ok" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{melding.tekst}</span>
          <button
            type="button"
            className="shrink-0 text-xs underline-offset-2 hover:underline"
            onClick={() => {
              setMelding(null)
              setHoldes(false)
            }}
          >
            Lukk
          </button>
        </div>
      )}

      {/* Flere åpne notater: velg hvilket */}
      <Dialog open={valg !== null} onOpenChange={(open) => { if (!open) setValg(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hvilket notat skal teksten inn i?</DialogTitle>
            <DialogDescription>
              Det er {valg?.length} notater åpne i Pridok. Sjekk at pasienten stemmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {valg?.map((n) => (
              <button
                key={`${n.tabId}:${n.dokId}`}
                type="button"
                onClick={() => velg(n)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="font-medium text-slate-800">
                  {n.navn ?? "Ukjent pasient"}
                  {n.fodt && <span className="font-normal text-slate-500"> · født {n.fodt}</span>}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {n.tittel}
                  {flereFaner && ` · Pridok-fane ${n.fane}`}
                  {n.harInnhold.length > 0 ? (
                    <span className="text-amber-700"> · har tekst i {n.harInnhold.join(", ")}</span>
                  ) : (
                    " · tomt"
                  )}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValg(null)}>
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notatet har allerede tekst */}
      <Dialog open={bekreft !== null} onOpenChange={(open) => { if (!open) setBekreft(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notatet har allerede tekst</DialogTitle>
            <DialogDescription>
              {bekreft && (
                <>
                  {bekreft.tittel} for {pasientTekst(bekreft)} har allerede tekst i{" "}
                  {bekreft.harInnhold.join(", ")}. Vil du legge notatet til under det som står der, eller
                  erstatte teksten?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBekreft(null)}>
              Avbryt
            </Button>
            <Button variant="outline" onClick={() => bekreft && fyll(bekreft, "erstatt")}>
              Erstatt
            </Button>
            <Button className="bg-sky-700 hover:bg-sky-800" onClick={() => bekreft && fyll(bekreft, "legg-til")}>
              Legg til under
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function feiltekst(svar: Extract<JournalSvar, { ok: false }>): string {
  switch (svar.grunn) {
    case "ingen-fane":
      return "Pridok-fanen er lukket. Åpne dagsnotatet og prøv igjen."
    case "fant-ikke-felt":
      return "Fant ikke notatet i Pridok lenger. Er det lukket? Prøv igjen."
    default:
      return `Kunne ikke sende til journal${svar.melding ? `: ${svar.melding}` : "."}`
  }
}
