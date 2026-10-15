"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { signIn } from "next-auth/react"
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
} from "@simplewebauthn/browser"
import { KeyRound } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { sjekkInnlogging } from "@/actions/auth"
import { startPasskeyInnlogging } from "@/actions/passkey"

const LAAST = "Konsultasjonene dine er låst og kommer tilbake når du logger inn."
const UTLOGGING_TEKST: Record<string, string> = {
  inaktiv: `Du ble logget ut etter en time uten aktivitet. ${LAAST}`,
  lukket: `Du ble logget ut fordi nettleseren ble lukket. ${LAAST}`,
  utlopt: `Økten din er utløpt. ${LAAST}`,
  utlogget: "Du er logget ut, og konsultasjonene dine på denne maskinen er slettet.",
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const grunn = searchParams.get("grunn")
  const utloggingInfo = grunn ? UTLOGGING_TEKST[grunn] : undefined

  const [step, setStep] = useState<"credentials" | "totp">("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [totp, setTotp] = useState("")
  /** Gjenopprettingskode i stedet for koden fra appen (telefonen er borte). */
  const [brukerGjenoppretting, setBrukerGjenoppretting] = useState(false)
  const [feil, setFeil] = useState("")
  const [isPending, startTransition] = useTransition()
  const [passkeyVenter, setPasskeyVenter] = useState(false)
  /** Økes for å starte autoutfyllingen på nytt etter et mislykket forsøk. */
  const [autofillRunde, setAutofillRunde] = useState(0)

  /**
   * Innlogging med passkey. `autofill` = passkeyen foreslås i e-postfeltet
   * (venter i bakgrunnen fra siden lastes); ellers åpner nettleseren dialogen
   * med en gang. Et nytt forsøk avbryter det ventende.
   */
  const loggInnMedPasskey = useCallback(
    async (autofill: boolean): Promise<void> => {
      const start = await startPasskeyInnlogging()
      if ("feil" in start) {
        if (!autofill) setFeil(start.feil)
        return
      }
      let svar
      try {
        svar = await startAuthentication({ optionsJSON: start.valg, useBrowserAutofill: autofill })
      } catch (e) {
        const navn = e instanceof Error ? e.name : ""
        // Avbrutt av brukeren eller av et nytt forsøk: ingen feilmelding
        if (!autofill && navn !== "AbortError" && navn !== "NotAllowedError") {
          setFeil("Innlogging med passkey feilet. Prøv igjen, eller bruk passord.")
        }
        // Dialogen avbrøt autoutfyllingen; start den igjen
        if (!autofill) setAutofillRunde((n) => n + 1)
        return
      }
      setFeil("")
      setPasskeyVenter(true)
      const result = await signIn("passkey", {
        utfordringId: start.utfordringId,
        svar: JSON.stringify(svar),
        redirect: false,
      })
      if (result?.error) {
        setPasskeyVenter(false)
        setFeil("Passkeyen ble ikke godkjent. Er den lagt til kontoen din under Innstillinger?")
        // Gjør autoutfyllingen klar for et nytt forsøk
        setAutofillRunde((n) => n + 1)
        return
      }
      router.push(callbackUrl)
      router.refresh()
    },
    [callbackUrl, router]
  )

  // Autoutfylling: nettlesere som støtter det, viser passkeyen i e-postfeltet
  useEffect(() => {
    let avbrutt = false
    void browserSupportsWebAuthnAutofill().then((ja) => {
      if (ja && !avbrutt) void loggInnMedPasskey(true)
    })
    return () => {
      avbrutt = true
    }
  }, [loggInnMedPasskey, autofillRunde])

  function handlePasskeyKnapp() {
    setFeil("")
    if (!browserSupportsWebAuthn()) {
      setFeil("Denne nettleseren støtter ikke passkeys. Logg inn med passord.")
      return
    }
    void loggInnMedPasskey(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil("")

    startTransition(async () => {
      // Steg 1: Sjekk credentials og om 2FA trengs — uten å involvere NextAuth
      if (step === "credentials") {
        const sjekk = await sjekkInnlogging(email, password)

        if (!sjekk.ok) {
          setFeil(sjekk.feil ?? "Feil e-post eller passord.")
          return
        }

        if (sjekk.trenger2FA) {
          setStep("totp")
          return
        }

        // Ingen 2FA — logg inn direkte
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })
        if (result?.error) {
          setFeil("Innlogging feilet. Prøv igjen.")
          return
        }
        router.push(callbackUrl)
        router.refresh()
        return
      }

      // Steg 2: 2FA — send alle tre feltene til NextAuth
      const result = await signIn("credentials", {
        email,
        password,
        totp,
        redirect: false,
      })

      if (result?.error) {
        setFeil(
          brukerGjenoppretting
            ? "Ugyldig eller allerede brukt gjenopprettingskode. Prøv en annen."
            : "Ugyldig engangskode. Prøv igjen."
        )
        setTotp("")
        return
      }

      router.push(callbackUrl)
      router.refresh()
    })
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">LA</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">
            legeassist
          </span>
        </div>
        <CardTitle className="text-xl">
          {step === "credentials" ? "Logg inn" : "To-faktor-verifisering"}
        </CardTitle>
        <CardDescription>
          {step === "credentials"
            ? "Skriv inn e-post og passord"
            : brukerGjenoppretting
              ? "Skriv inn én av gjenopprettingskodene du lagret da du aktiverte to-faktor"
              : "Skriv inn engangskoden fra autentiseringsappen din (f.eks. Microsoft eller Google Authenticator)"}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {utloggingInfo && step === "credentials" && (
            <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              {utloggingInfo}
            </p>
          )}
          {step === "credentials" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username webauthn"
                  placeholder="lege@klinikk.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">Passord</Label>
                  <Link href="/glemt-passord" className="text-xs text-blue-600 hover:underline">
                    Glemt passord?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {step === "totp" && !brukerGjenoppretting && (
            <div className="space-y-1.5">
              <Label htmlFor="totp">Engangskode (6 siffer)</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="tracking-widest text-center text-lg font-mono"
              />
              <p className="text-xs text-slate-500">
                Åpne autentiseringsappen på mobilen og skriv inn den sekssifrede
                koden for legeassist.
              </p>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => {
                  setBrukerGjenoppretting(true)
                  setTotp("")
                  setFeil("")
                }}
              >
                Har du ikke telefonen? Bruk en gjenopprettingskode
              </button>
            </div>
          )}

          {step === "totp" && brukerGjenoppretting && (
            <div className="space-y-1.5">
              <Label htmlFor="gjenoppretting">Gjenopprettingskode</Label>
              <Input
                id="gjenoppretting"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={20}
                placeholder="XXXXX-XXXXX"
                value={totp}
                onChange={(e) => setTotp(e.target.value.toUpperCase())}
                required
                autoFocus
                className="tracking-widest text-center text-lg font-mono"
              />
              <p className="text-xs text-slate-500">
                Hver kode virker én gang. Du får en e-post når en kode er brukt. Sett opp to-faktor på
                nytt under Innstillinger etterpå, eller be administrator nullstille den.
              </p>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => {
                  setBrukerGjenoppretting(false)
                  setTotp("")
                  setFeil("")
                }}
              >
                Bruk koden fra appen i stedet
              </button>
            </div>
          )}

          {feil && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {feil}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending || passkeyVenter}>
            {isPending || passkeyVenter
              ? "Vent..."
              : step === "credentials"
                ? "Logg inn"
                : "Bekreft"}
          </Button>

          {step === "credentials" && (
            <>
              <div className="flex items-center gap-3 w-full text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                eller
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isPending || passkeyVenter}
                onClick={handlePasskeyKnapp}
              >
                <KeyRound className="w-4 h-4 mr-1.5" />
                Logg inn med passkey
              </Button>
            </>
          )}

          {step === "totp" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("credentials")
                setTotp("")
                setBrukerGjenoppretting(false)
                setFeil("")
              }}
            >
              ← Tilbake
            </Button>
          )}
        </CardFooter>
      </form>

      {step === "credentials" && (
        <p className="text-center text-sm text-slate-500 pb-4">
          Trenger du tilgang?{" "}
          <Link
            href="/tilgang"
            className="text-blue-600 hover:underline font-medium"
          >
            Kontakt en administrator
          </Link>
        </p>
      )}
    </Card>
  )
}
