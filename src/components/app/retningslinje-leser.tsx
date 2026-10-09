"use client"

import { useEffect, useRef } from "react"
import { AlertTriangle, ExternalLink, Info, Loader2 } from "lucide-react"
import type { LeseEnhet, LeseKapittel, LeseRetningslinje } from "@/lib/verktoy/typer"
import { HENTING_ADVARSEL_DAGER, dagerSidenHentet, norskDato } from "@/lib/verktoy/retningslinje"
import { useLeseRetningslinje } from "@/hooks/use-retningslinjer"
import { KildeTekst } from "@/components/app/retningslinje-visning"

interface Props {
  /** Innholdsfortegnelsen — brødteksten lastes her. */
  retningslinje: LeseRetningslinje
  enhetId: string
  onVelg: (enhet: LeseEnhet, kapittel: string) => void
}

function finnEnhet(kapitler: LeseKapittel[], enheter: LeseEnhet[], id: string): LeseEnhet | undefined {
  const direkte = enheter.find((e) => e.id === id)
  if (direkte) return direkte
  for (const k of kapitler) {
    const funnet = finnEnhet(k.kapitler, k.enheter, id)
    if (funnet) return funnet
  }
  return undefined
}

function Styrke({ styrke }: { styrke: string }) {
  const sterk = /sterk/i.test(styrke)
  return (
    <span
      className={`inline-block text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${
        sterk ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}
    >
      {styrke}
    </span>
  )
}

/** Innholdsfortegnelse. Et kapittel med egen tekst er selv klikkbart. */
function Fortegnelse({
  kapitler,
  enhetId,
  onVelg,
  dybde = 0,
}: {
  kapitler: LeseKapittel[]
  enhetId: string
  onVelg: Props["onVelg"]
  dybde?: number
}) {
  return (
    <ul className={dybde > 0 ? "ml-2 pl-2 border-l border-slate-100" : ""}>
      {kapitler.map((k) => {
        const egenTekst = k.enheter.find((e) => e.erKapitteltekst)
        const andre = k.enheter.filter((e) => !e.erKapitteltekst)
        const aktivKapittel = egenTekst?.id === enhetId
        return (
          <li key={k.id} className="mt-2 first:mt-0">
            {egenTekst ? (
              <button
                data-aktiv={aktivKapittel || undefined}
                onClick={() => onVelg(egenTekst, k.tittel)}
                className={`w-full text-left text-xs font-semibold px-2 py-1 rounded ${
                  aktivKapittel ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {k.tittel}
              </button>
            ) : (
              <p className="text-xs font-semibold text-slate-500 px-2 py-1">{k.tittel}</p>
            )}
            {andre.length > 0 && (
              <ul>
                {andre.map((e) => (
                  <li key={e.id}>
                    <button
                      data-aktiv={e.id === enhetId || undefined}
                      onClick={() => onVelg(e, k.tittel)}
                      className={`w-full text-left text-xs px-2 py-1 rounded leading-snug ${
                        e.id === enhetId ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {e.tittel}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {k.kapitler.length > 0 && (
              <Fortegnelse kapitler={k.kapitler} enhetId={enhetId} onVelg={onVelg} dybde={dybde + 1} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Oppslag i en nasjonal faglig retningslinje. Alt er kildens tekst, ordrett;
 * vi har bare gjort HTML om til Markdown. Kilden står øverst i samme størrelse
 * som innholdet (NLOD).
 */
export function RetningslinjeLeser({ retningslinje, enhetId, onVelg }: Props) {
  const { full, laster, feil } = useLeseRetningslinje(retningslinje.id)
  const indeksEnhet = finnEnhet(retningslinje.kapitler, retningslinje.enheter, enhetId)
  const enhet = full ? finnEnhet(full.kapitler, full.enheter, enhetId) : undefined
  const vis = enhet ?? indeksEnhet

  const navRef = useRef<HTMLDivElement>(null)
  const innholdRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    innholdRef.current?.scrollTo({ top: 0 })
    navRef.current?.querySelector("[data-aktiv]")?.scrollIntoView({ block: "nearest" })
  }, [enhetId])

  const foreldet = dagerSidenHentet(retningslinje) > HENTING_ADVARSEL_DAGER

  return (
    <div className="flex h-full min-h-0">
      <nav
        ref={navRef}
        className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto p-3"
        aria-label="Innholdsfortegnelse"
      >
        {retningslinje.enheter.length > 0 && (
          <ul className="mb-2">
            {retningslinje.enheter.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onVelg(e, "")}
                  className={`w-full text-left text-xs px-2 py-1 rounded ${
                    e.id === enhetId ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {e.tittel}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Fortegnelse kapitler={retningslinje.kapitler} enhetId={enhetId} onVelg={onVelg} />
      </nav>

      <div ref={innholdRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm text-slate-700">
            Kilde: Helsedirektoratet — {retningslinje.navn}
          </p>

          <div
            className={`rounded-lg border px-3 py-2 flex items-start gap-2 text-xs ${
              foreldet ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {foreldet ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
            ) : (
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
            )}
            <div className="flex-1 space-y-1">
              <p>
                {foreldet
                  ? `Sist hentet fra Helsedirektoratet ${norskDato(retningslinje.hentetAt)} og kan være utdatert — sjekk kilden.`
                  : `Hentet fra Helsedirektoratet ${norskDato(retningslinje.hentetAt)}.`}
                {vis && norskDato(vis.sistFagligOppdatert) && ` Sist faglig oppdatert ${norskDato(vis.sistFagligOppdatert)}.`}
              </p>
              {vis?.url && (
                <a
                  href={vis.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Åpne hos Helsedirektoratet
                </a>
              )}
            </div>
          </div>

          {vis?.styrke && <Styrke styrke={vis.styrke} />}

          {feil ? (
            <p className="text-sm text-amber-700">Kunne ikke hente teksten. Prøv igjen, eller åpne den hos Helsedirektoratet.</p>
          ) : laster || !enhet ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Henter tekst…
            </p>
          ) : (
            <>
              {enhet.tekst && (
                <div className={enhet.erKapitteltekst ? "" : "rounded-lg border border-blue-100 bg-blue-50/40 px-4 py-2"}>
                  <KildeTekst>{enhet.tekst}</KildeTekst>
                </div>
              )}
              {enhet.praktisk && (
                <details open className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 uppercase tracking-wide py-1">
                    Praktisk
                  </summary>
                  <KildeTekst>{enhet.praktisk}</KildeTekst>
                </details>
              )}
              {enhet.begrunnelse && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500 uppercase tracking-wide py-1">
                    Begrunnelse
                  </summary>
                  <KildeTekst>{enhet.begrunnelse}</KildeTekst>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
