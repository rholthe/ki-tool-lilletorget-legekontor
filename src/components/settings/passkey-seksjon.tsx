"use client"

import { useState, useTransition } from "react"
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { KeyRound, Plus, Trash2, Cloud, Usb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { startPasskeyRegistrering, fullforPasskeyRegistrering, slettPasskey } from "@/actions/passkey"
import type { PasskeyInfo } from "@/lib/passkey"

interface PasskeySeksjonProps {
  passkeys: PasskeyInfo[]
  /** Passkeys kan bare legges til når to-faktor (TOTP) er aktivert. */
  er2FAaktivert: boolean
}

function dato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Passkeys: innlogging med fingeravtrykk, ansikt eller PIN i stedet for passord
 * og engangskode. Windows Hello, Bitwarden, iCloud/Google og YubiKey virker.
 */
export function PasskeySeksjon({ passkeys: start, er2FAaktivert }: PasskeySeksjonProps) {
  const [passkeys, setPasskeys] = useState(start)
  const [leggTilAapen, setLeggTilAapen] = useState(false)
  const [slettes, setSlettes] = useState<PasskeyInfo | null>(null)
  const [navn, setNavn] = useState("")
  const [otp, setOtp] = useState("")
  const [feil, setFeil] = useState("")
  const [isPending, startTransition] = useTransition()

  function aapneLeggTil() {
    setNavn("")
    setOtp("")
    setFeil("")
    setLeggTilAapen(true)
  }

  function leggTil() {
    setFeil("")
    if (!browserSupportsWebAuthn()) {
      setFeil("Denne nettleseren støtter ikke passkeys.")
      return
    }
    startTransition(async () => {
      const valg = await startPasskeyRegistrering(otp)
      if ("feil" in valg) {
        setFeil(valg.feil)
        setOtp("")
        return
      }
      let svar
      try {
        svar = await startRegistration({ optionsJSON: valg.valg })
      } catch (e) {
        const navnFeil = e instanceof Error ? e.name : ""
        setFeil(
          navnFeil === "InvalidStateError"
            ? "Denne enheten eller nøkkelen har allerede en passkey for kontoen din."
            : navnFeil === "NotAllowedError" || navnFeil === "AbortError"
              ? "Avbrutt. Prøv igjen når du er klar."
              : "Passkeyen kunne ikke lages. Prøv igjen."
        )
        setOtp("")
        return
      }
      const res = await fullforPasskeyRegistrering(valg.utfordringId, svar, navn)
      if ("feil" in res) {
        setFeil(res.feil)
        setOtp("")
        return
      }
      setPasskeys(res.passkeys)
      setLeggTilAapen(false)
    })
  }

  function slett() {
    if (!slettes) return
    setFeil("")
    startTransition(async () => {
      const res = await slettPasskey(slettes.id)
      if ("feil" in res) {
        setFeil(res.feil)
        return
      }
      setPasskeys(res.passkeys)
      setSlettes(null)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-800">Passkeys</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Logg inn med fingeravtrykk, ansikt eller PIN i stedet for passord og engangskode. Virker
            med Windows Hello, Bitwarden, iCloud- og Google-nøkkelring og YubiKey. Legg gjerne til
            to, for eksempel én til daglig og en YubiKey som reserve.
          </p>
          {!er2FAaktivert && (
            <p className="text-xs text-amber-700">Aktiver to-faktor først — passkeys legges til med en kode fra appen.</p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={!er2FAaktivert}
          onClick={aapneLeggTil}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Legg til
        </Button>
      </div>

      {passkeys.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{p.navn}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
                  {p.flerEnhet ? (
                    <>
                      <Cloud className="w-3 h-3" /> Synkronisert
                    </>
                  ) : (
                    <>
                      <Usb className="w-3 h-3" /> Kun denne enheten
                    </>
                  )}
                  <span>· lagt til {dato(p.opprettet)}</span>
                  <span>· {p.sistBrukt ? `sist brukt ${dato(p.sistBrukt)}` : "ikke brukt ennå"}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-600 shrink-0"
                title="Slett passkey"
                onClick={() => {
                  setFeil("")
                  setSlettes(p)
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Legg til */}
      <Dialog open={leggTilAapen} onOpenChange={(o) => !isPending && setLeggTilAapen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Legg til passkey</DialogTitle>
            <DialogDescription>
              Gi passkeyen et navn, og bekreft med koden fra autentiseringsappen. Deretter spør
              nettleseren hvor passkeyen skal lagres — Windows Hello, Bitwarden, telefonen eller en
              YubiKey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="passkey-navn">Navn</Label>
              <Input
                id="passkey-navn"
                placeholder="f.eks. Kontor-PC, Bitwarden, YubiKey"
                maxLength={100}
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otp-passkey">Engangskode fra appen</Label>
              <Input
                id="otp-passkey"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="tracking-widest text-center text-lg font-mono"
              />
            </div>
            {feil && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {feil}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" disabled={isPending} onClick={() => setLeggTilAapen(false)}>
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={leggTil}
                disabled={isPending || otp.length !== 6 || !navn.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isPending ? "Venter på passkey..." : "Lag passkey"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slett */}
      <Dialog open={slettes !== null} onOpenChange={(o) => !o && !isPending && setSlettes(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Slett passkey</DialogTitle>
            <DialogDescription>
              «{slettes?.navn}» kan ikke lenger brukes til å logge inn. Passkeyen ligger fortsatt i
              Bitwarden, Windows eller på nøkkelen til du sletter den der også.
            </DialogDescription>
          </DialogHeader>
          {feil && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {feil}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setSlettes(null)}>
              Avbryt
            </Button>
            <Button size="sm" variant="destructive" disabled={isPending} onClick={slett}>
              {isPending ? "Sletter..." : "Slett"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
