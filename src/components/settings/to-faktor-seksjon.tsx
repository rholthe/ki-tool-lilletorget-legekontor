"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { ShieldCheck, ShieldOff, KeyRound, Copy, Check, Download, LifeBuoy } from "lucide-react"
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
  lagNyeGjenopprettingskoder,
} from "@/actions/to-faktor"

type Steg = "start" | "qr" | "bekreft" | "koder"

interface ToFaktorSeksjonProps {
  er2FAaktivert: boolean
  /** Ubrukte gjenopprettingskoder; vises når 2FA er aktivert. */
  ubrukteKoder?: number
}

/**
 * Gjenopprettingskodene, vist én gang. Kan ikke lukkes før brukeren bekrefter
 * at de er lagret — uten dem er en ødelagt telefon en utestengt konto.
 */
function KoderVisning({ koder, onFerdig }: { koder: string[]; onFerdig: () => void }) {
  const [lagret, setLagret] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const tekst = `Gjenopprettingskoder for legeassist (hver kode virker én gang):\n\n${koder.join("\n")}\n`

  async function kopier() {
    await navigator.clipboard.writeText(tekst)
    setKopiert(true)
    setTimeout(() => setKopiert(false), 2000)
  }

  function lastNed() {
    const url = URL.createObjectURL(new Blob([tekst], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "legeassist-gjenopprettingskoder.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-slate-600">
        <LifeBuoy className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p>
          Lagre kodene i en passordbehandler (for eksempel LastPass). Mister du telefonen, logger
          du inn med én av dem i stedet for koden fra appen. Hver kode virker én gang, og de vises
          ikke igjen.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 border border-slate-200 p-3">
        {koder.map((k) => (
          <code key={k} className="text-sm font-mono text-slate-800 text-center tracking-wide">
            {k}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={kopier}>
          {kopiert ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
          Kopier
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={lastNed}>
          <Download className="w-4 h-4 mr-1.5" />
          Last ned
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={lagret} onChange={(e) => setLagret(e.target.checked)} />
        Jeg har lagret kodene på et trygt sted
      </label>
      <Button
        className="w-full bg-blue-600 hover:bg-blue-700"
        size="sm"
        disabled={!lagret}
        onClick={onFerdig}
      >
        Ferdig
      </Button>
    </div>
  )
}

export function ToFaktorSeksjon({ er2FAaktivert, ubrukteKoder = 0 }: ToFaktorSeksjonProps) {
  const [aktivert, setAktivert] = useState(er2FAaktivert)
  const [igjen, setIgjen] = useState(ubrukteKoder)
  const [koder, setKoder] = useState<string[] | null>(null)
  const [nyeKoderAapen, setNyeKoderAapen] = useState(false)
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
      setAktivert(true)
      setKoder(res.koder)
      setIgjen(res.koder.length)
      setSteg("koder")
    })
  }

  function lagNyeKoder() {
    setFeil("")
    startTransition(async () => {
      const res = await lagNyeGjenopprettingskoder(otpInput)
      if ("feil" in res) {
        setFeil(res.feil)
        setOtpInput("")
        return
      }
      setKoder(res.koder)
      setIgjen(res.koder.length)
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
      setIgjen(0)
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
          {aktivert && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
              <LifeBuoy className="w-3.5 h-3.5 text-slate-400" />
              <span className={igjen <= 3 ? "text-amber-700" : ""}>
                {igjen === 0
                  ? "Ingen gjenopprettingskoder — lag nye, ellers er kontoen tapt hvis du mister telefonen."
                  : `${igjen} av 10 gjenopprettingskoder er ubrukt.`}
              </span>
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => {
                  setOtpInput("")
                  setFeil("")
                  setKoder(null)
                  setNyeKoderAapen(true)
                }}
              >
                Lag nye koder
              </button>
            </p>
          )}
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
      <Dialog
        open={dialogAapen}
        onOpenChange={(o) => {
          // Kodene vises bare én gang — dialogen lukkes med «Ferdig», ikke ved et feilklikk
          if (!o && steg === "koder") return
          setDialogAapen(o)
        }}
      >
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

          {steg === "koder" && koder && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                <ShieldCheck className="w-4 h-4" /> To-faktor er aktivert
              </p>
              <KoderVisning
                koder={koder}
                onFerdig={() => {
                  setDialogAapen(false)
                  setSteg("start")
                  setKoder(null)
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nye gjenopprettingskoder */}
      <Dialog
        open={nyeKoderAapen}
        onOpenChange={(o) => {
          if (!o && koder) return
          setNyeKoderAapen(o)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nye gjenopprettingskoder</DialogTitle>
            <DialogDescription>
              {koder
                ? "De gamle kodene virker ikke lenger."
                : "Bekreft med koden fra autentiseringsappen. De gamle kodene slutter å virke."}
            </DialogDescription>
          </DialogHeader>
          {koder ? (
            <KoderVisning
              koder={koder}
              onFerdig={() => {
                setNyeKoderAapen(false)
                setKoder(null)
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp-nye-koder">Engangskode fra appen</Label>
                <Input
                  id="otp-nye-koder"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
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
                <Button variant="outline" size="sm" onClick={() => setNyeKoderAapen(false)}>
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  onClick={lagNyeKoder}
                  disabled={isPending || otpInput.length !== 6}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isPending ? "Lager..." : "Lag nye koder"}
                </Button>
              </div>
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
