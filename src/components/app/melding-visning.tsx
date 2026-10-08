"use client"

import { useState, useTransition } from "react"
import { Megaphone } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/dpa/markdown"
import { markerMeldingLest } from "@/actions/meldinger"

export interface UlestMelding {
  id: string
  tittel: string
  innhold: string
  publisertAt: string // ISO
}

/**
 * Viser uleste meldinger fra admin, én om gangen (eldste først), som en stor
 * modal øverst i bildet. Kan ikke lukkes med Esc, klikk utenfor eller kryss —
 * brukeren må trykke «Jeg har lest», som lagres på serveren.
 */
export function MeldingVisning({ meldinger }: { meldinger: UlestMelding[] }) {
  const [ko, setKo] = useState(meldinger)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, startLagring] = useTransition()

  const melding = ko[0]
  if (!melding) return null

  function bekreft() {
    setFeil(null)
    startLagring(async () => {
      const { ok } = await markerMeldingLest(melding.id)
      if (ok) setKo((rest) => rest.slice(1))
      else setFeil("Kunne ikke lagre at meldingen er lest. Prøv igjen.")
    })
  }

  const dato = new Date(melding.publisertAt).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Dialog open disablePointerDismissal onOpenChange={() => { /* lukkes kun via «Jeg har lest» */ }}>
      <DialogContent
        showCloseButton={false}
        className="top-8 translate-y-0 sm:max-w-2xl max-h-[calc(100vh-4rem)] overflow-y-auto p-0 gap-0 data-open:slide-in-from-top-4"
      >
        <div className="flex items-start gap-3 border-b border-slate-200 bg-blue-50 px-6 py-4 rounded-t-xl">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {melding.tittel}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Melding fra administrator · {dato}
              {ko.length > 1 && ` · ${ko.length - 1} melding${ko.length > 2 ? "er" : ""} til`}
            </p>
          </div>
        </div>

        <div className="px-6 py-2">
          <Markdown>{melding.innhold}</Markdown>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 rounded-b-xl">
          {feil && <p className="text-xs text-red-600 mr-auto">{feil}</p>}
          <Button onClick={bekreft} disabled={lagrer} className="bg-blue-600 hover:bg-blue-700">
            {lagrer ? "Lagrer…" : "Jeg har lest"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
