"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { lagreBrukPriser } from "@/actions/bruk-priser"

interface Props {
  modell: string
  pris: { inn: number; ut: number; cacheLes: number; cacheSkriv: number }
  sonioxPerTime: number
  usdNok: number
}

export function BrukPriserSkjema({ modell, pris, sonioxPerTime, usdNok }: Props) {
  const [state, action, venter] = useActionState(lagreBrukPriser, {})
  const felt = (navn: string, etikett: string, verdi: number, steg = "0.001") => (
    <div className="space-y-1">
      <Label htmlFor={navn} className="text-xs">{etikett}</Label>
      <Input id={navn} name={navn} type="number" step={steg} min="0" defaultValue={verdi} className="h-8 w-32" />
    </div>
  )
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="modell" value={modell} />
      <p className="text-xs text-slate-500">
        Claude ({modell}), USD per million tokens. EU-profilen koster 10 % mer enn listepris.
      </p>
      <div className="flex flex-wrap gap-3">
        {felt("inn", "Inn", pris.inn)}
        {felt("ut", "Ut", pris.ut)}
        {felt("cacheLes", "Cache lest", pris.cacheLes)}
        {felt("cacheSkriv", "Cache skrevet", pris.cacheSkriv)}
      </div>
      <div className="flex flex-wrap gap-3">
        {felt("sonioxPerTime", "Soniox, USD per time lyd", sonioxPerTime)}
        {felt("usdNok", "Kurs USD → NOK", usdNok, "0.01")}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={venter} className="bg-blue-600 hover:bg-blue-700">
          {venter ? "Lagrer…" : "Lagre priser"}
        </Button>
        {state.melding && <p className={`text-xs ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.melding}</p>}
      </div>
    </form>
  )
}
