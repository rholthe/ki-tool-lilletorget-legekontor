"use client"

import { useState } from "react"
import { BookOpen, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Veiledning } from "@/lib/verktoy/typer"

/**
 * Full veiledning for et verktøy eller et enkelt skåringspunkt.
 *
 * Skjemaet viser bare én kort `hjelp`-linje per punkt — alt som er lengre enn det
 * havner her, bak en lenke, slik at skjemaet holder seg utfyllbart. Blokkene er
 * deklarative (se `Veiledning` i `lib/verktoy/typer.ts`), så admin senere kan
 * bygge veiledninger fra frontend uten å skrive markup.
 */
function VeiledningInnhold({ veiledning }: { veiledning: Veiledning }) {
  return (
    <div className="space-y-4">
      {veiledning.blokker.map((blokk, i) => {
        switch (blokk.type) {
          case "overskrift":
            return (
              <h3
                key={i}
                className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1"
              >
                {blokk.tekst}
              </h3>
            )

          case "avsnitt":
            return (
              <p key={i} className="text-sm text-slate-700 leading-relaxed">
                {blokk.tekst}
              </p>
            )

          case "punkter":
            return (
              <ul key={i} className="space-y-1.5">
                {blokk.punkter.map((punkt, j) => (
                  <li key={j} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="text-slate-300 shrink-0 select-none">•</span>
                    <span>{punkt}</span>
                  </li>
                ))}
              </ul>
            )

          case "lenke":
            return (
              <a
                key={i}
                href={blokk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                {blokk.tekst}
              </a>
            )

          case "tabell":
            return (
              <div key={i} className="space-y-1.5">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        {blokk.kolonner.map((kolonne, j) => (
                          <th
                            key={j}
                            className="text-left font-medium text-slate-600 px-3 py-2 border-b border-slate-200 whitespace-nowrap"
                          >
                            {kolonne}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {blokk.rader.map((rad, j) => (
                        <tr key={j} className="border-b border-slate-100 last:border-0">
                          {rad.map((celle, k) => (
                            <td
                              key={k}
                              className={`px-3 py-1.5 ${
                                k === 0
                                  ? "text-slate-700"
                                  : "text-slate-600 tabular-nums whitespace-nowrap"
                              }`}
                            >
                              {celle}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {blokk.fotnote && (
                  <p className="text-xs text-slate-400 italic">{blokk.fotnote}</p>
                )}
              </div>
            )
        }
      })}
    </div>
  )
}

interface Props {
  veiledning: Veiledning
  /** Etikett på lenken. Standard «Vis veiledning». */
  etikett?: string
}

/** Diskret lenke som åpner veiledningen i egen modal. */
export function VeiledningLenke({ veiledning, etikett = "Vis veiledning" }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
      >
        <BookOpen className="w-3 h-3" />
        {etikett}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3.5 border-b border-slate-200 shrink-0">
            <DialogTitle className="text-base">{veiledning.tittel}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <VeiledningInnhold veiledning={veiledning} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
