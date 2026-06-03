"use client"

import { useState, useTransition } from "react"
import { signIn } from "next-auth/react"
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

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"

  const [step, setStep] = useState<"credentials" | "totp">("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [totp, setTotp] = useState("")
  const [feil, setFeil] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil("")

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        totp: step === "totp" ? totp : undefined,
        redirect: false,
      })

      if (result?.error === "TwoFactorRequired") {
        setStep("totp")
        return
      }

      if (result?.error) {
        setFeil(
          step === "totp"
            ? "Ugyldig engangskode. Prøv igjen."
            : "Feil e-post eller passord."
        )
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
            : "Skriv inn engangskoden fra autentiseringsappen din (f.eks. YubiKey Authenticator)"}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {step === "credentials" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="lege@klinikk.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Passord</Label>
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

          {step === "totp" && (
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
                Åpne YubiKey Authenticator eller annen TOTP-app og skriv inn
                6-sifret kode for legeassist.
              </p>
            </div>
          )}

          {feil && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {feil}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? "Vent..."
              : step === "credentials"
                ? "Logg inn"
                : "Bekreft"}
          </Button>

          {step === "totp" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("credentials")
                setTotp("")
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
          Ny bruker?{" "}
          <Link
            href="/registrer"
            className="text-blue-600 hover:underline font-medium"
          >
            Opprett konto
          </Link>
        </p>
      )}
    </Card>
  )
}
