"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { settKrav2faFra } from "@/actions/krav-2fa"

export function Krav2faSkjema({ dato }: { dato: string | null }) {
  const router = useRouter()
  const [verdi, setVerdi] = useState(dato ?? "")
  const [melding, setMelding] = useState<string | null>(null)
  const [venter, start] = useTransition()

  function lagre(ny: string) {
    setMelding(null)
    start(async () => {
      const r = await settKrav2faFra(ny)
      if (!r.ok) return setMelding(r.feil ?? "Kunne ikke lagre.")
      setVerdi(ny)
      setMelding(ny ? "Lagret." : "Kravet er fjernet.")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="krav2fa">Obligatorisk to-faktor fra</Label>
        <Input
          id="krav2fa"
          type="date"
          value={verdi}
          onChange={(e) => setVerdi(e.target.value)}
          className="w-44"
        />
      </div>
      <Button onClick={() => lagre(verdi)} disabled={venter || !verdi} className="bg-blue-600 hover:bg-blue-700">
        Lagre
      </Button>
      {dato && (
        <Button variant="outline" onClick={() => lagre("")} disabled={venter}>
          Fjern kravet
        </Button>
      )}
      {melding && <p className="text-xs text-slate-500 w-full">{melding}</p>}
    </div>
  )
}
