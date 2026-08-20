"use client"

import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VeiledningLenke } from "@/components/app/verktoy-veiledning"
import { erSynlig } from "@/lib/verktoy/kalkulator"
import type {
  Felt,
  Funnverdi,
  Kalkulator,
  Side,
  Svarverdi,
  Verktoy,
} from "@/lib/verktoy/typer"

interface Props {
  /** Kalkulatorer har samme inndataform som verktøy, så skjemaet er felles. */
  verktoy: Verktoy | Kalkulator
  svar: Record<string, Svarverdi>
  onSvar: (id: string, verdi: Svarverdi) => void
  side?: Side
  onSide: (side: Side) => void
}

const FUNN_VALG: { verdi: Funnverdi; label: string; aktivKlasse: string }[] = [
  { verdi: "normal", label: "Normal", aktivKlasse: "border-emerald-400 bg-emerald-50 text-emerald-700" },
  { verdi: "patologisk", label: "Patologisk", aktivKlasse: "border-red-400 bg-red-50 text-red-700" },
  { verdi: "ikke_utfort", label: "Ikke utført", aktivKlasse: "border-slate-300 bg-slate-100 text-slate-600" },
]

function formaterPoeng(poeng: number): string {
  return poeng > 0 ? `+${poeng}` : `${poeng}`
}

/**
 * Ett felt. Den korte `hjelp`-linjen står i skjemaet; lenken til full veiledning
 * plasseres der den er nærmest spørsmålet — men aldri inni knappen for `ja_nei`
 * og `funn`, siden en knapp ikke kan inneholde en annen knapp.
 */
function FeltRad({
  felt,
  verdi,
  onSvar,
  lenke,
  visPoeng,
}: {
  felt: Felt
  verdi: Svarverdi
  onSvar: (v: Svarverdi) => void
  lenke: ReactNode
  /** Formelverktøy har ingen poeng — da er merket bare støy. */
  visPoeng: boolean
}) {
  switch (felt.type) {
    case "ja_nei": {
      const av = verdi === true
      return (
        <>
        <button
          type="button"
          onClick={() => onSvar(!av)}
          aria-pressed={av}
          className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-lg border transition-colors ${
            av ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span
            className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
              av ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {av && <Check className="w-3 h-3" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-slate-800">{felt.sporsmal}</span>
            {felt.hjelp && <span className="block text-xs text-slate-500 mt-0.5">{felt.hjelp}</span>}
          </span>
          {visPoeng && (
            <span className="text-xs font-medium text-slate-400 shrink-0 tabular-nums">
              {formaterPoeng(felt.poeng)}
            </span>
          )}
        </button>
        {lenke && <div className="pl-10 pt-1">{lenke}</div>}
        </>
      )
    }

    case "valg":
      return (
        <div className="space-y-1.5">
          <div className="text-sm text-slate-800">{felt.sporsmal}</div>
          {felt.hjelp && <div className="text-xs text-slate-500">{felt.hjelp}</div>}
          {lenke}
          <div className="space-y-1">
            {felt.alternativer.map((alt, i) => {
              const av = verdi === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSvar(av ? null : i)}
                  aria-pressed={av}
                  className={`w-full flex items-start gap-3 text-left px-3 py-2 rounded-lg border transition-colors ${
                    av ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-1 w-3.5 h-3.5 rounded-full border shrink-0 ${
                      av ? "border-[5px] border-blue-600 bg-white" : "border-slate-300 bg-white"
                    }`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-800">{alt.tekst}</span>
                    {alt.kriterium && (
                      <span className="block text-xs text-slate-500 mt-0.5">{alt.kriterium}</span>
                    )}
                  </span>
                  {visPoeng && (
                    <span className="text-xs font-medium text-slate-400 shrink-0 tabular-nums">
                      {formaterPoeng(alt.poeng)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )

    case "tall":
      return (
        <div className="space-y-1.5">
          <label className="block text-sm text-slate-800">{felt.sporsmal}</label>
          {felt.hjelp && <div className="text-xs text-slate-500">{felt.hjelp}</div>}
          {lenke}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={felt.min}
              max={felt.max}
              value={typeof verdi === "number" ? verdi : ""}
              onChange={(e) => onSvar(e.target.value === "" ? null : Number(e.target.value))}
              className="max-w-32"
            />
            <span className="text-xs text-slate-500">{felt.enhet}</span>
          </div>
        </div>
      )

    case "dato":
      return (
        <div className="space-y-1.5">
          <label className="block text-sm text-slate-800">{felt.sporsmal}</label>
          {felt.hjelp && <div className="text-xs text-slate-500">{felt.hjelp}</div>}
          {lenke}
          <Input
            type="date"
            value={typeof verdi === "string" ? verdi : ""}
            onChange={(e) => onSvar(e.target.value === "" ? null : e.target.value)}
            className="max-w-48"
          />
        </div>
      )

    case "funn":
      return (
        <div className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-slate-800">{felt.test}</span>
            {felt.hjelp && <span className="block text-xs text-slate-500 mt-0.5">{felt.hjelp}</span>}
          </span>
          <div className="flex gap-1 shrink-0">
            {FUNN_VALG.map((v) => {
              const av = verdi === v.verdi
              return (
                <button
                  key={v.verdi}
                  type="button"
                  onClick={() => onSvar(av ? null : v.verdi)}
                  aria-pressed={av}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                    av ? v.aktivKlasse : "border-slate-200 text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>
        {lenke}
        </div>
      )

    case "fritekst":
      return (
        <div className="space-y-1.5">
          <label className="block text-sm text-slate-800">{felt.sporsmal}</label>
          {felt.hjelp && <div className="text-xs text-slate-500">{felt.hjelp}</div>}
          {lenke}
          <Textarea
            value={typeof verdi === "string" ? verdi : ""}
            onChange={(e) => onSvar(e.target.value)}
            className="min-h-16 text-sm border-slate-200"
          />
        </div>
      )
  }
}

/** Generisk renderer — samme komponent brukes for alle verktøy. */
export function VerktoySkjema({ verktoy, svar, onSvar, side, onSide }: Props) {
  return (
    <div className="space-y-5">
      {"lateralitet" in verktoy && verktoy.lateralitet && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Side</span>
          {(["venstre", "hoyre"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSide(s)}
              aria-pressed={side === s}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                side === s
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s === "venstre" ? "Venstre" : "Høyre"}
            </button>
          ))}
        </div>
      )}

      {verktoy.seksjoner.map((seksjon) => (
        <div key={seksjon.id} className="space-y-2">
          {verktoy.seksjoner.length > 1 && (
            <div className="flex items-baseline justify-between">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {seksjon.tittel}
              </h4>
              {seksjon.maksPoeng !== undefined && (
                <span className="text-xs text-slate-400">maks {seksjon.maksPoeng}</span>
              )}
            </div>
          )}
          <div className="space-y-2">
            {seksjon.felter.filter((felt) => erSynlig(felt, svar)).map((felt) => (
              <FeltRad
                key={felt.id}
                felt={felt}
                verdi={svar[felt.id] ?? null}
                onSvar={(v) => onSvar(felt.id, v)}
                lenke={
                  felt.veiledning ? <VeiledningLenke veiledning={felt.veiledning} /> : null
                }
                visPoeng={"beregning" in verktoy && verktoy.beregning.type !== "formel"}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
