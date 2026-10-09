"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { AlertTriangle, Check, ExternalLink, Info } from "lucide-react"
import type { Anbefaling, Retningslinje, Tilstand } from "@/lib/verktoy/typer"
import {
  HENTING_ADVARSEL_DAGER,
  INGEN_BEHANDLING,
  anbefalingTilTekst,
  dagerSidenHentet,
  norskDato,
} from "@/lib/verktoy/retningslinje"

interface Props {
  retningslinje: Retningslinje
  tilstand: Tilstand
  valgte: string[]
  onVelg: (id: string) => void
}

/**
 * Kildens tekst, konvertert fra HTML til Markdown på serveren. react-markdown
 * rendrer aldri rå HTML, og lenker åpnes i ny fane.
 */
const MD: Components = {
  h1: (p) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...p} />,
  h2: (p) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...p} />,
  h3: (p) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...p} />,
  h4: (p) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...p} />,
  h5: (p) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...p} />,
  h6: (p) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1" {...p} />,
  p: (p) => <p className="text-sm text-slate-700 leading-relaxed my-1.5" {...p} />,
  ul: (p) => <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 my-1.5" {...p} />,
  ol: (p) => <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700 my-1.5" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
      {children}
    </a>
  ),
  strong: (p) => <strong className="font-semibold text-slate-800" {...p} />,
  table: (p) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-sm border border-slate-200" {...p} />
    </div>
  ),
  th: (p) => <th className="px-2 py-1 text-left font-medium border-b border-slate-200" {...p} />,
  td: (p) => <td className="px-2 py-1 align-top border-t border-slate-100" {...p} />,
}

function KildeTekst({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
      {children}
    </ReactMarkdown>
  )
}

function AnbefalingRad({
  anbefaling,
  valgt,
  onVelg,
}: {
  anbefaling: Anbefaling
  valgt: boolean
  onVelg: () => void
}) {
  return (
    <button
      type="button"
      onClick={onVelg}
      aria-pressed={valgt}
      className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors ${
        valgt ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
          valgt ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {valgt && <Check className="w-3 h-3" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-slate-800 font-medium">
          {anbefalingTilTekst(anbefaling)}
        </span>
        <span className="block text-xs text-slate-500 mt-0.5">{anbefaling.etikett}</span>
      </span>
    </button>
  )
}

/**
 * Oppslag i en retningslinje. Legen fyller ikke ut noe — hun leser, velger den
 * behandlingslinjen som gjelder pasienten, og får den ordrett inn i notatet.
 *
 * Ferskhet er synlig hele veien: både kildens egen revisjonsdato, når innholdet
 * her sist ble sammenholdt med kilden, og en direkte lenke til kapitlet.
 */
export function RetningslinjeVisning({ retningslinje, tilstand, valgte, onVelg }: Props) {
  const standard = tilstand.anbefalinger.filter((a) => a.gruppe === "standard")
  const alternativer = tilstand.anbefalinger.filter((a) => a.gruppe === "alternativ")
  const dager = dagerSidenHentet(retningslinje)
  const foreldet = dager > HENTING_ADVARSEL_DAGER
  const ingenValgt = valgte.includes(INGEN_BEHANDLING)

  return (
    <div className="space-y-5">
      {/*
        Kildeangivelse etter vilkårene for Helsedirektoratets innhold (NLOD):
        tydelig, i samme størrelse som innholdet og rett ved det
      */}
      <p className="text-sm text-slate-700">
        Kilde: {retningslinje.kilde.navn} — {retningslinje.langtNavn}
      </p>

      {/* Ferskhet og kilde */}
      <div
        className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${
          foreldet ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex items-start gap-2">
          {foreldet ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0 text-xs">
            <p className={foreldet ? "text-amber-800" : "text-slate-600"}>
              {foreldet
                ? `Innholdet ble sist hentet fra Helsedirektoratet ${norskDato(retningslinje.hentetAt)} og kan være utdatert — sjekk kilden før du følger anbefalingen.`
                : `Hentet fra Helsedirektoratet ${norskDato(retningslinje.hentetAt)}.`}
              {norskDato(tilstand.sistFagligOppdatert) &&
                ` Sist faglig oppdatert ${norskDato(tilstand.sistFagligOppdatert)}.`}
            </p>
          </div>
        </div>
        <a
          href={tilstand.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Åpne hos Helsedirektoratet
        </a>
      </div>

      {/* Indikasjon */}
      {tilstand.indikasjon && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Indikasjon for antibiotikabehandling
          </h4>
          <KildeTekst>{tilstand.indikasjon}</KildeTekst>
        </div>
      )}

      {/* Behandling */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {tilstand.anbefalinger.length > 0 ? "Behandling" : "Vurdering"}
          </h4>
          {tilstand.varighet && (
            <span className="text-xs text-slate-500">
              Behandlingsvarighet: {tilstand.varighet}
            </span>
          )}
        </div>

        {standard.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Standardbehandling</p>
            {standard.map((a) => (
              <AnbefalingRad
                key={a.id}
                anbefaling={a}
                valgt={valgte.includes(a.id)}
                onVelg={() => onVelg(a.id)}
              />
            ))}
          </div>
        )}

        {alternativer.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-xs text-slate-400">Behandlingsalternativer</p>
            {alternativer.map((a) => (
              <AnbefalingRad
                key={a.id}
                anbefaling={a}
                valgt={valgte.includes(a.id)}
                onVelg={() => onVelg(a.id)}
              />
            ))}
          </div>
        )}

        {/* Å journalføre at antibiotika ikke er indisert er et like gyldig utfall
            som å velge et preparat — særlig ved tilstander som akutt bronkitt */}
        <button
          type="button"
          onClick={() => onVelg(INGEN_BEHANDLING)}
          aria-pressed={ingenValgt}
          className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors mt-1 ${
            ingenValgt ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span
            className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
              ingenValgt
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-slate-300 bg-white"
            }`}
          >
            {ingenValgt && <Check className="w-3 h-3" />}
          </span>
          <span className="text-sm text-slate-800">Antibiotika ikke indisert</span>
        </button>
      </div>

      {tilstand.merknader && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Annen behandling og merknader
          </h4>
          <KildeTekst>{tilstand.merknader}</KildeTekst>
        </div>
      )}
    </div>
  )
}
