"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { ShieldCheck, ShieldOff, KeyRound, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  generer2FAHemmelighet,
  bekreft2FA,
  deaktiver2FA,
} from "@/actions/to-faktor"

type Steg = "start" | "qr" | "bekreft" | "suksess"

interface ToFaktorSeksjonProps {
  er2FAaktivert: boolean
}

export function ToFaktorSeksjon({ er2FAaktivert }: ToFaktorSeksjonProps) {
  const [aktivert, setAktivert] = useState(er2FAaktivert)
  const [dialogAapen, setDialogAapen] = useState(false)
  const [deaktiverAapen, setDeaktiverAapen] = useState(false)
  const [steg, setSteg] = useState<Steg>("start")

  const [qrUrl, setQrUrl] = useState("")
  const [manuellKode, setManuellKode] = useState("")
  const [kodeKopiert, setKodeKopiert] = useState(false)

  const [otpInput, setOtpInput] = useState("")
  const [passordInput, setPassordInput] = useState("")
  const [feil, setFeil] = useState("")

  const [isPending, startTransition] = useTransition()

  function aapneAktiver() {
    setSteg("start")
    setOtpInput("")
    setFeil("")
    setDialogAapen(true)
  }

  function startOppsett() {
    setFeil("")
    startTransition(async () => {
      const res = await generer2FAHemmelighet()
      if ("feil" in res) {
        setFeil(res.feil)
        return
      }
      setQrUrl(res.qrUrl)
      setManuellKode(res.manuellKode)
      setSteg("qr")
    })
  }

  function bekreftOppsett() {
    setFeil("")
    startTransition(async () => {
      const res = await bekreft2FA(otpInput)
      if ("feil" in res) {
        setFeil(res.feil)
        setOtpInput("")
        return
      }
      setSteg("suksess")
      setAktivert(true)
      setTimeout(() => {
        setDialogAapen(false)
        setSteg("start")
      }, 2000)
    })
  }

  function deaktiver() {
    setFeil("")
    startTransition(async () => {
      const res = await deaktiver2FA(passordInput)
      if ("feil" in res) {
        setFeil(res.feil)
        return
      }
      setAktivert(false)
      setDeaktiverAapen(false)
      setPassordInput("")
    })
  }

  async function kopierKode() {
    await navigator.clipboard.writeText(manuellKode)
    setKodeKopiert(true)
    setTimeout(() => setKodeKopiert(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              To-faktor-autentisering (2FA)
            </h3>
            {aktivert ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" /> Aktiv
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-slate-500 text-xs border-slate-300"
              >
                <ShieldOff className="w-3 h-3 mr-1" /> Inaktiv
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-sm">
            {aktivert
              ? "Kontoen din er beskyttet med en engangskode fra autentiseringsappen din."
              : "Aktiver 2FA for å kreve en engangskode i tillegg til passord ved innlogging. Fungerer med Microsoft Authenticator, Google Authenticator og andre autentiseringsapper."}
          </p>
        </div>
        {aktivert ? (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
            onClick={() => {
              setPassordInput("")
              setFeil("")
              setDeaktiverAapen(true)
            }}
          >
            Deaktiver
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
            onClick={aapneAktiver}
          >
            <KeyRound className="w-4 h-4 mr-1.5" />
            Aktiver 2FA
          </Button>
        )}
      </div>

      {/* Aktiver-dialog */}
      <Dialog open={dialogAapen} onOpenChange={setDialogAapen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aktiver to-faktor-autentisering</DialogTitle>
            <DialogDescription>
              Bruk en autentiseringsapp på mobilen, for eksempel Microsoft
              Authenticator eller Google Authenticator, til å skanne QR-koden.
            </DialogDescription>
          </DialogHeader>

          {steg === "start" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 space-y-2">
                <p className="font-medium text-slate-700">Slik aktiverer du:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Installer Microsoft Authenticator eller Google Authenticator på mobilen (gratis i App Store og Google Play)</li>
                  <li>Trykk «Fortsett» for å få opp QR-kode</li>
                  <li>Skann koden i appen</li>
                  <li>Bekreft med 6-sifret kode fra appen</li>
                </ol>
              </div>
              {feil && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {feil}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogAapen(false)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  onClick={startOppsett}
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isPending ? "Forbereder..." : "Fortsett →"}
                </Button>
              </div>
            </div>
          )}

          {steg === "qr" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Skann QR-koden med autentiseringsappen (f.eks. Microsoft eller Google Authenticator):
              </p>
              {qrUrl && (
                <div className="flex justify-center">
                  <Image
                    src={qrUrl}
                    alt="2FA QR-kode"
                    width={192}
                    height={192}
                    className="rounded-lg border border-slate-200"
                  />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-slate-500">
                  Kan ikke skanne? Skriv inn koden manuelt:
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-mono break-all text-slate-700">
                    {manuellKode}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={kopierKode}
                  >
                    {kodeKopiert ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
                onClick={() => setSteg("bekreft")}
              >
                Jeg har skannet koden →
              </Button>
            </div>
          )}

          {steg === "bekreft" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Skriv inn 6-sifret kode fra appen for å bekrefte oppsettet:
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="otp-bekreft">Engangskode</Label>
                <Input
                  id="otp-bekreft"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpInput}
                  onChange={(e) =>
                    setOtpInput(e.target.value.replace(/\D/g, ""))
                  }
                  className="tracking-widest text-center text-lg font-mono"
                  autoFocus
                />
              </div>
              {feil && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {feil}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSteg("qr")}
                >
                  ← Tilbake
                </Button>
                <Button
                  size="sm"
                  onClick={bekreftOppsett}
                  disabled={isPending || otpInput.length !== 6}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isPending ? "Bekrefter..." : "Bekreft"}
                </Button>
              </div>
            </div>
          )}

          {steg === "suksess" && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-semibold text-slate-800">2FA aktivert!</p>
              <p className="text-sm text-slate-500">
                Kontoen din er nå beskyttet med to-faktor-autentisering.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deaktiver-dialog */}
      <Dialog open={deaktiverAapen} onOpenChange={setDeaktiverAapen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deaktiver to-faktor-autentisering</DialogTitle>
            <DialogDescription>
              Skriv inn passordet ditt for å bekrefte at du vil deaktivere 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="passord-deaktiver">Passord</Label>
              <Input
                id="passord-deaktiver"
                type="password"
                value={passordInput}
                onChange={(e) => setPassordInput(e.target.value)}
                autoFocus
              />
            </div>
            {feil && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {feil}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeaktiverAapen(false)}
              >
                Avbryt
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending || !passordInput}
                onClick={deaktiver}
              >
                {isPending ? "Deaktiverer..." : "Deaktiver 2FA"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
