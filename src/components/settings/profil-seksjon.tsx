"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lagreProfil } from "@/actions/profil"

interface Props {
  navn: string
  epost: string
  hpr: string
}

/** Navn og HPR-nummer. Brukes når et skjema har felt for legen som fyller ut. */
export function ProfilSeksjon({ navn: startNavn, epost, hpr: startHpr }: Props) {
  const [navn, setNavn] = useState(startNavn)
  const [hpr, setHpr] = useState(startHpr)
  const [lagret, setLagret] = useState({ navn: startNavn, hpr: startHpr })
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null)
  const [venter, startLagring] = useTransition()

  const endret = navn.trim() !== lagret.navn || hpr.trim() !== lagret.hpr

  function lagre(e: React.FormEvent) {
    e.preventDefault()
    setMelding(null)
    startLagring(async () => {
      const svar = await lagreProfil({ navn, hpr })
      if (svar.ok) {
        const ny = { navn: navn.replace(/\s+/g, " ").trim(), hpr: hpr.replace(/\s+/g, "") }
        setNavn(ny.navn)
        setHpr(ny.hpr)
        setLagret(ny)
        setMelding({ ok: true, tekst: "Lagret." })
      } else {
        setMelding({ ok: false, tekst: svar.feil })
      }
    })
  }

  return (
    <form onSubmit={lagre} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <label className="space-y-1">
          <span className="block text-xs text-slate-400 font-medium">Fullt navn</span>
          <Input value={navn} onChange={(e) => setNavn(e.target.value)} maxLength={100} autoComplete="name" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-slate-400 font-medium">HPR-nummer</span>
          <Input
            value={hpr}
            onChange={(e) => setHpr(e.target.value)}
            inputMode="numeric"
            maxLength={11}
            placeholder="7–9 siffer"
            autoComplete="off"
          />
        </label>
        <div>
          <p className="text-xs text-slate-400 font-medium mb-0.5">E-post</p>
          <p className="text-slate-700">{epost || "–"}</p>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Navnet og HPR-nummeret settes inn i skjema som har felt for legen. Skriv navnet slik det skal stå i en
        erklæring.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!endret || venter}>
          {venter ? "Lagrer …" : "Lagre"}
        </Button>
        {melding && <span className={`text-xs ${melding.ok ? "text-green-700" : "text-red-600"}`}>{melding.tekst}</span>}
      </div>
    </form>
  )
}
