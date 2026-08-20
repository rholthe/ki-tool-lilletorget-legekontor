"use client"

import type { KalkulatorResultat } from "@/lib/verktoy/typer"

/**
 * Kalkulatorens utdata. Til forskjell fra et skåringsverktøy er det flere
 * verdier samtidig, og ingen av dem har et tolkningsbånd — derfor en egen,
 * nøktern visning i stedet for det fargekodede resultatkortet.
 */
export function KalkulatorVisning({ resultat }: { resultat: KalkulatorResultat }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-200">
      {resultat.linjer.map((linje, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 px-3 py-2">
          <span className="text-sm text-slate-600 min-w-0">{linje.etikett}</span>
          <span className="text-right shrink-0">
            <span
              className={
                linje.uthevet
                  ? "text-base font-semibold text-slate-900 tabular-nums"
                  : "text-sm text-slate-700 tabular-nums"
              }
            >
              {linje.verdi}
            </span>
            {linje.merknad && (
              <span className="block text-xs text-slate-400">{linje.merknad}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
