"use client"

import { useCallback, useEffect, useRef } from "react"
import { Mic, Loader2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMikrofon } from "@/hooks/use-mikrofon"
import { useDiktering } from "@/hooks/use-diktering"
import { cn } from "@/lib/utils"

interface Props {
  /** Gjeldende tekst i feltet */
  tekst: string
  /** Kalles med ny tekst når diktert tekst settes inn */
  onTekst: (ny: string) => void
  /** Ref til tekstfeltet — brukes for å lese markørposisjon */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  disabled?: boolean
  className?: string
}

/**
 * Lite mikrofonikon som dikterer tekst rett inn i et tekstfelt via Soniox.
 * Står markøren i feltet settes teksten inn der; ellers legges den til på slutten.
 */
export function DikteringKnapp({ tekst, onTekst, textareaRef, disabled, className }: Props) {
  const { valgtId } = useMikrofon()

  // Ferskeste tekstverdi, tilgjengelig inne i Soniox-callbacken.
  const tekstRef = useRef(tekst)
  useEffect(() => {
    tekstRef.current = tekst
  }, [tekst])

  // Tilstand for én dikteringsøkt: tekst rundt innsettingspunktet (fast),
  // pluss ferdigstilt tekst som vokser. Foreløpig tekst vises i tillegg, men
  // er ikke en del av det som lagres permanent før den blir endelig.
  const prefiksRef = useRef("")
  const suffiksRef = useRef("")
  const ferdigRef = useRef("")
  const onTekstRef = useRef(onTekst)
  useEffect(() => {
    onTekstRef.current = onTekst
  }, [onTekst])

  // Bygg feltverdien: prefiks + (mellomrom) + diktert tekst + suffiks
  const byggVerdi = useCallback((diktert: string) => {
    const prefiks = prefiksRef.current
    let d = diktert
    if (d) {
      const fore = prefiks.charAt(prefiks.length - 1)
      // Mellomrom mellom eksisterende tekst og første dikterte ord
      if (prefiks && fore && !/\s/.test(fore) && !/^\s/.test(d)) {
        d = " " + d
      }
    }
    return prefiks + d + suffiksRef.current
  }, [])

  const håndterOppdatering = useCallback(
    (finalDelta: string, partial: string) => {
      ferdigRef.current += finalDelta
      onTekstRef.current(byggVerdi(ferdigRef.current + partial))
    },
    [byggVerdi]
  )

  const { status, start, stopp } = useDiktering({
    mikofonId: valgtId,
    onOppdatering: håndterOppdatering,
  })

  const lytter = status === "lytter" || status === "kobler"

  const toggle = useCallback(() => {
    if (lytter) {
      // Forkast eventuell gjenværende foreløpig tekst, behold ferdigstilt
      onTekstRef.current(byggVerdi(ferdigRef.current))
      stopp()
      return
    }
    // Bestem innsettingspunkt: markør i feltet → der, ellers slutten
    const t = tekstRef.current
    const ta = textareaRef.current
    const off =
      ta && document.activeElement === ta
        ? ta.selectionStart ?? t.length
        : t.length
    prefiksRef.current = t.slice(0, off)
    suffiksRef.current = t.slice(off)
    ferdigRef.current = ""
    start()
  }, [lytter, start, stopp, byggVerdi, textareaRef])

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <button
          type="button"
          // Hindre at knappen tar fokus fra tekstfeltet, så markørposisjonen bevares
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggle}
          disabled={disabled}
          aria-label={lytter ? "Stopp diktering" : "Diktér tekst"}
          aria-pressed={lytter}
          className={cn(
            "inline-flex items-center justify-center rounded-md p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
            lytter
              ? "text-red-600 bg-red-50 hover:bg-red-100"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
            className
          )}
        >
          {status === "kobler" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mic className={cn("w-4 h-4", status === "lytter" && "animate-pulse")} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {lytter ? "Stopp diktering" : "Diktér tekst inn i feltet"}
      </TooltipContent>
    </Tooltip>
  )
}
